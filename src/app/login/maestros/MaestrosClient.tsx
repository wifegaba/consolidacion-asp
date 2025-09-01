'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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

/* ================= Constantes ================= */
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

        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();

/** "Semilla 3" | "Devocionales 2" | "Restauracion 1" -> etapaBase + módulo */
function mapEtapaDetToBase(etapaDet: string): {
    etapaBase: 'Semillas' | 'Devocionales' | 'Restauracion';
    modulo: 1 | 2 | 3 | 4;
} {
    const t = norm(etapaDet);
    const m = /^(semilla|devocionales|restauracion)\s+(\d+)/.exec(t);
    if (!m) return { etapaBase: 'Semillas', modulo: 1 };
    const num = Math.max(1, Math.min(4, parseInt(m[2], 10))) as 1 | 2 | 3 | 4;
    if (m[1] === 'semilla') return { etapaBase: 'Semillas', modulo: num };
    if (m[1] === 'devocionales') return { etapaBase: 'Devocionales', modulo: num };
    return { etapaBase: 'Restauracion', modulo: 1 };
}

/* ================= Página ================= */
export default function MaestrosClient() {
    const router = useRouter();
    const params = useSearchParams();
    const cedula = normalizeCedula(params?.get('cedula') ?? '');

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

    // refs
    const semanaRef = useRef(semana);
    const diaRef = useRef<Dia | null>(dia);
    const asigRef = useRef<MaestroAsignacion | null>(null);
    const pendRef = useRef<PendRowUI[]>([]);
    useEffect(() => { semanaRef.current = semana; }, [semana]);
    useEffect(() => { diaRef.current = dia; }, [dia]);
    useEffect(() => { asigRef.current = asig; }, [asig]);
    useEffect(() => { pendRef.current = pendientes; }, [pendientes]);

    // limpiar resaltado "_ui" tras unos segundos
    const clearTimersRef = useRef<Record<string, number>>({});
    const scheduleClearUI = (id: string, ms = 5000) => {
        if (clearTimersRef.current[id]) window.clearTimeout(clearTimersRef.current[id]);
        clearTimersRef.current[id] = window.setTimeout(() => {
            setPendientes(prev => prev.map(p => p.progreso_id === id ? ({ ...p, _ui: undefined }) : p));
            delete clearTimersRef.current[id];
        }, ms);
    };

    // Cargar asignación del maestro
    useEffect(() => {
        (async () => {
            if (!cedula) return;
            const { data, error } = await supabase
                .from('servidores')
                .select('id,nombre,asignaciones_maestro:asignaciones_maestro(etapa,dia,vigente)')
                .eq('cedula', cedula)
                .maybeSingle();

            if (error || !data) {
                router.replace('/login');
                return;
            }

            setNombre((data as any).nombre ?? '');

            const a = (data as any).asignaciones_maestro?.find((x: AsigMaestro) => x.vigente) as AsigMaestro | undefined;
            if (!a) {
                router.replace(`/bienvenida?cedula=${cedula}`);
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

    /* ====== Fetch de pendientes ====== */
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

            // Reconciliar para marcar 'new'/'changed'
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
            // programar limpieza del highlight
            next.forEach(r => r._ui && scheduleClearUI(r.progreso_id, r._ui === 'new' ? 6000 : 3000));

            if (!opts?.quiet) setLoadingPend(false);
        },
        [asig]
    );

    // Primer load visible
    useEffect(() => {
        if (dia) void fetchPendientes(semana, dia, { quiet: false });
    }, [semana, dia, fetchPendientes]);

    /* ====== Guardar resultado de llamada ====== */
    const enviarResultado = async (payload: { resultado: Resultado; notas?: string }) => {
        const row = pendRef.current.find((p) => p.progreso_id === selectedId);
        if (!row || !semana || !dia) return;

        const esConfirmado = payload.resultado === 'confirmo_asistencia';

        // Optimista: refleja de inmediato en asistencias
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
            setAgendados((prev) => prev.filter((a) => a.progreso_id !== row.progreso_id));
            alert(e?.message ?? 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    /* ====== Agendados ====== */
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

    useEffect(() => { void fetchAgendados({ quiet: false }); }, [fetchAgendados]);

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

    /* ====== Realtime SIN polling ====== */
    useEffect(() => {
        if (!asig) return;

        // Parcheo en caliente al INSERT de progreso (evita fetch completo)
        const tryPatchProgresoInsert = async (row: any) => {
            const a = asigRef.current;
            if (!a) return;
            const d = diaRef.current;
            const s = semanaRef.current;
            // Debe coincidir con filtros actuales
            const matches =
                row &&
                row.dia === d &&
                row.semana === s &&
                row.etapa === a.etapaBase &&
                (a.etapaBase === 'Restauracion' || row.modulo === a.modulo) &&
                row.activo !== false; // por si usas activo

            if (!matches) return;

            // Evitar duplicados
            if (pendRef.current.some(p => p.progreso_id === row.id)) return;

            // Traer nombre/teléfono de persona para render inmediato
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
                _ui: 'new',
            };

            setPendientes(prev => {
                const up = [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre));
                return up;
            });
            scheduleClearUI(row.id, 6000);
        };

        // Refrescos silenciosos (cuando no podemos parchar fino)
        let t: number | null = null;
        const refreshQuiet = () => {
            if (t) window.clearTimeout(t);
            t = window.setTimeout(async () => {
                const d = diaRef.current;
                const s = semanaRef.current as Semana;
                if (d) await fetchPendientes(s, d, { quiet: true });
                await fetchAgendados({ quiet: true });
            }, 150);
        };

        const ch = supabase.channel(`rt-maestros-${cedula}`);

        // Progreso: INSERT lo parchamos; UPDATE/DELETE refresco silencioso
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'progreso' }, (payload) => {
            void tryPatchProgresoInsert(payload.new);
        });
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'progreso' }, () => {
            refreshQuiet();
        });
        ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'progreso' }, () => {
            refreshQuiet();
        });

        // Llamada / Asistencia / Persona / Asignación → refresco silencioso (marcará 'changed' donde aplique)
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'llamada_intento' }, () => refreshQuiet());
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => refreshQuiet());
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'persona' }, () => refreshQuiet());
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones_maestro' }, () => refreshQuiet());

        ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                refreshQuiet(); // primer sync silencioso
            }
        });

        return () => {
            ch.unsubscribe();
            if (t) window.clearTimeout(t);
            // limpiar timeouts de _ui
            Object.values(clearTimersRef.current).forEach(id => window.clearTimeout(id));
            clearTimersRef.current = {};
        };
    }, [asig, cedula, fetchPendientes, fetchAgendados]);

    if (!cedula) {
        return (
            <main className="min-h-[100dvh] grid place-items-center">
                <div>Falta la cédula en la URL.</div>
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

    /* ========================= UI ========================= */
    return (
        <main
            className="min-h-[100dvh] px-5 md:px-8 py-6 bg-[radial-gradient(1200px_800px_at_-10%_-10%,#e9f0ff,transparent_60%),radial-gradient(1200px_900px_at_110%_10%,#ffe6f4,transparent_55%),linear-gradient(120deg,#f4f7ff,#fef6ff_50%,#eefaff)]"
            style={{
                fontFamily:
                    "-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,'Helvetica Neue',Arial,sans-serif",
            }}
        >
            <div className="mx-auto w-full max-w-[1260px]">
                {/* ===== Título / Bienvenida ===== */}
                <section className="mb-6 md:mb-8">
                    <div className="text-[32px] md:text-[44px] font-black leading-none tracking-tight bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 text-transparent bg-clip-text drop-shadow-sm">
                        Panel de Maestros
                    </div>
                    <div className="mt-1 text-[18px] md:text-[22px] font-medium text-neutral-700">
                        Bienvenido, <b className="text-neutral-900">{nombre || 'Maestro'}</b>
                    </div>
                </section>

                {/* ===== Encabezado similar a Contactos ===== */}
                <header className="mb-3 md:mb-4 flex items-baseline gap-3">
                    <h1 className="text-[22px] md:text-[28px] font-semibold text-neutral-900">
                        Llamadas pendientes {titulo}
                    </h1>
                    <span className="text-neutral-500 text-sm">Semana {semana} • {dia}</span>
                </header>

                {/* Menú: semanas (1..3) y día bloqueado */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2">
                        <span className="text-sm text-neutral-600">Semana:</span>
                        {[1, 2, 3].map((n) => (
                            <button
                                key={n}
                                onClick={() => setSemana(n as Semana)}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold ring-1 ring-black/10 shadow-sm transition ${
                                    semana === n ? 'bg-neutral-900 text-white' : 'bg-white hover:shadow-md'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
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
                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold ring-1 ring-black/10 shadow-sm transition ${
                                        dia === d ? 'bg-neutral-900 text-white' : 'bg-white hover:shadow-md'
                                    } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none hover:shadow-none' : ''}`}
                                    title={disabled ? 'Solo puedes ver tu día asignado' : 'Cambiar día'}
                                >
                                    {d}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ===== Lista izquierda / Panel derecho ===== */}
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
                      ${c._ui === 'new' ? 'animate-fadeInScale ring-2 ring-emerald-300/60' : c._ui === 'changed' ? 'animate-flashBg' : ''}`}
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

                    {/* Panel derecho de llamada */}
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
                                Listado Estudiantes Día {asig.dia} — {asig.etapaBase === 'Semillas' ? 'Semillas' : asig.etapaBase} {asig.modulo}
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

            {/* Animaciones / estilos para nuevos y cambiados */}
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

    const initials =
        row.nombre
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join('') || 'U';

    const telHref = row.telefono ? `tel:${row.telefono.replace(/[^\d+]/g, '')}` : null;

    return (
        <div className="animate-cardIn">
            <div className="mb-4 rounded-2xl ring-1 ring-black/5 bg-[linear-gradient(135deg,#eef3ff,#f6efff)] px-4 py-3 md:px-5 md:py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-xl text-white font-bold bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
                        {initials}
                    </div>
                    <div>
                        <div className="text-base md:text-lg font-semibold text-neutral-900 leading-tight">
                            {row.nombre}
                        </div>
                        <div className="text-[12px] text-neutral-500 leading-none">
                            Semana {semana} • {dia}
                        </div>
                        <div className="text-[11px] text-neutral-600 mt-1 space-y-0.5">
                            {[row.llamada1 ?? null, row.llamada2 ?? null, row.llamada3 ?? null].map((r, idx) => (
                                <div key={idx}>
                                    Llamada {idx + 1}:{' '}
                                    {r ? (
                                        <span className="font-medium text-neutral-800">{resultadoLabels[r as Resultado]}</span>
                                    ) : (
                                        <span className="italic">sin registro</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {telHref ? (
                    <a
                        href={telHref}
                        className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm hover:shadow-md transition"
                        title={`Llamar a ${row.telefono}`}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
                        </svg>
                        <span>{row.telefono}</span>
                    </a>
                ) : (
                    <div className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm">
                        —
                    </div>
                )}
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
                    onClick={() => resultado && onSave({ resultado, notas: obs || undefined })}
                    className="rounded-xl bg-neutral-900 text-white px-4 py-2 shadow-md hover:shadow-lg transition disabled:opacity-60"
                >
                    {saving ? 'Guardando…' : 'Enviar informe'}
                </button>
            </div>
        </div>
    );
}
