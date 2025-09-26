


'use client';



// Placeholder visual premium para el panel derecho
const EmptyRightPlaceholder = () => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.45, ease: 'easeOut' }}
    className="h-full grid place-items-center"
    role="status"
    aria-label="Sin selección"
  >
    <div className="w-full max-w-md rounded-2xl p-5 ring-1 ring-white/60 shadow-[0_24px_60px_-30px_rgba(16,24,40,.35)] bg-[linear-gradient(135deg,rgba(255,255,255,.85),rgba(245,247,255,.6))] supports-[backdrop-filter]:backdrop-blur-xl text-center">
      <div className="mx-auto mb-3 h-14 w-14 rounded-2xl grid place-items-center ring-1 ring-white/60 shadow-inner
                      bg-[radial-gradient(120px_120px_at_30%_30%,rgba(99,102,241,.25),transparent),radial-gradient(120px_120px_at_70%_70%,rgba(56,189,248,.22),transparent)]">
        {/* Phone/Ghost icono con sutil latido */}
        <motion.svg
          width="28" height="28" viewBox="0 0 24 24"
          initial={{ scale: 0.96, opacity: 0.9 }}
          animate={{ scale: [0.96, 1.02, 0.96], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-neutral-700"
        >
          <path fill="currentColor" d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z"/>
        </motion.svg>
      </div>

      <h4 className="text-[15px] md:text-base font-semibold text-neutral-900">Nada seleccionado</h4>
      <p className="mt-1 text-sm text-neutral-600">Elige un nombre de la lista para <span className="font-medium">llamar / registrar</span>.</p>

      {/* Pistas rápidas (opcionales, no rompen layout) */}
      <div className="mt-4 flex items-center justify-center gap-2 flex-wrap text-xs">
        <span className="rounded-full px-2.5 py-1 ring-1 ring-white/60 bg-white/80 text-neutral-700">Semana {new Date().getDay() === 0 ? 1 : ''}</span>
        <span className="rounded-full px-2.5 py-1 ring-1 ring-white/60 bg-white/80 text-neutral-700">Día asignado</span>
        <span className="rounded-full px-2.5 py-1 ring-1 ring-white/60 bg-white/80 text-neutral-700">Estados de llamada</span>
      </div>
    </div>
  </motion.div>
);

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';

// Carga dinámica de los formularios
const PersonaNueva = dynamic(() => import('@/app/panel/contactos/page'), { ssr: false });
const Servidores = dynamic(() => import('@/app/panel/servidores/page'), { ssr: false });

/* ================= Tipos ================= */
type Dia = 'Domingo' | 'Martes' | 'Virtual';
type Semana = 1 | 2 | 3; // BD limita a 1..3

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

type AsigMaestro = {
  etapa: string;
  dia: Dia;
  vigente: boolean;
};

type MaestroAsignacion = {
  etapaDet: string;
  etapaBase: 'Semillas' | 'Devocionales' | 'Restauracion';
  modulo: 1 | 2 | 3 | 4;
  dia: Dia;
};

type PendienteRow = {
  progreso_id: string;
  nombre: string | undefined; // <-- permitir undefined para hardening
  telefono: string | null;
  llamada1?: Resultado | null;
  llamada2?: Resultado | null;
  llamada3?: Resultado | null;
  habilitado_desde?: string | null;
};
// Helper para inhabilitación semanal
function estaInhabilitado(h?: string | null) {
  if (!h) return false;
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset()*60000)
    .toISOString().slice(0, 10);
  return h > todayStr;
}
type PendRowUI = PendienteRow & { _ui?: 'new' | 'changed' };

type AgendadoRow = {
  progreso_id: string;
  nombre: string | undefined; // <-- permitir undefined para hardening
  telefono: string | null;
  semana: number;
};

/** ======== Banco Archivo ======== */
type BancoRow = {
  progreso_id: string;
  persona_id: string;
  nombre: string | undefined; // <-- permitir undefined
  telefono: string | null;
  modulo: 1 | 2 | 3 | 4 | null;
  semana: number | null;
  dia: Dia;
  creado_en: string;
  etapa: 'Semillas' | 'Devocionales' | 'Restauracion';
};

/* ================= Constantes ================= */
const V_PEND_HIST   = 'v_llamadas_pendientes_hist';
const V_PEND_BASE   = 'v_llamadas_pendientes';
const V_AGENDADOS   = 'v_agendados';
const RPC_GUARDAR_LLAMADA = 'fn_guardar_llamada';
const RPC_ASIST     = 'fn_marcar_asistencia';



const MAC2025_PANEL_VARIANTS = {
  initial: {
    opacity: 0,
    y: 48,
    scale: 0.98,
    filter: 'blur(10px)',
    boxShadow: '0 12px 36px -12px rgba(30,41,59,0.10)'
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    boxShadow: '0 24px 80px -24px rgba(30,41,59,0.18)',
    transition: { duration: 0.32 }
  },
  exit: {
    opacity: 0,
    y: -32,
    scale: 0.97,
    filter: 'blur(8px)',
    boxShadow: '0 12px 36px -12px rgba(30,41,59,0.08)',
    transition: { duration: 0.22 }
  }
};

/** ======== Banco Archivo (constantes) ======== */
/** Vista que lista archivados visibles para este panel */
const V_BANCO = 'v_banco_archivo';
/** RPC que re-activa un registro desde Banco Archivo hacia el panel actual */
const RPC_REACTIVAR = 'fn_reactivar_desde_archivo';

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


// Easing idéntico al del formulario Maestros
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;
const EASE_EXIT   = [0.7, 0, 0.84, 0] as const;

// Animación del panel izquierdo completo
const LEFT_PANEL_VARIANTS = {
  initial: { opacity: 0, x: 160, scale: 0.96, filter: 'blur(14px)' },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: EASE_SMOOTH }
  },
  exit: {
    opacity: 0,
    x: -110,
    scale: 0.97,
    filter: 'blur(10px)',
    transition: { duration: 0.45, ease: EASE_EXIT }
  }
};

// Stagger para la lista
const LIST_WRAPPER_VARIANTS = {
  initial: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
  animate: { transition: { delayChildren: 0.12, staggerChildren: 0.055 } }
};

// Entrada de cada item
const LIST_ITEM_VARIANTS = {
  initial: { opacity: 0, x: 28, y: 14, scale: 0.97 },
  animate: {
    opacity: 1, x: 0, y: 0, scale: 1,
    transition: { duration: 0.5, ease: EASE_SMOOTH }
  }
};


/* ================= Helpers ================= */
const normalizeCedula = (s: string) => (s || '').replace(/\D+/g, '');
const norm = (t: string) =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** "Semilla 3" | "Devocionales 2" | "Restauracion 1" -> etapaBase + módulo */
function mapEtapaDetToBase(etapaDet: string): {
  etapaBase: 'Semillas' | 'Devocionales' | 'Restauracion';
  modulo: 1 | 2 | 3 | 4;
  hasModulo: boolean;
} {
  const t = norm(etapaDet);

  if (t.startsWith('semilla')) {
    const num = Number((t.match(/\d+/)?.[0] ?? '1'));
    return { etapaBase: 'Semillas', modulo: Math.min(4, Math.max(1, num)) as 1 | 2 | 3 | 4, hasModulo: true };
  }

  if (t.startsWith('devocional')) {
    const num = Number((t.match(/\d+/)?.[0] ?? '1'));
    return { etapaBase: 'Devocionales', modulo: Math.min(4, Math.max(1, num)) as 1 | 2 | 3 | 4, hasModulo: true };
  }

  return { etapaBase: 'Restauracion', modulo: 1, hasModulo: false };
}

/** Coincidencia de un row de `progreso` con la asignación/día/semana actual */
function matchAsigRow(
  row: any,
  asig: MaestroAsignacion,
  d: Dia | null,
  s: Semana | null
) {
  return (
    row &&
    d &&
    s &&
    row.dia === d &&
    row.semana === s &&
    row.etapa === asig.etapaBase &&
    (asig.etapaBase === 'Restauracion' || row.modulo === asig.modulo) &&
    row.activo !== false
  );
}

/* ================= Página ================= */
export default function Contactos1Client(
  {
    cedula: cedulaProp,
    etapaInicial,
    diaInicial,
    semanaInicial,
  }: {
    cedula?: string;
    etapaInicial?: string;
    diaInicial?: string; // validado internamente a 'Domingo' | 'Martes' | 'Virtual'
    semanaInicial?: number; // validado internamente a 1 | 2 | 3
  }
) {
  // Estado para modales Persona Nueva y Servidores (debe estar dentro del componente)
  const [nuevaAlmaOpen, setNuevaAlmaOpen] = useState(false);
  const [servidoresOpen, setServidoresOpen] = useState(false);
  // Modal premium para inhabilitados
  const [showNextWeekModal, setShowNextWeekModal] = useState(false);

  const router = useRouter();
  const cedula = normalizeCedula(cedulaProp ?? '');
  const rtDebug = false;
  const rtLog = (...args: any[]) => { if (rtDebug) console.log('[RT contactos1]', ...args); };

  const [nombre, setNombre] = useState('');
  const [asig, setAsig] = useState<MaestroAsignacion | null>(null);

  const [semana, setSemana] = useState<Semana>(1);
  const [dia, setDia] = useState<Dia | null>(null);

  // llamadas
  const [loadingPend, setLoadingPend] = useState(false);
  const [pendientes, setPendientes] = useState<PendRowUI[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // asistencias
  const [loadingAg, setLoadingAg] = useState(false);
  const [agendados, setAgendados] = useState<AgendadoRow[]>([]);
  const [marks, setMarks] = useState<Record<string, 'A' | 'N' | undefined>>({});
  const [savingAg, setSavingAg] = useState(false);
  // Ref al panel derecho para llevarlo a la vista en móviles
  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  /** ======== Banco Archivo (estado) ======== */
  const [bancoOpen, setBancoOpen] = useState(false);
  const [bancoLoading, setBancoLoading] = useState(false);
  const [bancoRows, setBancoRows] = useState<BancoRow[]>([]);
  const [reactivating, setReactivating] = useState<Record<string, boolean>>({});
  const [servidorId, setServidorId] = useState<string | null>(null);

  // refs para estado “vivo” dentro de handlers realtime
  const semanaRef = useRef(semana);
  const diaRef = useRef<Dia | null>(dia);
  const asigRef = useRef<MaestroAsignacion | null>(null);
  const pendRef = useRef<PendRowUI[]>([]);
  useEffect(() => { semanaRef.current = semana; }, [semana]);
  useEffect(() => { diaRef.current = dia; }, [dia]);
  useEffect(() => { asigRef.current = asig; }, [asig]);
  useEffect(() => { pendRef.current = pendientes; }, [pendientes]);
  // Cuando se selecciona un registro, mostrar el panel derecho y hacer scroll en móviles
  useEffect(() => {
    if (selectedId) {
      // Pequeño delay para asegurar que la sección esté renderizada
      setTimeout(() => {
        try {
          rightPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {}
      }, 0);
    }
  }, [selectedId]);

  // Inicializar con props opcionales, validando valores
  useEffect(() => {
    // Semana: solo 1..3
    if (typeof semanaInicial === 'number' && [1, 2, 3].includes(semanaInicial)) {
      const w = semanaInicial as Semana;
      if (semanaRef.current !== w) setSemana(w);
    }

    // Día: solo valores permitidos
    if (diaInicial === 'Domingo' || diaInicial === 'Martes' || diaInicial === 'Virtual') {
      const d = diaInicial as Dia;
      if (diaRef.current !== d) setDia(d);
    }

    // Etapa: si hay también día, podemos armar una asignación inicial
    if (etapaInicial && (diaInicial === 'Domingo' || diaInicial === 'Martes' || diaInicial === 'Virtual')) {
      const base = mapEtapaDetToBase(etapaInicial);
      const initAsig: MaestroAsignacion = {
        etapaDet: etapaInicial,
        etapaBase: base.etapaBase,
        modulo: base.modulo,
        dia: diaInicial as Dia,
      };
      setAsig(prev => prev ?? initAsig);
    }
  }, [etapaInicial, diaInicial, semanaInicial]);

  // limpiar resaltado "_ui"
  const clearTimersRef = useRef<Record<string, number>>({});
  const scheduleClearUI = (id: string, ms = 6000) => {
    if (clearTimersRef.current[id]) window.clearTimeout(clearTimersRef.current[id]);
    clearTimersRef.current[id] = window.setTimeout(() => {
      setPendientes(prev => prev.map(p => p.progreso_id === id ? ({ ...p, _ui: undefined }) : p));
      delete clearTimersRef.current[id];
    }, ms);
  };

  /** Para marcar “Nuevo” cuando viene de reactivación */
  const rtNewRef = useRef<Set<string>>(new Set());

  // Cargar asignación del contacto (y servidorId para reactivar)
  useEffect(() => {
    (async () => {
      if (!cedula) return;
      const { data, error } = await supabase
        .from('servidores')
        .select('id,nombre,asignaciones_contacto:asignaciones_contacto(etapa,dia,semana,vigente),asignaciones_maestro:asignaciones_maestro(etapa,dia,vigente)')
        .eq('cedula', cedula)
        .maybeSingle();

      if (error || !data) {
        router.replace('/login');
        return;
      }

      setNombre((data as any).nombre ?? '');
      setServidorId((data as any).id ?? null);

      // Preferir asignación de contactos vigente
      const ac = (data as any).asignaciones_contacto?.find((x: any) => x.vigente);
      if (ac) {
        const baseC = mapEtapaDetToBase(ac.etapa);
        const asignC: MaestroAsignacion = {
          etapaDet: ac.etapa,
          etapaBase: baseC.etapaBase,
          modulo: baseC.modulo,
          dia: ac.dia,
        };
        setAsig(asignC);
        setDia(asignC.dia);
        setSemana(((ac.semana as number) || 1) as Semana);
        return;
      }

      // Fallback: asignación maestro vigente
      const a = (data as any).asignaciones_maestro?.find((x: AsigMaestro) => x.vigente) as AsigMaestro | undefined;
      if (!a) {
        // Sin asignación: no redirigir, solo no mostrar datos
        return;
      }
      const base = mapEtapaDetToBase(a.etapa);
      const asign: MaestroAsignacion = {
        etapaDet: a.etapa,
        etapaBase: base.etapaBase,
        modulo: base.modulo,
        dia: a.dia,
      };
      setAsig(asign);
      setDia(asign.dia);
    })();
  }, [cedula, router]);

  const titulo = useMemo(() => asig?.etapaDet ?? '', [asig]);

  /* ====== Fetchers ====== */
  const fetchPendientes = useCallback(
    async (s: Semana, d: Dia, opts?: { quiet?: boolean }) => {
      if (!asig) return;
      if (!opts?.quiet) setLoadingPend(true);

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
            .eq('etapa', asig.etapaBase)
            .eq('semana', s)
            .eq('dia', d);
          if (asig.etapaBase !== 'Restauracion') q = (q as any).eq('modulo', asig.modulo);
          return q;
        })(),
      ]);

      const allowed = new Set((base ?? []).map((r: any) => r.progreso_id));
      const draft = ((hist ?? []) as PendienteRow[]).filter((r) => allowed.has(r.progreso_id));

      // --- merge habilitado_desde ---
      let byId = new Map<string, string | null>();
      try {
        const ids = draft.map(r => r.progreso_id);
        if (ids.length) {
          const { data: fechas, error: e3 } = await supabase.rpc('fn_progreso_hab_desde', { ids });
          if (!e3) byId = new Map((fechas ?? []).map((f: any) => [f.id, f.habilitado_desde ?? null]));
        }
      } catch {}

      const prev = pendRef.current;
      const prevById = new Map(prev.map(p => [p.progreso_id, p]));
      const next: PendRowUI[] = draft.map((r) => {
        const old = prevById.get(r.progreso_id);
        const mergedHabDesde = byId.get(r.progreso_id) ?? old?.habilitado_desde ?? null;
        let _ui: 'new' | 'changed' | undefined;
        if (rtNewRef.current.has(r.progreso_id)) {
          _ui = 'new';
          rtNewRef.current.delete(r.progreso_id);
        } else if (!old) _ui = 'new';
        else if (
          old.llamada1 !== r.llamada1 ||
          old.llamada2 !== r.llamada2 ||
          old.llamada3 !== r.llamada3 ||
          old.nombre !== r.nombre ||
          old.telefono !== r.telefono
        ) _ui = 'changed';
        return { ...r, habilitado_desde: mergedHabDesde, _ui };
      });

      next.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));

      setPendientes(next);
      next.forEach(r => r._ui && scheduleClearUI(r.progreso_id, r._ui === 'new' ? 6000 : 3000));

      if (!opts?.quiet) setLoadingPend(false);
    },
    [asig]
  );

  const fetchAgendados = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!asig || !asig.dia) return;
    if (!opts?.quiet) setLoadingAg(true);

    let q = supabase
      .from(V_AGENDADOS)
      .select('progreso_id,nombre,telefono,semana')
      .eq('etapa', asig.etapaBase)
      .eq('dia', asig.dia);
    if (asig.etapaBase !== 'Restauracion') q = (q as any).eq('modulo', asig.modulo);

    const { data } = await q.order('nombre', { ascending: true });
    setAgendados(((data ?? []) as AgendadoRow[]));
    if (!opts?.quiet) setLoadingAg(false);
  }, [asig]);

  useEffect(() => { if (dia) void fetchPendientes(semana, dia, { quiet: false }); }, [semana, dia, fetchPendientes]);
  useEffect(() => { void fetchAgendados({ quiet: false }); }, [fetchAgendados]);

  /* ====== Acciones ====== */
  const enviarResultado = async (payload: { resultado: Resultado; notas?: string }) => {
    const row = pendRef.current.find((p) => p.progreso_id === selectedId);
    if (!row || !semana || !dia) return;

    const esConfirmado = payload.resultado === 'confirmo_asistencia';

    // Optimista en UI
    setAgendados((prev) => {
      const yaEsta = prev.some((a) => a.progreso_id === row.progreso_id);
      const nombreSafe = row.nombre ?? '—';
      if (esConfirmado) {
        return yaEsta
          ? prev
          : [...prev, { progreso_id: row.progreso_id, nombre: nombreSafe, telefono: row.telefono, semana }];
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
        const { error } = await supabase.rpc(RPC_ASIST, {
          p_progreso: progId,
          p_asistio: v === 'A',
        });
        if (error) throw error;
      }
      setMarks({});
      await fetchAgendados({ quiet: true });
    } finally {
      setSavingAg(false);
    }
  };       

  /* ====== Realtime ====== */
  useEffect(() => {
    if (!asig) return;

    // ---- parches finos ----
  const tryPatchProgresoInsert = async (row: any) => {
      const a = asigRef.current;
      const d = diaRef.current;
      const s = semanaRef.current;
      if (!a) return;

      if (!matchAsigRow(row, a, d, s)) return;

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
        llamada1: null,
        llamada2: null,
        llamada3: null,
        habilitado_desde: row.habilitado_desde ?? null,
        _ui: 'new',
      };

      setPendientes(prev => [...prev, nuevo].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
      scheduleClearUI(row.id, 6000);
    };

  const tryPatchProgresoUpdate = async (oldRow: any, newRow: any) => {
      const a = asigRef.current;
      const d = diaRef.current;
      const s = semanaRef.current;
      if (!a) return;

      const oldMatch = matchAsigRow(oldRow, a, d, s);
      const newMatch = matchAsigRow(newRow, a, d, s);

      // antes NO y ahora SÍ → agregar
      if (!oldMatch && newMatch) {
        if (!pendRef.current.some(p => p.progreso_id === newRow.id)) {
          const { data: per } = await supabase
            .from('persona')
            .select('id,nombre,telefono')
            .eq('id', newRow.persona_id)
            .maybeSingle();

          const nuevo: PendRowUI = {
            progreso_id: newRow.id,
            nombre: per?.nombre ?? '—',
            telefono: per?.telefono ?? null,
            llamada1: null,
            llamada2: null,
            llamada3: null,
            habilitado_desde: newRow.habilitado_desde ?? null,
            _ui: 'new',
          };
          setPendientes(prev => [...prev, nuevo].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
          scheduleClearUI(newRow.id, 6000);
        }
        return;
      }

      // antes SÍ y ahora NO → quitar
      if (oldMatch && !newMatch) {
        setPendientes(prev => prev.filter(p => p.progreso_id !== newRow.id));
        if (selectedId === newRow.id) setSelectedId(null);
        return;
      }

      // sigue coincidiendo → refrescar silencioso
      if (newMatch) refreshQuiet();
    };

    // ---- refresh silencioso con debounce ----
    let t: number | null = null;
    const refreshQuiet = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(async () => {
        const d = diaRef.current as Dia | null;
        const s = semanaRef.current as Semana;
        if (d) {
          await fetchPendientes(s, d, { quiet: true });
          await fetchAgendados({ quiet: true });
        }
      }, 150);
    };

    // ---- canal ----
    const channelName = `rt-contactos1-${cedula}`;
    const ch = supabase.channel(channelName);

    // Logs de diagnóstico (activar con ?rtlog=1)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'progreso' }, (p: any) => {
      if (rtDebug) rtLog('ev:progreso', p?.eventType, { old: p?.old?.id, new: p?.new?.id });
    });

    // INSERT progreso con fallback
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'progreso' }, async (payload) => {
      const id = payload.new?.id;
      if (!id) return;
      let row = payload.new as any;

      const needsFetch =
        row?.etapa == null ||
        row?.dia == null ||
        row?.semana == null ||
        (asigRef.current?.etapaBase !== 'Restauracion' && row?.modulo == null);

      if (needsFetch) {
        const { data } = await supabase.from('progreso').select('*').eq('id', id).maybeSingle();
        if (data) row = data;
      }
      await tryPatchProgresoInsert(row);
    });

    // UPDATE progreso con fallback
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'progreso' }, async (payload) => {
      if (payload.old && payload.new) {
        void tryPatchProgresoUpdate(payload.old, payload.new);
      } else {
        const id = (payload.new as any)?.id ?? (payload.old as any)?.id;
        if (!id) return refreshQuiet();
        const { data: row } = await supabase.from('progreso').select('*').eq('id', id).maybeSingle();
        if (row) void tryPatchProgresoUpdate(payload.old ?? {}, row);
        else refreshQuiet();
      }
    });

    // transition_log: refuerzo para transiciones S1→S2, etc.
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transition_log' }, async (payload) => {
      const progId = payload.new?.progreso_id;
      if (!progId) return;
      const { data: row } = await supabase.from('progreso').select('*').eq('id', progId).maybeSingle();
      if (row) await tryPatchProgresoUpdate({}, row);
      refreshQuiet();
    });

    // Otros eventos que impactan vistas → refresco silencioso
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'llamada_intento' }, () => refreshQuiet());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => refreshQuiet());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'persona' }, () => refreshQuiet());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones_maestro' }, () => refreshQuiet());

    ch.subscribe((status) => {
      if (rtDebug) rtLog('channel:status', status);
      if (status === 'SUBSCRIBED') refreshQuiet();
    });

    return () => {
      ch.unsubscribe();
      if (t) window.clearTimeout(t);
      Object.values(clearTimersRef.current).forEach(id => window.clearTimeout(id));
      clearTimersRef.current = {};
    };
  }, [asig, cedula, fetchPendientes, fetchAgendados, rtDebug, rtLog, selectedId]);

  /* ========================= UI ========================= */
  if (!cedula) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <div>Falta la cédula.</div>
      </main>
    );
  }

  if (!asig || !dia) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <div>Cargando asignación…</div>
      </main>
    );
  }



  return (
    <main
      className="relative min-h-[100dvh] px-5 md:px-8 py-6 overflow-hidden supports-[backdrop-filter]:backdrop-blur-2xl"
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(180deg,#fcfeff 0%, #f3f8ff 36%, #ecf3ff 100%)',
          backgroundImage: `
            radial-gradient(1100px 700px at -10% -20%, rgba(56,189,248,.06), transparent 62%),
            radial-gradient(900px 600px at 110% -10%, rgba(79,70,229,.05), transparent 62%),
            radial-gradient(1000px 700px at 50% 120%, rgba(14,165,233,.06), transparent 66%)
          `,
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-[1260px]">
        {/* ===== Título ===== */}
        <section className="mb-6 md:mb-8">
          <div className="text-[32px] md:text-[44px] font-black leading-none tracking-tight bg-gradient-to-r from-neutral-900 via-zinc-700 to-neutral-400 text-transparent bg-clip-text drop-shadow-[0_2px_16px_rgba(0,0,0,0.18)]">
            Panel Timoteos
          </div>
        </section>

        {/* ===== Encabezado ===== */}

         <header className="mb-3 md:mb-4 flex items-baseline gap-3 rounded-2xl px-4 py-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] ring-1 ring-white/60 backdrop-blur-xl bg-[radial-gradient(900px_220px_at_0%_-20%,rgba(56,189,248,0.18),transparent),radial-gradient(900px_240px_at_120%_-30%,rgba(99,102,241,0.16),transparent),linear-gradient(135deg,rgba(255,255,255,.78),rgba(255,255,255,.48))] supports-[backdrop-filter]:bg-[radial-gradient(900px_220px_at_0%_-20%,rgba(56,189,248,0.18),transparent),radial-gradient(900px_240px_at_120%_-30%,rgba(99,102,241,0.16),transparent),linear-gradient(135deg,rgba(255,255,255,.68),rgba(255,255,255,.40))]">
          <h1 className="text-[22px] md:text-[28px] font-semibold text-neutral-900">
            {nombre || 'Servidor'}
          </h1>
          <span className="text-neutral-700 text-sm">Timoteo  - {titulo || '-'}
          </span>

          <span className="text-neutral-700 text-sm">  •  {dia}</span>

          <div className="ml-auto flex gap-2">
            {/* Botón Banco Archivo (ya existente) */}
            <button
              onClick={() => openBanco()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-50 via-yellow-100 to-white text-neutral-700 ring-1 ring-yellow-100 shadow-[0_4px_16px_rgba(255,235,150,0.13)] px-3 py-1.5 text-sm font-semibold hover:scale-[1.04] active:scale-95 transition"
              title="Ver estudiantes archivados y reactivar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM5 8h14v10H5Zm2-3h10v2H7z" fill="currentColor"/>
              </svg>
              Banco Archivo
            </button>
          </div>




          
        </header>
      {/* Modal Persona Nueva */}
      <AnimatePresence mode="sync" initial={false}>
        {nuevaAlmaOpen && (
          <div
            key="modal-nueva-alma"
            className="fixed inset-0 z-[1000] flex min-h-[100dvh] items-start justify-center overflow-y-auto px-1.5 pt-0 pb-6 md:px-4 md:pt-4 md:pb-10 bg-[radial-gradient(1200px_850px_at_50%_-10%,rgba(191,219,254,0.24),transparent),radial-gradient(900px_620px_at_90%_0%,rgba(165,180,252,0.28),rgba(15,23,42,0.78))] supports-[backdrop-filter]:backdrop-blur-[22px]"
            onClick={(event) => { if (event.target === event.currentTarget) { setNuevaAlmaOpen(false); } }}
          >
            <div
              className="relative w-[min(1100px,96vw)] max-h-[96vh] overflow-hidden rounded-[32px] border border-white/35 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(240,244,255,0.74))] supports-[backdrop-filter]:bg-white/65 supports-[backdrop-filter]:backdrop-blur-[32px] shadow-[0_48px_140px_-50px_rgba(15,23,42,0.7)] ring-1 ring-white/50"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-end px-3 md:px-5 py-2 border-b border-white/60 bg-white/70 supports-[backdrop-filter]:bg-white/55 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setNuevaAlmaOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/60 bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:ring-white/80 hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 md:px-3.5"
                >
                  Cerrar
                </button>
              </div>
              <div className="max-h-[calc(96vh-48px)] overflow-y-auto px-3 md:px-6 pb-4 pt-0">
                <PersonaNueva />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Servidores */}
      <AnimatePresence mode="sync" initial={false}>
        {servidoresOpen && (
          <div
            key="modal-servidores"
            className="fixed inset-0 z-[1000] flex min-h-[100dvh] items-start justify-center overflow-y-auto px-1.5 pt-0 pb-6 md:px-4 md:pt-4 md:pb-10 bg-[radial-gradient(1200px_850px_at_20%_-20%,rgba(125,211,252,0.22),transparent),radial-gradient(900px_620px_at_80%_0%,rgba(196,181,253,0.26),rgba(15,23,42,0.78))] supports-[backdrop-filter]:backdrop-blur-[22px]"
            onClick={(event) => { if (event.target === event.currentTarget) { setServidoresOpen(false); } }}
          >
            <div
              className="relative w-[min(1200px,96vw)] max-h-[96vh] overflow-hidden rounded-[32px] border border-white/35 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(236,241,255,0.72))] supports-[backdrop-filter]:bg-white/65 supports-[backdrop-filter]:backdrop-blur-[32px] shadow-[0_48px_140px_-50px_rgba(15,23,42,0.7)] ring-1 ring-white/50"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-end px-3 md:px-5 py-2 border-b border-white/60 bg-white/70 supports-[backdrop-filter]:bg-white/55 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setServidoresOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/60 bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:ring-white/80 hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 md:px-3.5"
                >
                  Cerrar
                </button>
              </div>
              <div className="max-h-[calc(96vh-48px)] overflow-y-auto px-3 md:px-6 pb-4 pt-0">
                <Servidores />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>


        


        {/* Tarjeta de semanas y botones (igual que Maestros) */}
  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl px-3 py-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] ring-1 ring-white/60 mb-4">
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-neutral-600">Semana:</span>
            {[1, 2, 3].map((n) => {
              const active = semana === n;
              return (
                <button
                  key={n}
                  onClick={() => setSemana(n as Semana)}
                  aria-pressed={active}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ring-1 focus:outline-none focus-visible:ring-2 ${
                    active
                      ? 'bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-400 text-white ring-1 ring-white/60 shadow-[0_6px_18px_rgba(56,189,248,.35)] scale-[1.03]'
                      : 'bg-white/40 text-slate-900 ring-white/60 hover:bg-white/60 hover:ring-white/70'
                  }`}
                  title={`Semana ${n}`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-neutral-600">Día:</span>
            {(['Domingo', 'Martes', 'Virtual'] as Dia[]).map((d) => {
              const disabled = d !== asig.dia;
              return (
                <button
                  key={d}
                  disabled={disabled}
                  onClick={() => !disabled && setDia(d)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ring-1 ${
                    dia === d
                      ? 'bg-white/90 text-slate-900 ring-white/70 shadow'
                      : 'bg-white/40 text-slate-900 ring-white/60 hover:bg-white/60'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={disabled ? 'Solo puedes ver tu día asignado' : 'Cambiar día'}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="w-full">
            <div className="relative rounded-3xl bg-white/20 backdrop-blur-xl ring-1 ring-white/60 shadow-[0_24px_80px_-32px_rgba(2,6,23,.45)] overflow-hidden">
              {/* auroras de fondo */}
              <div className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(70%_60%_at_50%_10%,#000_30%,transparent_85%)]">
                <div className="absolute -top-16 left-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,.35),transparent_60%)] blur-2xl" />
                <div className="absolute -bottom-24 right-12 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(14,165,233,.28),transparent_65%)] blur-2xl" />
              </div>

              {/* fila: una sola línea alineada a la derecha */}
              <div className="flex items-center justify-end gap-3 md:gap-4 px-3 py-2 flex-nowrap overflow-x-auto whitespace-nowrap">
                {/* Botón Persona Nueva */}
                <button
                  type="button"
                  onClick={() => setNuevaAlmaOpen(true)}
                  className="relative inline-flex items-center gap-2 rounded-2xl h-10 md:h-11 px-4 md:px-5 text-sm font-semibold text-slate-800 bg-white/60 ring-1 ring-white/60 backdrop-blur-md transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_12px_32px_-12px_rgba(2,6,23,.35)] hover:bg-white/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_28px_72px_-28px_rgba(2,6,23,.5)] active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60 before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:blur-xl before:opacity-80 hover:before:opacity-100 before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(79,70,229,.35),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(56,189,248,.28),transparent_55%)] shrink-0"
                  title="Registrar persona nueva"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" fill="currentColor"/>
                  </svg>
                  Persona Nueva
                </button>
                {/* Botón Servidores */}
                <button
                  type="button"
                  onClick={() => setServidoresOpen(true)}
                  className="relative inline-flex items-center gap-2 rounded-2xl h-10 md:h-11 px-4 md:px-5 text-sm font-semibold text-slate-800 bg-white/60 ring-1 ring-white/60 backdrop-blur-md transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_12px_32px_-12px_rgba(2,6,23,.35)] hover:bg-white/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_28px_72px_-28px_rgba(2,6,23,.5)] active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:blur-xl before:opacity-80 hover:before:opacity-100 before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(56,189,248,.32),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(16,185,129,.26),transparent_55%)] shrink-0"
                  title="Abrir formulario de Servidores"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6a2 2 0 0 1 2-2h5v2H6v12h5v2H6a2 2 0 0 1-2-2V6Zm10-2h4a2 2 0 0 1 2 2v3h-2V6h-4V4Zm4 9h2v3a2 2 0 0 1-2 2h-4v-2h4v-3Z" fill="currentColor"/>
                  </svg>
                  Servidores
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Lista izquierda / Panel derecho ===== */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {/* Lista */}
          <section className={`rounded-[20px] bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl shadow-[0_18px_44px_-18px_rgba(0,0,0,.35)] ring-1 ring-white/60 overflow-hidden ${selectedId ? 'hidden lg:block' : ''}`}>
            <header className="px-4 md:px-5 py-3 bg-[linear-gradient(180deg,rgba(255,255,255,.88),rgba(255,255,255,.62)),radial-gradient(900px_220px_at_0%_-40%,rgba(56,189,248,.08),transparent),radial-gradient(900px_240px_at_110%_-50%,rgba(79,70,229,.06),transparent)] backdrop-blur-xl border-b border-white/60">
              <h3 className="text-base md:text-lg font-semibold text-neutral-900">Llamadas pendientes</h3>
              <p className="text-neutral-600 text-xs md:text-sm">
                {loadingPend ? 'Cargando…' : 'Selecciona un contacto para registrar la llamada.'}
              </p>
            </header>

            <div className="relative overflow-hidden grid">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${dia}-${semana}-${pendientes.length}`}
                  variants={LEFT_PANEL_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="col-start-1 row-start-1"
                >
                  {pendientes.length === 0 ? (
                    <div className="p-6 text-neutral-500">No hay llamadas con los filtros actuales.</div>
                  ) : (
                    <>
                      <motion.ul
                        variants={LIST_WRAPPER_VARIANTS}
                        initial="initial"
                        animate="animate"
                        className="divide-y divide-black/5"
                      >
                        {pendientes.map((c) => {
                          const disabled = estaInhabilitado(c.habilitado_desde);
                          return (
                            <motion.li
                              key={c.progreso_id}
                              variants={LIST_ITEM_VARIANTS}
                              layout
                              className={`px-4 md:px-5 py-3 transition ${selectedId === c.progreso_id ? 'bg-neutral-50' : ''} ${c._ui === 'new' ? 'animate-fadeInScale ring-2 ring-emerald-300/60' : c._ui === 'changed' ? 'animate-flashBg' : ''} ${disabled ? 'opacity-55 cursor-not-allowed' : 'hover:bg-neutral-50 cursor-pointer'}`}
                              onClick={() => disabled ? setShowNextWeekModal(true) : setSelectedId(c.progreso_id)}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                  <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${c._ui === 'new' ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.25)]' : (disabled ? 'bg-neutral-300 shadow-[0_0_0_3px_rgba(156,163,175,.25)]' : 'bg-amber-500 shadow-[0_0_0_3px_rgba(251,191,36,.25)]')}`} />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-neutral-800 leading-tight truncate">{c.nombre ?? '—'}</div>
                                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-neutral-600 text-xs md:text-sm">
                                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="opacity-80">
                                        <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
                                      </svg>
                                      <span className="truncate">{c.telefono ?? '—'}</span>
                                    </div>
                                    {disabled && (
                                      <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-neutral-700 bg-neutral-100 rounded-full px-2 py-0.5 ring-1 ring-neutral-200">
                                        Disponible la próxima semana
                                      </span>
                                    )}
                                    {c._ui === 'new' && !disabled && (
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
                            </motion.li>
                          );
                        })}
                      </motion.ul>
                      <AnimatePresence>
                        {showNextWeekModal && (
                          <>
                            <motion.div
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                              onClick={() => setShowNextWeekModal(false)}
                            />
                            <motion.div
                              role="dialog" aria-modal="true"
                              initial={{ opacity: 0, y: 24, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 24, scale: 0.98 }}
                              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                              className="fixed z-[61] inset-0 flex items-center justify-center p-4"
                            >
                              <div className="w-full max-w-md rounded-2xl bg-white/80 backdrop-blur-xl shadow-2xl ring-1 ring-white/40">
                                <div className="p-6 md:p-7">
                                  <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                                      {/* ícono */}
                                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2l9 4v6c0 5-3.8 9.3-9 10-5.2-.7-9-5-9-10V6l9-4z"/></svg>
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="text-base md:text-lg font-semibold text-neutral-900">Registro inhabilitado</h3>
                                      <p className="mt-1 text-sm text-neutral-700">
                                        Este registro fue gestionado por el servidor de la semana anterior.
                                        Por ese motivo estará disponible nuevamente el próximo lunes.
                                      </p>
                                      {/* si hay seleccionado y trae fecha, muéstrala */}
                                      {(() => {
                                        const sel = pendientes.find(p => p.progreso_id === selectedId);
                                        if (sel?.habilitado_desde) {
                                          return <p className="mt-2 text-xs text-neutral-600">Disponible desde: {sel.habilitado_desde}</p>;
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                  <div className="mt-6 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setShowNextWeekModal(false)}
                                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow hover:brightness-105 active:brightness-95 transition"
                                    >
                                      Entendido
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* Panel derecho de llamada */}
   {/* Panel derecho de llamada */}
<section
  ref={rightPanelRef}
  className={`relative rounded-[20px] bg-white/78 supports-[backdrop-filter]:bg-white/52 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/70 shadow-[0_18px_56px_-28px_rgba(2,6,23,.28)] before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:shadow-[inset_0_1px_0_rgba(255,255,255,.72)] p-4 md:p-5 ${!selectedId ? 'hidden lg:block' : ''}`}
>
  <AnimatePresence initial={false} mode="wait">
    <motion.div
      key={selectedId ?? 'empty'}
      variants={MAC2025_PANEL_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
      className="relative"
      style={{ willChange: 'transform, opacity, filter', transformOrigin: '50% 50%' }}
    >
      {!selectedId ? (
        <EmptyRightPlaceholder />
      ) : (
        (() => {
          const sel = pendRef.current.find((p) => p.progreso_id === selectedId);
          if (!sel) {
            return <div className="p-6 text-neutral-500">Selecciona un registro válido para continuar.</div>;
          }
          return (
            <>
              {/* Botón volver: solo móvil (sin tocar estilos) */}
              <div className="mb-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-black/10 hover:bg-neutral-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15.7 5.3a1 1 0 0 1 0 1.4L11.4 11l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" fill="currentColor"/>
                  </svg>
                  Volver
                </button>
              </div>

              {/* Mantengo exactamente tu componente actual */}
              <FollowUp
                semana={semana}
                dia={dia}
                row={sel}
                saving={saving}
                onSave={enviarResultado}
              />
            </>
          );
        })()
      )}
    </motion.div>
  </AnimatePresence>
</section>
                                              
        </div>

        {/* ===== Asistencias ===== */}
        <section className="mt-6 animate-cardIn rounded-[18px] ring-1 ring-white/60 shadow-[0_12px_30px_-16px_rgba(16,24,40,.28)] overflow-hidden bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl">
          <div className="relative flex items-center justify-between px-4 md:px-6 py-3 bg-white/78 supports-[backdrop-filter]:bg-white/52 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/70 shadow-[0_18px_56px_-28px_rgba(2,6,23,.28)] before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:shadow-[inset_0_1px_0_rgba(255,255,255,.72)] bg-[linear-gradient(180deg,rgba(255,255,255,.88),rgba(255,255,255,.62)),radial-gradient(900px_220px_at_0%_-40%,rgba(56,189,248,.08),transparent),radial-gradient(900px_240px_at_110%_-50%,rgba(79,70,229,.06),transparent)] backdrop-blur-xl border-b border-white/60">
        <header className="relative mb-3 md:mb-4 flex items-baseline gap-3 rounded-2xl px-4 py-3 bg-[linear-gradient(135deg,rgba(255,255,255,.88),rgba(255,255,255,.58))] backdrop-blur-xl ring-1 ring-white/60 rounded-2xl shadow-[0_20px_60px_-28px_rgba(2,6,23,.30)] before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:shadow-[inset_0_1px_0_rgba(255,255,255,.70)]">
              <div>
                <h3 className="text-[15px] md:text-base font-semibold text-neutral-900">
                  Listado Estudiantes Día {asig.dia} — {asig.etapaBase === 'Semillas' ? 'Semillas' : asig.etapaBase} {asig.modulo}
                </h3>
                <p className="text-neutral-500 text-xs">Agendados que confirmaron asistencia.</p>
              </div>
              <div className="text-sm font-semibold rounded-full bg-white px-3 py-1.5 ring-1 ring-black/10 shadow-sm">
                {asig.dia}
              </div>
            </header>
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
                      <div className="font-semibold text-neutral-800 truncate">{e.nombre ?? '—'}</div>
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
                  className="rounded-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-indigo-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(16,185,129,0.30)] px-4 py-2 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                >
                  {savingAg ? 'Enviando…' : 'Enviar Reporte'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ===== Modal Banco Archivo (Mac 2025 / glass) ===== */}
      {bancoOpen && (
        <div className="fixed inset-0 z-[60] flex justify-center items-start pt-8 md:pt-12">
          <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => setBancoOpen(false)}
          />
          <div className="relative w-full max-w-md sm:max-w-lg md:max-w-4xl max-h-[90vh] md:max-h-[96vh] overflow-auto rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,35)] ring-1 ring-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,.70),rgba(255,255,255,.45))] backdrop-blur-xl">
        {/* Header */}
        <div className="px-5 md:px-7 py-4 flex items-center justify-between border-b border-white/50">
          <div>
            <div className="text-xl md:text-2xl font-semibold text-neutral-900">Banco Archivo (Archivados)</div>
            <div className="text-[12px] text-neutral-700">
          {asig.etapaBase} {asig.etapaBase !== 'Restauracion' ? asig.modulo : ''} • Día {asig.dia}
            </div>
          </div>
          <button
            onClick={() => setBancoOpen(false)}
            className="rounded-full bg-white/85 hover:bg-white/95 px-4 py-2 text-sm font-semibold ring-1 ring-white/60 text-neutral-900"
          >
            Atrás
          </button>
        </div>

        {/* Tabla */}
        <div className="px-4 md:px-6 py-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-800">
              <th className="py-2 pr-3">Nombre</th>
              <th className="py-2 pr-3">Teléfono</th>
              <th className="py-2 pr-3">Módulo</th>
              <th className="py-2 pr-3">Semana</th>
              <th className="py-2 pr-3">Día</th>
              <th className="py-2 pr-3">Archivado</th>
              <th className="py-2 pr-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {bancoLoading ? (
              <tr><td colSpan={7} className="py-6 text-center text-neutral-700">Cargando…</td></tr>
            ) : bancoRows.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-neutral-700">Sin registros archivados.</td></tr>
            ) : bancoRows.map((r) => (
              <tr key={r.progreso_id} className="border-t border-white/50">
            <td className="py-2 pr-3 font-medium text-neutral-900">{r.nombre}</td>
            <td className="py-2 pr-3 text-neutral-800">{r.telefono ?? '—'}</td>
            <td className="py-2 pr-3">{r.modulo ?? '—'}</td>
            <td className="py-2 pr-3">{r.semana ?? '—'}</td>
            <td className="py-2 pr-3">{r.dia}</td>
            <td className="py-2 pr-3">{new Date(r.creado_en).toLocaleString()}</td>
            <td className="py-2 pr-0 text-right">
              <button
                disabled={!!reactivating[r.progreso_id]}
                onClick={() => reactivar(r)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-50 via-yellow-100 to-white text-neutral-700 ring-1 ring-yellow-100 shadow-[0_4px_16px_rgba(255,235,150,0.13)] px-3 py-1.5 text-sm transition hover:scale-[1.04] active:scale-95 disabled:opacity-60"
                title="Reactivar al panel actual"
              >
                {reactivating[r.progreso_id] ? 'Reactivando…' : 'Reactivar'}
              </button>
            </td>
              </tr>
            ))}
          </tbody>
            </table>
          </div>
        </div>

          </div>
        </div>
      )}


      {/* Animaciones / estilos */}
      <style jsx global>{`
        @keyframes cardIn {
          0% { opacity: 0; transform: translateY(14px) scale(0.98); filter: blur(3px); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-cardIn { animation: cardIn .48s cubic-bezier(.22,1,.36,1) both; }

        @keyframes fadeInScale {
          0% { opacity: 0; transform: translateY(6px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeInScale { animation: fadeInScale .28s ease-out both; }

        @keyframes flashBg {
          0% { background-color: #fff6d4; }
          100% { background-color: transparent; }
        }
        .animate-flashBg { animation: flashBg 1.2s ease-out 1; }
      `}</style>
    </main>
  );

  /** ====== Banco Archivo: handlers ====== */
async function openBanco() {
  if (!asig) return;
  setBancoOpen(true);
  setBancoLoading(true);

  try {
    let q = supabase
      .from(V_BANCO)
      .select('progreso_id,persona_id,nombre,telefono,modulo,semana,dia,creado_en,etapa')
      .eq('dia', asig.dia);

    // 🔑 Filtro correcto: etapaBase + modulo
    q = (q as any).eq('etapa', asig.etapaBase);
    if (asig.etapaBase !== 'Restauracion') {
      q = (q as any).eq('modulo', asig.modulo);
    }

    const { data, error } = await q.order('creado_en', { ascending: false });
    if (error) throw error;

    setBancoRows((data ?? []) as BancoRow[]);
  } catch (e: any) {
    console.error(e?.message ?? 'Error cargando Banco Archivo');
    setBancoRows([]);
  } finally {
    setBancoLoading(false);
  }
}



  async function reactivar(row: BancoRow) {
    if (!asig || !servidorId) return;
    setReactivating((m) => ({ ...m, [row.progreso_id]: true }));
    try {
      const { error } = await supabase.rpc(RPC_REACTIVAR, {
        p_progreso: row.progreso_id,
        p_persona: row.persona_id,
        p_nombre: row.nombre ?? '—',
        p_telefono: row.telefono ?? null,
        p_estudio: asig.dia,
        p_notas: null,
        p_servidor: servidorId,
      });
      if (error) throw error;

      // Quitar del modal y refrescar listas
      setBancoRows((prev) => prev.filter((r) => r.progreso_id !== row.progreso_id));
      if (dia) await fetchPendientes(semana, dia, { quiet: true });
      await fetchAgendados({ quiet: true });

      // Marcar como "Nuevo" en el panel
      rtNewRef.current.add(row.progreso_id);
    } catch (e: any) {
      console.error(e?.message ?? 'No se pudo reactivar');
    } finally {
      setReactivating((m) => ({ ...m, [row.progreso_id]: false }));
    }
  }
}

/* ================= Panel derecho (detalle y envío) ================= */
function FollowUp({
  semana,
  dia,
  row,
  saving,
  onSave,
}: {
  semana: Semana;
  dia: Dia | null;
  row: PendienteRow;
  saving: boolean;
  onSave: (p: { resultado: Resultado; notas?: string }) => Promise<void>;
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
  const [obsCount, setObsCount] = useState<number | null>(null);

  // Reiniciar estado cuando cambia el registro seleccionado
  useEffect(() => {
    setResultado(null);
    setObs('');
  }, [row?.progreso_id]);

  // Observaciones modal state
  type ObsItem = {
    fecha: string;
    notas: string;
    resultado?: Resultado | null;
    fuente: 'registro' | 'llamada';
  };

  const [obsOpen, setObsOpen] = useState(false);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsItems, setObsItems] = useState<ObsItem[]>([]);

  const refreshObsCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('fn_observaciones_por_progreso', {
        p_progreso: row.progreso_id,
      });
      if (error) throw error;
      setObsCount(Array.isArray(data) ? data.length : 0);
    } catch (e) {
      setObsCount(0);
    }
  }, [row.progreso_id]);

  // Cargar observaciones del registro para el modal
const openObsModal = async () => {
  setObsOpen(true);
  setObsLoading(true);
  try {
    const { data, error } = await supabase.rpc('fn_observaciones_por_progreso', {
      p_progreso: row.progreso_id,
    });
    if (error) throw error;
    const items = (data ?? []).map((r: any) => ({
      fecha: r.creado_en,
      notas: r.notas,
      resultado: r.resultado,
      fuente: 'llamada' as const,
    }));
    setObsItems(items);
    setObsCount(items.length);
  } catch (e) {
    console.error('No se pudieron cargar observaciones', e);
    setObsItems([]);
    setObsCount(0);
  } finally {
    setObsLoading(false);
  }
};

  const initials =
    (row.nombre ?? 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'U';

  const telHref = row.telefono ? `tel:${row.telefono.replace(/[^\d+]/g, '')}` : null;

  // Cargar conteo al cambiar de registro
  useEffect(() => {
    setObsCount(null);
    void refreshObsCount();
  }, [row?.progreso_id, refreshObsCount]);




  return (
    <div>
      <div className="animate-cardIn">
      <div className="mb-4 rounded-2xl ring-1 ring-black/5 bg-[linear-gradient(135deg,#eef3ff,#f6efff)] shadow-[0_18px_40px_-22px_rgba(16,24,40,.45)] px-4 py-3 md:px-5 md:py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-xl text-white font-bold bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
            {initials}
          </div>
          <div>
            <div className="text-lg md:text-xl font-semibold text-neutral-900 leading-tight">
              {row.nombre ?? '-'}
            </div>
            <div className="text-[12px] text-neutral-500 leading-none">
              Semana {semana} • {dia}
            </div>






            
          </div>
        </div>

        

  <div className="shrink-0 flex flex-col items-stretch gap-2 lg:flex-col lg:items-end lg:justify-center lg:gap-3 sm:flex-row sm:overflow-visible sm:flex-nowrap sm:max-w-none">
          {telHref ? (
            <a
              href={telHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
              title={`Llamar a ${row.telefono}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
              </svg>
              <span>{row.telefono}</span>
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm">
              -
            </div>
          )}



          

          {(() => {
            const digits = (row.telefono ?? '').replace(/\D+/g, '');
            let n = digits;
            if (n.startsWith('00')) n = n.slice(2);
            if (!n.startsWith('57')) {
              n = n.replace(/^0+/, '');
              if (n.length === 10 && n.startsWith('3')) n = '57' + n; else if (n.length >=7 && n.length <= 10) n = '57' + n;
            }
            const href = n ? `https://wa.me/${n}?text=${encodeURIComponent('Hola ' + (row.nombre ?? '') + ',')}` : null;
            return href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3.5 py-2 text-sm font-semibold shadow-sm transition-all duration-200 hover:bg-emerald-100 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              title={`Enviar WhatsApp a ${row.telefono}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M16.9 13.7c-.2-.1-1.2-.6-1.4-.7-.3-.1-.4-.1-.6.1l-.6.7c-.2.2-.4.3-.7.2-.3-.1-1.1-.4-2-1.2-.7-.6-1.2-1.3-1.4-1.6-.2-.3 0-.5.1-.7l.5-.6c.2-.3.1-.4 0-.7-.1-.2-.5-1.2-.7-1.7-.2-.5-.4-.4-.6-.4h-.9c-.3 0-.7.2-.9.5-.3.3-.9 1-.9 2.3 0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 .9.4 1.5.5 2 .6.8.1 1.4 0 1.8-.1.6-.2 1.3-.7 1.5-1.3.2-.6.2-1.1.1-1.3 0-.2-.2-.3-.5-.4Z" fill="currentColor"/>
                <path d="M20.5 3.5A11 11 0 1 0 4 19l-1 3.6 3.7-1A11 11 0 0 0 21 12a10.9 10.9 0 0 0-3.2-8.5ZM12 20.8c-1.7 0-3.3-.4-4.7-1.3l-.3-.2-3 .8.8-2.9-.2-.3A9 9 0 1 1 12 20.8Z" fill="currentColor"/>
              </svg>
              WhatsApp
            </a>
            ) : null;
          })()}

          <button
            onClick={openObsModal}
            disabled={obsCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Ver observaciones del registro"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3C7 3 2.73 6.11 1 10.5 2.73 14.89 7 18 12 18s9.27-3.11 11-7.5C21.27 6.11 17 3 12 3zm0 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v4h-2zm0 6h2v2h-2z" fill="currentColor"/>
            </svg>
            Observaciones
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700">
              {obsCount ?? 0}
            </span>
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-neutral-500">Resultado de la llamada</label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {opciones.map((o) => (
            <label key={o.value} className="flex items-center gap-2 rounded-lg ring-1 ring-black/10 bg-neutral-50 px-3 py-2 cursor-pointer">
              <input
                type="radio"
                name="resultado"
                className="accent-blue-600"
                onChange={() => setResultado(o.value)}
                checked={resultado === o.value}
              />
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
          onClick={async () => { if (resultado) { await onSave({ resultado, notas: obs || undefined }); await refreshObsCount(); } }}
          className="rounded-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-indigo-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(16,185,129,0.30)] px-4 py-2 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Enviar informe'}
        </button>
      </div>
      </div>
      {obsOpen && (
  <div className="fixed inset-0 z-[70] flex items-start justify-center min-h-screen px-2 sm:px-4 pt-8 sm:pt-12">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setObsOpen(false)}
          />
          <div className="relative w-full max-w-3xl rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,35)] ring-1 ring-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,65),rgba(255,255,255,45))] backdrop-blur-xl overflow-hidden">
              <div className="px-5 md:px-7 py-4 flex items-center justify-between border-b border-white/50">
                <div>
                  <div className="text-xl md:text-2xl font-semibold text-neutral-900">Observaciones</div>
                  <div className="text-[12px] text-neutral-600">{row.nombre ?? '-'}</div>
                </div>
                <button
                  onClick={() => setObsOpen(false)}
                  className="rounded-full bg-white/80 hover:bg:white px-4 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm"
                >
                  Atras
                </button>
              </div>
              <div className="px-4 md:px-6 py-4">
                {obsLoading ? (
                  <div className="py-6 text-center text-neutral-600">Cargando.</div>
                ) : obsItems.length === 0 ? (
                  <div className="py-6 text-center text-neutral-500">Sin observaciones registradas.</div>
                ) : (
                  <ul className="space-y-3">
                    {obsItems.map((it, idx) => (
                      <li key={idx} className="rounded-xl bg-white/70 ring-1 ring-black/10 px-4 py-3 shadow-sm">
                        <div className="text-sm text-neutral-600 flex items-center justify-between">
                          <span className="font-medium text-neutral-800">
                            {new Date(it.fecha).toLocaleString()}
                          </span>
                          <span className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 ring-1 ring-black/10">
                            {it.fuente === 'registro' ? 'Registro' : 'Llamada'}
                          </span>
                        </div>
                        <div className="mt-2 text-[13px] text-neutral-800 whitespace-pre-wrap">
                          <strong>
                            {it.resultado ? (resultadoLabels[it.resultado as Resultado] ?? it.resultado) : '-'}
                          </strong>
                          {it.notas ? ` - ${it.notas}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}


