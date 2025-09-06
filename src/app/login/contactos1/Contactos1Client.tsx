'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ================= Tipos ================= */
type Dia = 'Domingo' | 'Martes' | 'Virtual';
type Semana = 1 | 2 | 3;
type Resultado =
  | 'no_contesta'
  | 'no_por_ahora'
  | 'llamar_de_nuevo'
  | 'confirmo_asistencia'
  | 'salio_de_viaje'
  | 'ya_esta_en_ptmd'
  | 'no_tiene_transporte'
  | 'vive_fuera'
  | 'murio'
  | 'rechazado';

type AsignacionContacto = {
  etapa: string;     // p.ej. "Semilla 1", "Semilla 2", "Devocionales", "Restauracion"
  dia: Dia;
  semana: number;
  vigente: boolean;
};

type PendienteRow = {
  progreso_id: string;
  nombre: string;
  telefono: string | null;
  llamada1?: Resultado | null;
  llamada2?: Resultado | null;
  llamada3?: Resultado | null;
};
type PendRowUI = PendienteRow & { _ui?: 'new' | 'changed' };

type AgendadoRow = {
  progreso_id: string;
  nombre: string;
  telefono: string | null;
  semana: number;
};

/* ================= Constantes (mismas vistas/RPCs que Maestros) ================= */
const V_PEND_HIST = 'v_llamadas_pendientes_hist';
const V_PEND_BASE = 'v_llamadas_pendientes';
const V_AGENDADOS = 'v_agendados';
const RPC_GUARDAR_LLAMADA = 'fn_guardar_llamada';
const RPC_ASIST = 'fn_marcar_asistencia';

const resultadoLabels: Record<Resultado, string> = {
  confirmo_asistencia: 'CONFIRMÓ ASISTENCIA',
  no_contesta: 'NO CONTESTA',
  no_por_ahora: 'NO POR AHORA',
  llamar_de_nuevo: 'LLAMAR DE NUEVO',
  salio_de_viaje: 'SALIO DE VIAJE',
  ya_esta_en_ptmd: 'YA ESTÁ EN PTMD',
  no_tiene_transporte: 'NO TIENE $ TRANSPORTE',
  vive_fuera: 'VIVE FUERA DE LA CIUDAD',
  murio: 'MURIÓ',
  rechazado: 'NO ME INTERESA',
};

/* ================= Helpers ================= */
const normalizeCedula = (s: string) => (s || '').replace(/\D+/g, '');
const norm = (t: string) =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function etapaToBase(etapa: string): { etapaBase: 'Semillas' | 'Devocionales' | 'Restauracion'; modulo?: 1 | 2 | 3 | 4 } {
  const t = norm(etapa);
  if (t.startsWith('semilla')) {
    const n = Number((t.match(/\d+/)?.[0] ?? '1'));
    return { etapaBase: 'Semillas', modulo: Math.min(4, Math.max(1, n)) as 1 | 2 | 3 | 4 };
  }
  if (t.startsWith('devocional')) return { etapaBase: 'Devocionales' };
  return { etapaBase: 'Restauracion' };
}

function matchAsigRow(row: any, asig: AsignacionContacto | null, d: Dia | null, s: Semana | null) {
  if (!row || !asig || !d || !s) return false;
  const { etapaBase, modulo } = etapaToBase(asig.etapa);
  return (
    row.dia === d &&
    row.semana === s &&
    row.etapa === etapaBase &&
    (etapaBase === 'Restauracion' || row.modulo === modulo) &&
    row.activo !== false
  );
}

/* ================= Página Contactos ================= */
export default function ContactosClient({ cedula: cedulaProp, rtlog = false }: { cedula?: string; rtlog?: boolean }) {
  const cedula = normalizeCedula(cedulaProp ?? '');

  const [nombre, setNombre] = useState('');
  const [asig, setAsig] = useState<AsignacionContacto | null>(null);
  const [semana, setSemana] = useState<Semana | null>(null);
  const [dia, setDia] = useState<Dia | null>(null);

  const [loadingPend, setLoadingPend] = useState(false);
  const [pendientes, setPendientes] = useState<PendRowUI[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [loadingAg, setLoadingAg] = useState(false);
  const [agendados, setAgendados] = useState<AgendadoRow[]>([]);
  const [marks, setMarks] = useState<Record<string, 'A' | 'N' | undefined>>({});
  const [savingAg, setSavingAg] = useState(false);

  // Refs “vivos” para handlers
  const semanaRef = useRef<Semana | null>(semana);
  const diaRef = useRef<Dia | null>(dia);
  const asigRef = useRef<AsignacionContacto | null>(asig);
  const pendRef = useRef<PendRowUI[]>([]);
  useEffect(() => { semanaRef.current = semana; }, [semana]);
  useEffect(() => { diaRef.current = dia; }, [dia]);
  useEffect(() => { asigRef.current = asig; }, [asig]);
  useEffect(() => { pendRef.current = pendientes; }, [pendientes]);

  const log = (...args: any[]) => { if (rtlog) console.log('[RT contactos]', ...args); };

  // limpiar resaltado "_ui" tras unos segundos
  const clearTimersRef = useRef<Record<string, number>>({});
  const scheduleClearUI = (id: string, ms = 6000) => {
    if (clearTimersRef.current[id]) window.clearTimeout(clearTimersRef.current[id]);
    clearTimersRef.current[id] = window.setTimeout(() => {
      setPendientes(prev => prev.map(p => p.progreso_id === id ? ({ ...p, _ui: undefined }) : p));
      delete clearTimersRef.current[id];
    }, ms);
  };

  /* ====== Cargar servidor + asignación vigente ====== */
  useEffect(() => {
    (async () => {
      if (!cedula) return;

      // 1) Intentar asignaciones_contacto (si existe)
      let asigVig: AsignacionContacto | null = null;
      const q1 = await supabase
        .from('servidores')
        .select('id,nombre,asignaciones_contacto:asignaciones_contacto(etapa,dia,semana,vigente)')
        .eq('cedula', cedula)
        .maybeSingle();

      if (!q1.error && q1.data) {
        setNombre((q1.data as any).nombre ?? '');
        asigVig = ((q1.data as any).asignaciones_contacto ?? []).find((a: AsignacionContacto) => a.vigente) ?? null;
      }

      // 2) Fallback: si no hay asignaciones_contacto vigentes, intenta asignaciones_maestro (mantener consistencia con Maestros)
      if (!asigVig) {
        const q2 = await supabase
          .from('servidores')
          .select('id,nombre,asignaciones_maestro:asignaciones_maestro(etapa,dia,vigente)')
          .eq('cedula', cedula)
          .maybeSingle();
        if (!q2.error && q2.data) {
          setNombre((q2.data as any).nombre ?? (q1.data as any)?.nombre ?? '');
          const a = ((q2.data as any).asignaciones_maestro ?? []).find((x: any) => x.vigente) ?? null;
          if (a) {
            const { etapaBase, modulo } = etapaToBase(a.etapa);
            asigVig = { etapa: etapaBase === 'Semillas' ? `Semilla ${modulo ?? 1}` : a.etapa, dia: a.dia, semana: 1, vigente: true };
          }
        }
      }

      if (!asigVig) {
        // sin asignación → no mostramos nada (igual que Maestros redirige)
        return;
      }

      setAsig(asigVig);
      setSemana((asigVig.semana as Semana) ?? 1);
      setDia(asigVig.dia);
    })();
  }, [cedula]);

  const titulo = useMemo(() => asig?.etapa ?? '', [asig]);

  /* ====== Fetchers (idéntico a Maestros) ====== */
  const fetchPendientes = useCallback(
    async (s: Semana, d: Dia, opts?: { quiet?: boolean }) => {
      if (!asig) return;
      if (!opts?.quiet) setLoadingPend(true);

      const { etapaBase, modulo } = etapaToBase(asig.etapa);

      const [{ data: hist }, { data: base }] = await Promise.all([
        supabase
          .from(V_PEND_HIST)
          .select('progreso_id,nombre,telefono,llamada1,llamada2,llamada3')
          .eq('semana', s)
          .eq('dia', d)
          .order('nombre', { ascending: true }),
        (() => {
          let q = supabase
            .from(V_PEND_BASE)
            .select('progreso_id')
            .eq('etapa', etapaBase)
            .eq('semana', s)
            .eq('dia', d);
          if (etapaBase !== 'Restauracion') q = (q as any).eq('modulo', modulo);
          return q;
        })(),
      ]);

      const allowed = new Set((base ?? []).map((r: any) => r.progreso_id));
      const draft = ((hist ?? []) as PendienteRow[]).filter((r) => allowed.has(r.progreso_id));

      // reconciliar para “new/changed”
      const prev = pendRef.current;
      const prevById = new Map(prev.map(p => [p.progreso_id, p]));
      const next: PendRowUI[] = draft.map((r) => {
        const old = prevById.get(r.progreso_id);
        let _ui: 'new' | 'changed' | undefined;
        if (!old) _ui = 'new';
        else if (
          old.llamada1 !== r.llamada1 ||
          old.llamada2 !== r.llamada2 ||
          old.llamada3 !== r.llamada3 ||
          old.nombre !== r.nombre ||
          old.telefono !== r.telefono
        ) _ui = 'changed';
        return { ...r, _ui };
      });

      setPendientes(next);
      next.forEach(r => r._ui && scheduleClearUI(r.progreso_id, r._ui === 'new' ? 6000 : 3000));

      if (!opts?.quiet) setLoadingPend(false);
    },
    [asig]
  );

  const fetchAgendados = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!asig || !asig.dia) return;
    if (!opts?.quiet) setLoadingAg(true);

    const { etapaBase, modulo } = etapaToBase(asig.etapa);

    let q = supabase
      .from(V_AGENDADOS)
      .select('progreso_id,nombre,telefono,semana')
      .eq('etapa', etapaBase)
      .eq('dia', asig.dia);
    if (etapaBase !== 'Restauracion') q = (q as any).eq('modulo', modulo);

    const { data } = await q.order('nombre', { ascending: true });
    setAgendados(((data ?? []) as AgendadoRow[]));
    if (!opts?.quiet) setLoadingAg(false);
  }, [asig]);

  useEffect(() => { if (dia && semana) void fetchPendientes(semana, dia, { quiet: false }); }, [semana, dia, fetchPendientes]);
  useEffect(() => { void fetchAgendados({ quiet: false }); }, [fetchAgendados]);

  /* ====== Acciones ====== */
  const enviarResultado = async (payload: { resultado: Resultado; notas?: string }) => {
    const row = pendRef.current.find((p) => p.progreso_id === selectedId);
    if (!row || !semana || !dia) return;

    const esConfirmado = payload.resultado === 'confirmo_asistencia';

    // Optimista: refleja al toque en “agendados”
    setAgendados((prev) => {
      const yaEsta = prev.some((a) => a.progreso_id === row.progreso_id);
      if (esConfirmado) {
        return yaEsta
          ? prev
          : [...prev, { progreso_id: row.progreso_id, nombre: row.nombre, telefono: row.telefono, semana }];
      } else {
        return prev.filter((a) => a.progreso_id !== row.progreso_id);
      }
    });

    setSaving(true);
    try {
      const { error } = await supabase.rpc(RPC_GUARDAR_LLAMADA, {
        p_progreso: row.progreso_id,
        p_semana: semana,
        p_dia: dia,
        p_resultado: payload.resultado,
        p_notas: payload.notas ?? null,
      });
      if (error) throw error;

      await Promise.all([
        fetchPendientes(semana, dia, { quiet: true }),
        fetchAgendados({ quiet: true }),
      ]);
      setSelectedId(null);
    } catch (e: any) {
      // rollback optimista si falló
      setAgendados((prev) => prev.filter((a) => a.progreso_id !== row.progreso_id));
      alert(e?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleMark = (id: string, tipo: 'A' | 'N') =>
    setMarks((m) => ({ ...m, [id]: m[id] === tipo ? undefined : tipo }));

  const enviarAsistencias = async () => {
    const entradas = Object.entries(marks).filter(([, v]) => v);
    if (entradas.length === 0) return;
    setSavingAg(true);
    try {
      for (const [progId, v] of entradas) {
        const { error } = await supabase.rpc(RPC_ASIST, { p_progreso: progId, p_asistio: v === 'A' });
        if (error) throw error;
      }
      setMarks({});
      await fetchAgendados({ quiet: true });
    } finally {
      setSavingAg(false);
    }
  };

  /* ====== Realtime — calcado a Maestros (con gancho a transition_log) ====== */
  useEffect(() => {
    if (!asig) return;

    // Parche fino al INSERT (usa payload; si no cuadra filtros, se ignora)
    const tryPatchProgresoInsert = async (row: any) => {
      if (!matchAsigRow(row, asigRef.current, diaRef.current, semanaRef.current)) return;
      if (pendRef.current.some(p => p.progreso_id === row.id)) return;

      const { data: per } = await supabase
        .from('persona')
        .select('id,nombre,telefono')
        .eq('id', row.persona_id)
        .maybeSingle();

      const nuevo: PendRowUI = {
        progreso_id: row.id,
        nombre: per?.nombre ?? '—',
        telefono: per?.telefono ?? null,
        llamada1: null, llamada2: null, llamada3: null,
        _ui: 'new',
      };
      setPendientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      scheduleClearUI(row.id, 6000);
    };

    // Parche fino al UPDATE (Entrada/salida del set visible)
    const tryPatchProgresoUpdate = async (oldRow: any, newRow: any) => {
      const a = asigRef.current, d = diaRef.current, s = semanaRef.current;
      const oldMatch = matchAsigRow(oldRow, a, d, s);
      const newMatch = matchAsigRow(newRow, a, d, s);

      if (!oldMatch && newMatch) {
        if (!pendRef.current.some(p => p.progreso_id === newRow.id)) {
          const { data: per } = await supabase
            .from('persona').select('id,nombre,telefono')
            .eq('id', newRow.persona_id).maybeSingle();
          const nuevo: PendRowUI = {
            progreso_id: newRow.id,
            nombre: per?.nombre ?? '—',
            telefono: per?.telefono ?? null,
            llamada1: null, llamada2: null, llamada3: null,
            _ui: 'new',
          };
          setPendientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          scheduleClearUI(newRow.id, 6000);
        }
        return;
      }
      if (oldMatch && !newMatch) {
        setPendientes(prev => prev.filter(p => p.progreso_id !== newRow.id));
        if (selectedId === newRow.id) setSelectedId(null);
        return;
      }
      if (newMatch) refreshQuiet();
    };

    // Debounce para sync de vistas
    let t: number | null = null;
    const refreshQuiet = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(async () => {
        const d = diaRef.current as Dia | null;
        const s = semanaRef.current as Semana | null;
        if (asigRef.current && d && s) {
          await fetchPendientes(s, d, { quiet: true });
          await fetchAgendados({ quiet: true });
        }
      }, 150);
    };

    const ch = supabase.channel(`rt-maestros-${normalizeCedula(cedula)}`); // mismo esquema que Maestros

    // Logs (activa pasando prop rtlog={true})
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'progreso' }, (p) => {
      const oldId = (p?.old as any)?.id;
      const newId = (p?.new as any)?.id;
      log('ev:progreso', p?.eventType, { old: oldId, new: newId });
    });

    // INSERT progreso → parche fino
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'progreso' }, (payload) => {
      tryPatchProgresoInsert(payload.new);
    });

    // UPDATE progreso → si trae old/new, parche fino; si no, refresh (igual que Maestros) :contentReference[oaicite:2]{index=2}
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'progreso' }, (payload) => {
      if (payload.old && payload.new) void tryPatchProgresoUpdate(payload.old, payload.new);
      else refreshQuiet();
    });

    // DELETE → refresh
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'progreso' }, () => refreshQuiet());

    // transition_log: refuerzo S1→S2 (lee progreso por id y simula UPDATE) :contentReference[oaicite:3]{index=3}
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transition_log' }, async (payload) => {
      const progId = payload.new?.progreso_id;
      if (!progId) return;
      const { data: row } = await supabase.from('progreso').select('*').eq('id', progId).maybeSingle();
      if (row) await tryPatchProgresoUpdate({}, row);
      refreshQuiet();
    });

    // Otros que afectan vistas → refresh silencioso (igual que Maestros) :contentReference[oaicite:4]{index=4}
    ['llamada_intento', 'asistencia', 'persona', 'asignaciones_maestro', 'asignaciones_contacto'].forEach((tbl) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: tbl }, () => refreshQuiet());
    });

    ch.subscribe((status) => {
      log('channel:status', status);
      if (status === 'SUBSCRIBED') refreshQuiet();
    });

    return () => {
      ch.unsubscribe();
      if (t) window.clearTimeout(t);
      Object.values(clearTimersRef.current).forEach(id => window.clearTimeout(id));
      clearTimersRef.current = {};
    };
  }, [asig, cedula, fetchPendientes, fetchAgendados, selectedId]);

  /* ========================= UI ========================= */
  if (!cedula) {
    return <main className="min-h-[100dvh] grid place-items-center"><div>Falta la cédula.</div></main>;
  }
  if (!asig || !dia || !semana) {
    return <main className="min-h-[100dvh] grid place-items-center"><div>Cargando asignación…</div></main>;
  }

  return (
    <main
      className="min-h-[100dvh] px-5 md:px-8 py-6 bg-[radial-gradient(1200px_800px_at_-10%_-10%,#e9f0ff,transparent_60%),radial-gradient(1200px_900px_at_110%_10%,#ffe6f4,transparent_55%),linear-gradient(120deg,#f4f7ff,#fef6ff_50%,#eefaff)]"
      style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,'Helvetica Neue',Arial,sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[1260px]">
        {/* Encabezado */}
        <section className="mb-6 md:mb-8">
          <div className="text-[32px] md:text-[44px] font-black leading-none tracking-tight bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 text-transparent bg-clip-text drop-shadow-sm">
            Panel de Contactos
          </div>
          <div className="mt-1 text-[18px] md:text-[22px] font-medium text-neutral-700">
            Bienvenido, <b className="text-neutral-900">{nombre || 'Contacto'}</b>
          </div>
        </section>

        {/* Header con filtros bloqueados a la asignación */}
        <header className="mb-3 md:mb-4 flex items-baseline gap-3">
          <h1 className="text-[22px] md:text-[28px] font-semibold text-neutral-900">
            Llamadas pendientes {titulo}
          </h1>
          <span className="text-neutral-500 text-sm">Semana {semana} • {dia}</span>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-neutral-600">Semana:</span>
            {[1, 2, 3].map((n) => {
              const disabled = n !== semana;
              return (
                <button
                  key={n}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ring-1 ring-black/10 shadow-sm transition
                    ${semana === n ? 'bg-neutral-900 text-white' : 'bg-white'}
                    ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-neutral-600">Día:</span>
            {(['Domingo', 'Martes', 'Virtual'] as Dia[]).map((d) => {
              const disabled = d !== dia;
              return (
                <button
                  key={d}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ring-1 ring-black/10 shadow-sm transition
                    ${dia === d ? 'bg-neutral-900 text-white' : 'bg-white'}
                    ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista + Panel derecho */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {/* Lista */}
          <section className="rounded-[16px] bg-white shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5">
            <header className="px-4 md:px-5 py-3 border-b border-black/5 bg-[linear-gradient(135deg,#eaf3ff,#f6efff)]">
              <h3 className="text-base md:text-lg font-semibold text-neutral-900">Llamadas pendientes</h3>
              <p className="text-neutral-600 text-xs md:text-sm">
                {loadingPend ? 'Cargando…' : 'Selecciona un contacto para registrar la llamada.'}
              </p>
            </header>

            {pendientes.length === 0 ? (
              <div className="p-6 text-neutral-500">No hay llamadas con los filtros actuales.</div>
            ) : (
              <ul className="divide-y divide-black/5">
                {pendientes.map((c) => (
                  <li
                    key={c.progreso_id}
                    className={`px-4 md:px-5 py-3 hover:bg-neutral-50 cursor-pointer transition
                      ${selectedId === c.progreso_id ? 'bg-neutral-50' : ''}
                      ${c._ui === 'new' ? 'animate-fadeInScale ring-2 ring-emerald-300/60'
                        : c._ui === 'changed' ? 'animate-flashBg' : ''}`}
                    onClick={() => setSelectedId(c.progreso_id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
                          c._ui === 'new' ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.25)]' : 'bg-amber-500 shadow-[0_0_0_3px_rgba(251,191,36,.25)]'
                        }`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-neutral-800 leading-tight truncate">{c.nombre}</div>
                          <div className="mt-0.5 inline-flex items-center gap-1.5 text-neutral-600 text-xs md:text-sm">
                            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="opacity-80">
                              <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
                            </svg>
                            <span className="truncate">{c.telefono ?? '—'}</span>
                          </div>
                          {c._ui === 'new' && (
                            <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                              Nuevo
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right text-[11px] md:text-xs text-neutral-500 leading-5">
                        {[c.llamada1 ?? null, c.llamada2 ?? null, c.llamada3 ?? null].map((r, idx) => (
                          <div key={idx}>
                            <span className="mr-1">Llamada {idx + 1}:</span>
                            {r ? (
                              <span className="font-medium text-neutral-700">{resultadoLabels[r as Resultado]}</span>
                            ) : (
                              <span className="italic">sin registro</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Panel derecho */}
          <section className="rounded-[16px] bg-white shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5 p-4 md:p-5">
            {!selectedId ? (
              <div className="grid place-items-center text-neutral-500 h-full">
                Selecciona un nombre de la lista para llamar / registrar.
              </div>
            ) : (
              <FollowUp
                semana={semana}
                dia={dia}
                row={pendRef.current.find((p) => p.progreso_id === selectedId)!}
                saving={saving}
                onSave={enviarResultado}
              />
            )}
          </section>
        </div>

        {/* ===== Asistencias ===== */}
        <section className="mt-6 animate-cardIn rounded-[18px] ring-1 ring-black/5 shadow-[0_12px_30px_-16px_rgba(16,24,40,.28)] overflow-hidden bg-white">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-[linear-gradient(135deg,#eaf3ff,#f8f1ff)]">
            <div>
              <h3 className="text-[15px] md:text-base font-semibold text-neutral-900">
                Listado Estudiantes Día {asig.dia} — {etapaToBase(asig.etapa).etapaBase}{' '}
                {etapaToBase(asig.etapa).modulo ?? ''}
              </h3>
              <p className="text-neutral-500 text-xs">Agendados que confirmaron asistencia.</p>
            </div>
            <div className="text-sm font-semibold rounded-full bg-white px-3 py-1.5 ring-1 ring-black/10 shadow-sm">
              {asig.dia}
            </div>
          </div>

          {loadingAg ? (
            <div className="px-4 md:px-6 py-10 text-center text-neutral-500">Cargando…</div>
          ) : agendados.length === 0 ? (
            <div className="px-4 md:px-6 py-10 text-center text-neutral-500">No hay agendados para tu día asignado.</div>
          ) : (
            <>
              <ul className="divide-y divide-black/5">
                {agendados.map((e) => (
                  <li key={e.progreso_id} className="px-4 md:px-6 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-800 truncate">{e.nombre}</div>
                      <div className="text-neutral-500 text-xs md:text-sm">{e.telefono ?? '—'}</div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm mr-3">
                      <input
                        type="checkbox"
                        checked={marks[e.progreso_id] === 'A'}
                        onChange={() => toggleMark(e.progreso_id, 'A')}
                        className="accent-emerald-600"
                      />
                      Asistió
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={marks[e.progreso_id] === 'N'}
                        onChange={() => toggleMark(e.progreso_id, 'N')}
                        className="accent-rose-600"
                      />
                      No asistió
                    </label>
                  </li>
                ))}
              </ul>

              <div className="px-4 md:px-6 py-3 bg-neutral-50">
                <button
                  disabled={savingAg}
                  onClick={enviarAsistencias}
                  className="rounded-xl bg-neutral-900 text-white px-4 py-2 shadow-md hover:shadow-lg transition disabled:opacity-60"
                >
                  {savingAg ? 'Enviando…' : 'Enviar Reporte'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Animaciones */}
      <style jsx global>{`
        @keyframes cardIn { 0% { opacity: 0; transform: translateY(14px) scale(0.98); filter: blur(3px); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-cardIn { animation: cardIn .48s cubic-bezier(.22,1,.36,1) both; }

        @keyframes fadeInScale { 0% { opacity: 0; transform: translateY(6px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fadeInScale { animation: fadeInScale .28s ease-out both; }

        @keyframes flashBg { 0% { background-color: #fff6d4; }
          100% { background-color: transparent; } }
        .animate-flashBg { animation: flashBg 1.2s ease-out 1; }
      `}</style>
    </main>
  );
}

/* ================= Panel derecho ================= */
function FollowUp({
  semana, dia, row, saving, onSave,
}: {
  semana: Semana; dia: Dia | null; row: PendienteRow;
  saving: boolean; onSave: (p: { resultado: Resultado; notas?: string }) => Promise<void>;
}) {
  const opciones: { label: string; value: Resultado }[] = [
    { label: 'CONFIRMÓ ASISTENCIA', value: 'confirmo_asistencia' },
    { label: 'NO CONTESTA', value: 'no_contesta' },
    { label: 'NO POR AHORA', value: 'no_por_ahora' },
    { label: 'LLAMAR DE NUEVO', value: 'llamar_de_nuevo' },
    { label: 'SALIO DE VIAJE', value: 'salio_de_viaje' },
    { label: 'YA ESTÁ EN PTMD', value: 'ya_esta_en_ptmd' },
    { label: 'NO TIENE $ TRANSPORTE', value: 'no_tiene_transporte' },
    { label: 'VIVE FUERA DE LA CIUDAD', value: 'vive_fuera' },
    { label: 'MURIÓ', value: 'murio' },
    { label: 'NO ME INTERESA', value: 'rechazado' },
  ];

  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [obs, setObs] = useState('');

  const initials = row.nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U';
  const telHref = row.telefono ? `tel:${row.telefono.replace(/[^\d+]/g, '')}` : null;

  return (
    <div className="animate-cardIn">
      <div className="mb-4 rounded-2xl ring-1 ring-black/5 bg-[linear-gradient(135deg,#eef3ff,#f6efff)] px-4 py-3 md:px-5 md:py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-xl text-white font-bold bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
            {initials}
          </div>
          <div>
            <div className="text-base md:text-lg font-semibold text-neutral-900 leading-tight">{row.nombre}</div>
            <div className="text-[12px] text-neutral-500 leading-none">Semana {semana} • {dia}</div>
            <div className="text-[11px] text-neutral-600 mt-1 space-y-0.5">
              {[row.llamada1 ?? null, row.llamada2 ?? null, row.llamada3 ?? null].map((r, idx) => (
                <div key={idx}>
                  Llamada {idx + 1}:{' '}
                  {r ? <span className="font-medium text-neutral-800">{resultadoLabels[r as Resultado]}</span>
                     : <span className="italic">sin registro</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {telHref ? (
          <a href={telHref} className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm hover:shadow-md transition" title={`Llamar a ${row.telefono}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" /></svg>
            <span>{row.telefono}</span>
          </a>
        ) : (
          <div className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm">—</div>
        )}
      </div>

      <div>
        <label className="text-xs text-neutral-500">Resultado de la llamada</label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {opciones.map((o) => (
            <label key={o.value} className="flex items-center gap-2 rounded-lg ring-1 ring-black/10 bg-neutral-50 px-3 py-2 cursor-pointer">
              <input type="radio" name="resultado" className="accent-blue-600" onChange={() => setResultado(o.value)} checked={resultado === o.value} />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs text-neutral-500">Observaciones</label>
        <textarea
          className="mt-1 w-full min-h-[100px] rounded-lg ring-1 ring-black/10 px-3 py-2 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Escribe aquí las observaciones..."
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button
          disabled={!resultado || saving}
          onClick={() => resultado && onSave({ resultado, notas: obs || undefined })}
          className="rounded-xl bg-neutral-900 text-white px-4 py-2 shadow-md hover:shadow-lg transition disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Enviar informe'}
        </button>
      </div>
    </div>
  );
}
