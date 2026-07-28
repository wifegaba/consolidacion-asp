// src/app/semillas/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ========= Tipos ========= */
type SeedKey = 1 | 2 | 3 | 4;
type Mode = 'default' | 'contactos' | 'asistencias';
type Day = 'Domingo' | 'Martes' | 'Virtual';
type Week = 1 | 2 | 3;

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

type PendienteRow = {
    progreso_id: string;
    nombre: string;
    telefono: string | null;
    llamada1?: Resultado | null;
    llamada2?: Resultado | null;
    llamada3?: Resultado | null;
};

type AgendadoRow = {
    progreso_id: string;
    nombre: string;
    telefono: string | null;
    semana: number;
};

/* ========= Config ========= */
// RPC y vistas existentes (no se tocan)
const V_PENDIENTES = 'v_llamadas_pendientes_hist';   // ← mantiene HIST para ver llamada1/2/3
const V_PENDIENTES_BASE = 'v_llamadas_pendientes';   // ← tiene 'etapa' y sirve para filtrar SIN romper HIST
const V_AGENDADOS = 'v_agendados';
const RPC_GUARDAR_LLAMADA = 'fn_guardar_llamada';
const RPC_MARCAR_ASISTENCIA = 'fn_marcar_asistencia';

/* ========= UI / Utilidades ========= */
const resultadoLabels: Record<Resultado, string> = {
    confirmo_asistencia: 'CONFIRMÓ ASISTENCIA',
    no_contesta: 'NO CONTESTA',
    no_por_ahora: 'NO POR AHORA',
    llamar_de_nuevo: 'LLAMAR DE NUEVO',
    salio_de_viaje: 'SALIO DE VIAJE',
    ya_esta_en_ptmd: 'YA ESTA EN PTMD',
    no_tiene_transporte: 'NO TIENE $ TRANSPORTE',
    vive_fuera: 'VIVE FUERA DE LA CIUDAD',
    murio: 'MURIÓ',
    rechazado: 'NO ME INTERESA',
};

const gradients = [
    'from-[#7AB5FF] via-[#89BEFF] to-[#A6CCFF]',
    'from-[#4FD3BF] via-[#57DAC7] to-[#74E7D9]',
    'from-[#9D8CFF] via-[#A496FF] to-[#BCAEFF]',
    'from-[#7EA1FF] via-[#88A9FF] to-[#A3BDFF]',
];

const MAC_ACCENT = {
    ring: 'rgba(10,132,255,0.65)', // #0A84FF
    ringOffset: 'rgba(255,255,255,0.55)',
    lineFrom: '#0A84FF',
    lineTo: '#66D1FF',
    blur: 'rgba(10,132,255,0.30)',
};

const LeafPattern = () => {
    const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
      <g fill="none" stroke="white" stroke-opacity="0.16" stroke-width="3">
        <path d="M20 110c18-30 52-30 70 0"/>
        <path d="M85 45c10-20 30-20 40 0"/>
        <path d="M15 35c12-22 36-22 48 0"/>
        <path d="M105 110c-8-16-24-16-32 0"/>
        <path d="M50 75c8-16 24-16 32 0"/>
      </g>
    </svg>
  `);
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25 rounded-[16px]"
            style={{
                backgroundImage: `url("data:image/svg+xml;utf8,${svg}")`,
                backgroundRepeat: 'repeat',
                backgroundSize: '160px 160px',
                mixBlendMode: 'overlay',
            }}
        />
    );
};

/* ================= Modal ================= */
function Modal({
    open,
    onClose,
    seed,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    seed: SeedKey | null;
    onSelect: (mode: Mode) => void;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        if (open) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const body = document.body;
        const prevOverflow = body.style.overflow;
        const prevPaddingRight = body.style.paddingRight;
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        body.style.overflow = 'hidden';
        if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
        return () => {
            body.style.overflow = prevOverflow;
            body.style.paddingRight = prevPaddingRight;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <div aria-hidden="true" className="fixed inset-0 bg-black/10 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative w-[min(680px,96vw)] max-h-[92vh] overflow-hidden rounded-[20px] sm:rounded-[24px] bg-white shadow-[0_16px_40px_rgba(0,0,0,.22)] ring-1 ring-black/10 flex flex-col">
                <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="absolute right-4 top-4 h-9 w-9 rounded-full bg-black/5 hover:bg-black/10 transition shadow-sm"
                >
                    ✕
                </button>

                <div className="p-6 md:p-9 overflow-auto seed-modal">
                    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900">Seleccione el área</h2>
                    <div className="mt-2 text-neutral-500">{seed ? `Semilla ${seed}` : ''}</div>

                    <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5 seed-modal__options">
                        <button
                            onClick={() => {
                                onSelect('contactos');
                                onClose();
                            }}
                            className="group relative rounded-[20px] px-6 py-7 text-left text-white bg-gradient-to-br from-[#5FA8FF] via-[#7BB6FF] to-[#A1C8FF] ring-1 ring-white/30 shadow-[0_12px_30px_-8px_rgba(16,24,40,.28)] hover:shadow-[0_20px_48px_-12px_rgba(16,24,40,.40)] transition focus:outline-none focus:ring-2 focus:ring-white/40"
                        >
                            <LeafPattern />
                            <div className="relative text-2xl font-semibold drop-shadow">Contactos</div>
                            <p className="relative mt-2 text-white/90">Gestionar personas y datos.</p>
                        </button>

                        <button
                            onClick={() => {
                                onSelect('asistencias');
                                onClose();
                            }}
                            className="group relative rounded-[20px] px-6 py-7 text-left text-white bg-gradient-to-br from-[#55E3B0] via-[#53D7C1] to-[#6BE7D5] ring-1 ring-white/30 shadow-[0_12px_30px_-8px_rgba(16,24,40,.28)] hover:shadow-[0_20px_48px_-12px_rgba(16,24,40,.40)] transition focus:outline-none focus:ring-2 focus:ring-white/40"
                        >
                            <LeafPattern />
                            <div className="relative text-2xl font-semibold drop-shadow">Asistencias</div>
                            <p className="relative mt-2 text-white/90">Registro y consulta por fechas.</p>
                        </button>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={onClose}
                            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-white shadow-md hover:shadow-lg transition focus:outline-none focus:ring-4 focus:ring-black/10"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =============== Tarjeta Semilla =============== */
function SeedCard({
    index,
    id,
    onClick,
    selected = false,
}: {
    index: number;
    id: string;
    onClick: () => void;
    selected?: boolean;
}) {
    const grad = gradients[index];

    return (
        <button
            onClick={onClick}
            aria-label={`Abrir Semilla ${id}`}
            className={`
        group relative rounded-[16px]
        w-full h-[84px] md:h-[100px]
        bg-gradient-to-br ${grad} text-white ring-1 ring-white/30
        shadow-[0_10px_24px_-10px_rgba(16,24,40,.30)]
        hover:shadow-[0_18px_40px_-12px_rgba(16,24,40,.40)] transition
        focus:outline-none
        ${selected ? 'scale-[1.012]' : ''}
      `}
            style={{
                boxShadow: selected
                    ? `0 0 0 2px ${MAC_ACCENT.ring}, 0 0 0 7px ${MAC_ACCENT.ringOffset}, 0 16px 28px -14px rgba(16,24,40,.35)`
                    : undefined,
            }}
        >
            <LeafPattern />

            {selected && (
                <span
                    className="pointer-events-none absolute left-3 right-3 bottom-2 h-[5px] rounded-full accent-line"
                    style={{
                        backgroundImage: `linear-gradient(90deg, ${MAC_ACCENT.lineFrom}, ${MAC_ACCENT.lineTo})`,
                        boxShadow: `0 1px 0 rgba(255,255,255,.5) inset, 0 6px 12px ${MAC_ACCENT.blur}`,
                    }}
                />
            )}

            {/* Texto centrado arriba */}
            <div className="pointer-events-none absolute left-0 right-0 top-[8px] md:top-[10px] text-center">
                <div
                    className="text-[13px] md:text-[14px] font-semibold leading-none tracking-[.02em] drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]"
                    style={{ fontFamily: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Helvetica Neue', Arial, sans-serif` }}
                >
                    Semilla
                </div>
                <div
                    className="mt-1 text-[26px] md:text-[34px] font-extrabold leading-none tracking-[-0.01em] drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]"
                    style={{ fontFamily: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Helvetica Neue', Arial, sans-serif` }}
                >
                    {id}
                </div>
            </div>
        </button>
    );
}

/* =============== Tarjeta Semana =============== */
function WeekCard({
    week,
    onPick,
    delay = 0,
    counts,
}: {
    week: Week;
    onPick: (day: Day) => void;
    delay?: number;
    counts?: Record<string, number>;
}) {
    return (
        <div
            className="w-full animate-cardIn rounded-[24px] bg-gradient-to-br from-white via-white to-[#F4F7FB] ring-1 ring-white/60 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between gap-3 relative overflow-hidden group hover:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.12)] transition-all duration-500"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Decoración de fondo sutil */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50/50 to-purple-50/50 blur-[40px] rounded-full pointer-events-none -mr-10 -mt-10" />

            <div className="relative z-10 min-w-[70px]">
                <div className="text-[12px] uppercase tracking-widest font-bold text-neutral-400 leading-none mb-1">Semana</div>
                <div className="text-[42px] font-black text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-600 leading-[0.9] tracking-tight filter drop-shadow-sm">{week}</div>
            </div>

            <div className="relative z-10 flex flex-col gap-2 w-full max-w-[150px]">
                {(['Domingo', 'Martes', 'Virtual'] as Day[]).map((txt) => {
                    const count = counts?.[txt] || 0;
                    return (
                        <button
                            key={txt}
                            onClick={() => onPick(txt)}
                            className="group/btn relative w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-neutral-200/60 bg-white/60 hover:bg-white hover:border-blue-300/50 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden"
                        >
                            <span className="text-[13px] font-semibold text-neutral-600 group-hover/btn:text-neutral-900 transition-colors">{txt}</span>

                            {count > 0 && (
                                <span className="ml-2 flex items-center justify-center h-[20px] min-w-[20px] px-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_2px_8px_-1px_rgba(59,130,246,0.4)]">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* =============== Lista de llamadas =============== */
function CallsList({
    items,
    onSelect,
}: {
    items: {
        id: string;
        nombre: string;
        tel: string | null;
        history: (Resultado | null)[];
    }[];
    onSelect: (id: string) => void;
}) {
    return (
        <section className="animate-cardIn rounded-[16px] bg-white shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5">
            <header className="px-4 md:px-5 py-3 border-b border-black/5">
                <h3 className="text-base md:text-lg font-semibold text-neutral-900">Llamadas pendientes</h3>
                <p className="text-neutral-500 text-xs md:text-sm">Tareas para hoy.</p>
            </header>

            <ul className="divide-y divide-black/5">
                {items.map((c) => (
                    <li
                        key={c.id}
                        className="px-4 md:px-5 py-3 hover:bg-neutral-50 cursor-pointer"
                        onClick={() => onSelect(c.id)}
                    >
                        <div className="flex items-start justify-between gap-4">
                            {/* Izquierda: nombre + teléfono NO clickeable con icono */}
                            <div className="flex items-start gap-3 min-w-0">
                                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(251,191,36,.25)]" />
                                <div className="min-w-0">
                                    <div className="font-semibold text-neutral-800 leading-tight truncate">{c.nombre}</div>

                                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-neutral-600 text-xs md:text-sm">
                                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="opacity-80">
                                            <path
                                                d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                        <span className="truncate">{c.tel ?? '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Derecha: historial */}
                            <div className="shrink-0 text-right text-[11px] md:text-xs text-neutral-500 leading-5">
                                {c.history.map((r, idx) => (
                                    <div key={idx}>
                                        <span className="mr-1">Llamada {idx + 1}:</span>
                                        {r ? (
                                            <span className="font-medium text-neutral-700">{resultadoLabels[r]}</span>
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
        </section>
    );
}

/* =============== Modal: Mover Estudiante =============== */
type EtapaDestino = 'Semillas' | 'Devocionales' | 'Restauracion';

const ETAPAS_CONFIG: { etapa: EtapaDestino; label: string; color: string; grad: string; icon: string }[] = [
    { etapa: 'Semillas',     label: 'Semillas',     color: '#4F8EF7', grad: 'from-[#4F8EF7] to-[#7BB2FF]', icon: '🌱' },
    { etapa: 'Devocionales', label: 'Devocionales', color: '#7C5CE5', grad: 'from-[#7C5CE5] to-[#A78BFA]', icon: '📖' },
    { etapa: 'Restauracion', label: 'Restauración', color: '#10B981', grad: 'from-[#10B981] to-[#34D399]', icon: '🕊️' },
];

function MoverEstudianteModal({
    open,
    onClose,
    studentName,
    progresoId,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    studentName: string;
    progresoId: string;
    onSuccess: () => void;
}) {
    const [etapa, setEtapa] = useState<EtapaDestino | null>(null);
    const [modulo, setModulo] = useState<number | null>(null);
    const [semana, setSemana] = useState<number | null>(null);
    const [dia, setDia] = useState<Day | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset al abrir
    useEffect(() => {
        if (open) {
            setEtapa(null);
            setModulo(null);
            setSemana(null);
            setDia(null);
            setError(null);
        }
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        if (open) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const canConfirm = etapa && modulo && semana && dia;

    const handleConfirm = async () => {
        if (!canConfirm) return;
        setSaving(true);
        setError(null);
        try {
            const { error: err } = await supabase
                .from('progreso')
                .update({
                    etapa,
                    modulo,
                    semana,
                    dia,
                })
                .eq('id', progresoId);
            if (err) throw err;
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e?.message ?? 'Error al mover el estudiante');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
            {/* Backdrop */}
            <div
                aria-hidden="true"
                className="fixed inset-0 bg-black/20 backdrop-blur-[4px]"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-[min(520px,96vw)] max-h-[90vh] overflow-auto rounded-[24px] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.30)] ring-1 ring-black/10 flex flex-col">

                {/* Header premium */}
                <div className="relative overflow-hidden rounded-t-[24px] px-6 py-5 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]">
                    {/* Destellos decorativos */}
                    <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-300/10 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-400/10 blur-2xl" />

                    <div className="relative flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                {/* Corona premium */}
                                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-sm tracking-wide uppercase">
                                    ✦ Premium
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Mover Estudiante</h2>
                            <p className="mt-0.5 text-slate-400 text-sm">
                                <span className="font-medium text-slate-200">{studentName}</span>
                                {' '}→ selecciona la nueva etapa
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Cerrar"
                            className="shrink-0 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-5">

                    {/* Paso 1: Etapa */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">1 · Etapa destino</label>
                        <div className="grid grid-cols-3 gap-2">
                            {ETAPAS_CONFIG.map((cfg) => (
                                <button
                                    key={cfg.etapa}
                                    onClick={() => { setEtapa(cfg.etapa); setModulo(null); }}
                                    className={`relative flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                                        etapa === cfg.etapa
                                            ? 'border-transparent text-white shadow-lg scale-[1.03]'
                                            : 'border-neutral-200 text-neutral-600 bg-white hover:border-neutral-300 hover:shadow-sm'
                                    }`}
                                    style={etapa === cfg.etapa ? { background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` } : {}}
                                >
                                    <span className="text-2xl">{cfg.icon}</span>
                                    <span className="text-[11px] leading-tight text-center">{cfg.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Paso 2: Módulo */}
                    {etapa && (
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">2 · Módulo</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setModulo(m)}
                                        className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-base transition-all ${
                                            modulo === m
                                                ? 'border-transparent text-white bg-neutral-900 shadow-md scale-[1.04]'
                                                : 'border-neutral-200 text-neutral-700 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Paso 3: Semana */}
                    {etapa && modulo && (
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">3 · Semana</label>
                            <div className="flex gap-2">
                                {[1, 2, 3].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSemana(s)}
                                        className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-base transition-all ${
                                            semana === s
                                                ? 'border-transparent text-white bg-indigo-600 shadow-md scale-[1.04]'
                                                : 'border-neutral-200 text-neutral-700 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Paso 4: Día */}
                    {etapa && modulo && semana && (
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">4 · Día</label>
                            <div className="flex gap-2">
                                {(['Domingo', 'Martes', 'Virtual'] as Day[]).map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => setDia(d)}
                                        className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                                            dia === d
                                                ? 'border-transparent text-white bg-emerald-600 shadow-md scale-[1.04]'
                                                : 'border-neutral-200 text-neutral-700 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resumen destino */}
                    {canConfirm && (
                        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 px-4 py-3">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Destino seleccionado</p>
                            <p className="text-sm font-semibold text-slate-800">
                                {ETAPAS_CONFIG.find(c => c.etapa === etapa)?.icon} {etapa} {modulo} · Semana {semana} · {dia}
                            </p>
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</p>
                    )}

                    {/* Acciones */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={!canConfirm || saving}
                            onClick={handleConfirm}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#0f172a] to-[#1e40af] shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Moviendo…' : 'Confirmar traslado'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =============== Formulario seguimiento =============== */
function FollowUpForm({
    contact,
    prevHist,
    onSubmit,
    busy,
    onMoverSuccess,
}: {
    contact: { progresoId: string; nombre: string; tel: string | null; semana: Week; dia: Day };
    prevHist?: (Resultado | null)[];
    onSubmit: (payload: { resultado: Resultado; notas?: string }) => Promise<void>;
    busy: boolean;
    onMoverSuccess?: () => void;
}) {
    const opciones: { label: string; value: Resultado }[] = [
        { label: 'CONFIRMÓ ASISTENCIA', value: 'confirmo_asistencia' },
        { label: 'NO CONTESTA', value: 'no_contesta' },
        { label: 'NO POR AHORA', value: 'no_por_ahora' },
        { label: 'LLAMAR DE NUEVO', value: 'llamar_de_nuevo' },
        { label: 'SALIO DE VIAJE', value: 'salio_de_viaje' },
        { label: 'YA ESTA EN PTMD', value: 'ya_esta_en_ptmd' },
        { label: 'NO TIENE $ TRANSPORTE', value: 'no_tiene_transporte' },
        { label: 'VIVE FUERA DE LA CIUDAD', value: 'vive_fuera' },
        { label: 'MURIÓ', value: 'murio' },
        { label: 'NO ME INTERESA', value: 'rechazado' },
    ];

    const [resultado, setResultado] = useState<Resultado | null>(null);
    const [obs, setObs] = useState('');
    const [moverOpen, setMoverOpen] = useState(false);

    const initials =
        contact.nombre
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join('') || 'U';

    // Sanitiza el teléfono para href: tel:
    const telHref = contact.tel ? `tel:${contact.tel.replace(/[^\d+]/g, '')}` : null;

    return (
        <section className="animate-cardIn rounded-[16px] bg-transparent backdrop-blur-sm shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5 p-4 md:p-5 min-h-[420px]">
            <div className="mb-4 rounded-2xl ring-1 ring-black/5 bg-transparent px-4 py-3 md:px-5 md:py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-xl text-white font-bold bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
                        {initials}
                    </div>
                    <div>
                        <div className="text-base md:text-lg font-semibold text-neutral-900 leading-tight">{contact.nombre}</div>
                        <div className="text-[12px] text-neutral-500 leading-none">Semana {contact.semana} • {contact.dia}</div>

                        {prevHist && (
                            <div className="text-[11px] text-neutral-600 mt-1 space-y-0.5">
                                {prevHist.map((r, idx) => (
                                    <div key={idx}>
                                        Llamada {idx + 1}:{' '}
                                        {r ? (
                                            <span className="font-medium text-neutral-800">{resultadoLabels[r]}</span>
                                        ) : (
                                            <span className="italic">sin registro</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Teléfono CLICKEABLE solo en el panel derecho */}
                {telHref ? (
                    <a
                        href={telHref}
                        className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm hover:shadow-md transition"
                        title={`Llamar a ${contact.tel}`}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
                        </svg>
                        <span>{contact.tel}</span>
                    </a>
                ) : (
                    <div className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/10 shadow-sm">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
                        </svg>
                        <span>—</span>
                    </div>
                )}
            </div>

            {/* ── Botón premium Mover Estudiante ── */}
            <div className="mb-4 flex">
                <button
                    onClick={() => setMoverOpen(true)}
                    className="
                        inline-flex items-center gap-2
                        rounded-xl
                        px-4 py-2
                        text-sm font-bold
                        bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#1e40af]
                        text-white
                        shadow-[0_4px_14px_-4px_rgba(30,64,175,0.55)]
                        hover:shadow-[0_6px_20px_-4px_rgba(30,64,175,0.70)]
                        hover:scale-[1.02]
                        active:scale-[0.98]
                        transition-all duration-200
                        ring-1 ring-white/10
                    "
                >
                    {/* Corona premium */}
                    <span
                        className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 text-[10px] font-black text-amber-900 shadow-sm"
                        aria-hidden="true"
                    >
                        ✦
                    </span>
                    Mover estudiante
                    {/* Flecha */}
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="opacity-70">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Modal traslado */}
            <MoverEstudianteModal
                open={moverOpen}
                onClose={() => setMoverOpen(false)}
                studentName={contact.nombre}
                progresoId={contact.progresoId}
                onSuccess={() => {
                    setMoverOpen(false);
                    onMoverSuccess?.();
                }}
            />

            <div>
                <label className="text-xs text-neutral-500">Resultado de la llamada</label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {opciones.map((o) => (
                        <label key={o.value} className="flex items-center gap-2 rounded-lg ring-1 ring-black/10 bg-transparent px-3 py-2 cursor-pointer hover:bg-white/5">
                            <input type="radio" name="resultado" checked={resultado === o.value} onChange={() => setResultado(o.value)} className="accent-blue-600" />
                            <span className="text-sm">{o.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="mt-4">
                <label className="text-xs text-neutral-500">Observaciones</label>
                <textarea
                    className="mt-1 w-full min-h-[200px] rounded-lg ring-1 ring-black/10 px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Escribe aquí las observaciones..."
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    disabled={!resultado || busy}
                    onClick={async () => {
                        if (!resultado) return;
                        await onSubmit({ resultado, notas: obs || undefined });
                        setResultado(null);
                        setObs('');
                    }}
                    className="rounded-xl bg-neutral-900 text-white px-4 py-2 shadow-md hover:shadow-lg transition disabled:opacity-60"
                >
                    {busy ? 'Guardando…' : 'Enviar informe'}
                </button>
            </div>
        </section>
    );
}

/* =============== Panel de asistencias =============== */
function AttendancePanel({
    modulo,
    dia,
    onExit,
}: {
    modulo: SeedKey;
    dia: Day;
    onExit: () => void;
}) {
    const [day, setDay] = useState<Day>(dia);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<AgendadoRow[]>([]);
    const [marks, setMarks] = useState<Record<string, 'A' | 'N' | undefined>>({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from(V_AGENDADOS)
            .select('progreso_id,nombre,telefono,semana')
            .eq('modulo', modulo)
            .eq('dia', day)
            .order('nombre', { ascending: true });
        setRows(error ? [] : ((data ?? []) as AgendadoRow[]));
        setLoading(false);
    }, [modulo, day]);

    useEffect(() => { void load(); }, [load]);

    const toggle = (id: string, tipo: 'A' | 'N') =>
        setMarks((m) => ({ ...m, [id]: m[id] === tipo ? undefined : tipo }));

    const enviar = async () => {
        const entradas = Object.entries(marks).filter(([, v]) => v);
        if (entradas.length === 0) return;
        setSaving(true);
        try {
            for (const [progId, v] of entradas) {
                const { error } = await supabase.rpc('fn_marcar_asistencia', { p_progreso: progId, p_asistio: v === 'A' });
                if (error) throw error;
            }
            setMarks({});
            await load();
        } finally { setSaving(false); }
    };

    return (
        <section className="animate-cardIn rounded-[18px] ring-1 ring-black/5 shadow-[0_12px_30px_-16px_rgba(16,24,40,.28)] overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-[linear-gradient(135deg,#eaf3ff,#f8f1ff)]">
                <div>
                    <h3 className="text-[15px] md:text-base font-semibold text-neutral-900">Listado Estudiantes Día {day} — Semillas {modulo}</h3>
                    <p className="text-neutral-500 text-xs">Agendados que confirmaron asistencia.</p>
                </div>
                <div className="flex items-center gap-2">
                    {(['Domingo', 'Martes', 'Virtual'] as Day[]).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDay(d)}
                            className={`text-sm font-semibold rounded-full px-3 py-1.5 ring-1 shadow-sm transition ${day === d ? 'bg-neutral-900 text-white ring-black/10' : 'bg-white ring-black/10 hover:shadow-md'}`}
                        >
                            {d}
                        </button>
                    ))}
                    <button onClick={onExit} className="text-sm font-semibold rounded-full bg-white px-3 py-1.5 ring-1 ring-black/10 shadow-sm hover:shadow-md transition">
                        Salir
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="px-4 md:px-6 py-10 text-center text-neutral-500">Cargando…</div>
            ) : rows.length === 0 ? (
                <div className="px-4 md:px-6 py-10 text-center text-neutral-500">No hay agendados para este día.</div>
            ) : (
                <>
                    <ul className="divide-y divide-black/5">
                        {rows.map((e) => (
                            <li key={e.progreso_id} className="px-4 md:px-6 py-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-neutral-800 truncate">{e.nombre}</div>
                                    <div className="text-neutral-500 text-xs md:text-sm">{e.telefono ?? '—'}</div>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm mr-3">
                                    <input type="checkbox" checked={marks[e.progreso_id] === 'A'} onChange={() => toggle(e.progreso_id, 'A')} className="accent-emerald-600" />
                                    Asistió
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={marks[e.progreso_id] === 'N'} onChange={() => toggle(e.progreso_id, 'N')} className="accent-rose-600" />
                                    No asistió
                                </label>
                            </li>
                        ))}
                    </ul>

                    <div className="px-4 md:px-6 py-3 bg-neutral-50">
                        <button disabled={saving} onClick={enviar} className="rounded-xl bg-neutral-900 text-white px-4 py-2 shadow-md hover:shadow-lg transition disabled:opacity-60">
                            {saving ? 'Enviando…' : 'Enviar Reporte'}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}

/* ============================= Página ============================= */
export default function PageSemillas() {
    const [open, setOpen] = useState(false);
    const [seed, setSeed] = useState<SeedKey | null>(null);
    const [mode, setMode] = useState<Mode>('default');

    const [selectedSeedCard, setSelectedSeedCard] = useState<SeedKey | null>(null);

    const [contactView, setContactView] = useState<'weeks' | 'panel'>('weeks');
    const [activeWeek, setActiveWeek] = useState<Week | null>(null);
    const [activeDay, setActiveDay] = useState<Day | null>(null);

    const [loadingPend, setLoadingPend] = useState(false);
    const [pendientes, setPendientes] = useState<PendienteRow[]>([]);
    const [selectedProgreso, setSelectedProgreso] = useState<string | null>(null);
    const [savingCall, setSavingCall] = useState(false);

    // Estado para contadores: { '1': { 'Domingo': 5 }, ... }
    const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});

    // Cargar conteos al cambiar de semilla
    useEffect(() => {
        if (!seed) return;
        const fetchCounts = async () => {
            const { data } = await supabase
                .from(V_PENDIENTES_BASE)
                .select('semana, dia')
                .eq('etapa', 'Semillas')
                .eq('modulo', seed);

            if (!data) return;

            const map: Record<string, Record<string, number>> = {};
            data.forEach((r: any) => {
                const s = String(r.semana); // asegurar string key
                const d = r.dia;
                if (!map[s]) map[s] = {};
                map[s][d] = (map[s][d] || 0) + 1;
            });
            setCounts(map);
        };
        void fetchCounts();
    }, [seed]);

    const loadPendientes = useCallback(
        async (modulo: SeedKey, semana: Week, dia: Day) => {
            setLoadingPend(true);

            // 1) Traemos de HIST (para conservar llamada1/2/3 y todo tu UI actual)
            const { data: hist, error: errHist } = await supabase
                .from(V_PENDIENTES)
                .select('progreso_id,nombre,telefono,llamada1,llamada2,llamada3')
                .eq('modulo', modulo)
                .eq('semana', semana)
                .eq('dia', dia)
                .order('nombre', { ascending: true });

            if (errHist) {
                setPendientes([]);
                setLoadingPend(false);
                return;
            }

            // 2) Obtenemos los IDs válidos de Semillas usando la vista BASE (que sí tiene `etapa`)
            const { data: base, error: errBase } = await supabase
                .from(V_PENDIENTES_BASE)
                .select('progreso_id')
                .eq('etapa', 'Semillas')
                .eq('modulo', modulo)
                .eq('semana', semana)
                .eq('dia', dia);

            if (errBase) {
                // Si por cualquier motivo fallara, mostramos HIST completo (comportamiento anterior)
                setPendientes((hist ?? []) as PendienteRow[]);
                setLoadingPend(false);
                return;
            }

            const allowed = new Set((base ?? []).map((r: any) => r.progreso_id));
            const filtrado = (hist ?? []).filter((r: any) => allowed.has(r.progreso_id));

            setPendientes(filtrado as PendienteRow[]);
            setLoadingPend(false);
        },
        []
    );

    useEffect(() => {
        if (mode !== 'contactos' || contactView !== 'panel') return;
        if (!seed || !activeWeek || !activeDay) return;
        void loadPendientes(seed, activeWeek, activeDay);
    }, [mode, contactView, seed, activeWeek, activeDay, loadPendientes]);

    const handleOpen = (s: SeedKey) => {
        setSelectedSeedCard(s);
        setSeed(s);
        setOpen(true);
    };

    const selectedContact = useMemo(() => {
        if (!selectedProgreso) return null;
        const found = pendientes.find((x) => x.progreso_id === selectedProgreso);
        if (!found || !activeWeek || !activeDay) return null;
        return {
            progresoId: found.progreso_id,
            nombre: found.nombre,
            tel: found.telefono,
            semana: activeWeek,
            dia: activeDay,
            hist: [found.llamada1 ?? null, found.llamada2 ?? null, found.llamada3 ?? null] as (Resultado | null)[],
        };
    }, [selectedProgreso, pendientes, activeWeek, activeDay]);

    return (
        <main
            className="min-h-screen w-full flex justify-center items-start px-5 md:px-8 pt-2 pb-6 animate-premiumFade"
            style={{
                fontFamily: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Helvetica Neue', Arial, sans-serif`,
            }}
        >
            {/* Tarjeta principal */}
            <div className="relative z-10 w-full max-w-[1200px] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5">

                {/* Fondo transparente */}
                <div className="absolute inset-0 bg-transparent"></div>


                {/* Contenido */}
                <div className="relative p-8 md:p-12 space-y-6">
                    <header className="mb-4 md:mb-6">
                        <h1 className="text-[26px] md:text-[34px] font-semibold tracking-tight text-neutral-900">
                            Panel de Semillas
                        </h1>
                        <p className="text-neutral-700 text-sm md:text-base">
                            Gestión rápida de módulos y seguimiento.
                        </p>
                    </header>

                    {/* Semillas */}
                    <div className="flex flex-col gap-4 md:flex-row md:flex-nowrap md:items-stretch md:gap-6">
                        <div className="w-full md:basis-1/4 md:min-w-0">
                            <SeedCard index={0} id="1" onClick={() => handleOpen(1)} selected={selectedSeedCard === 1} />
                        </div>
                        <div className="w-full md:basis-1/4 md:min-w-0">
                            <SeedCard index={1} id="2" onClick={() => handleOpen(2)} selected={selectedSeedCard === 2} />
                        </div>
                        <div className="w-full md:basis-1/4 md:min-w-0">
                            <SeedCard index={2} id="3" onClick={() => handleOpen(3)} selected={selectedSeedCard === 3} />
                        </div>
                        <div className="w-full md:basis-1/4 md:min-w-0">
                            <SeedCard index={3} id="4" onClick={() => handleOpen(4)} selected={selectedSeedCard === 4} />
                        </div>
                    </div>




                    {/* CONTENIDO */}
                    {mode === 'contactos' ? (
                        contactView === 'panel' && activeWeek && activeDay && seed ? (
                            <>
                                <div className="mt-6 md:mt-7 flex items-baseline gap-3">
                                    <h2 className="text-lg md:text-xl font-semibold text-neutral-900 animate-cardIn">Llamadas pendientes Semilla {seed}</h2>
                                    <span className="text-neutral-500 text-sm animate-cardIn" style={{ animationDelay: '60ms' }}>
                                        Semana {activeWeek} • {activeDay}
                                    </span>
                                    <button
                                        className="ml-auto rounded-lg px-3 py-1.5 text-sm ring-1 ring-black/10 bg-white shadow-sm hover:shadow-md transition"
                                        onClick={() => {
                                            setContactView('weeks');
                                            setSelectedProgreso(null);
                                        }}
                                    >
                                        Volver
                                    </button>
                                </div>

                                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                                    {loadingPend ? (
                                        <section className="rounded-[16px] bg-white ring-1 ring-black/5 p-6 text-center text-neutral-500 shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)]">
                                            Cargando…
                                        </section>
                                    ) : (
                                        <CallsList
                                            items={pendientes.map((p) => ({
                                                id: p.progreso_id,
                                                nombre: p.nombre,
                                                tel: p.telefono,
                                                history: [p.llamada1 ?? null, p.llamada2 ?? null, p.llamada3 ?? null],
                                            }))}
                                            onSelect={(id) => setSelectedProgreso(id)}
                                        />
                                    )}

                                    {selectedContact ? (
                                        <FollowUpForm
                                            key={selectedContact.progresoId} contact={{
                                                progresoId: selectedContact.progresoId,
                                                nombre: selectedContact.nombre,
                                                tel: selectedContact.tel,
                                                semana: selectedContact.semana,
                                                dia: selectedContact.dia,
                                            }}
                                            prevHist={selectedContact.hist}
                                            busy={savingCall}
                                            onMoverSuccess={async () => {
                                                if (!seed || !activeWeek || !activeDay) return;
                                                await loadPendientes(seed, activeWeek, activeDay);
                                                setSelectedProgreso(null);
                                            }}
                                            onSubmit={async ({ resultado, notas }) => {
                                                if (!seed || !activeWeek || !activeDay || !selectedContact) return;
                                                setSavingCall(true);
                                                try {
                                                    const { error } = await supabase.rpc(RPC_GUARDAR_LLAMADA, {
                                                        p_progreso: selectedContact.progresoId,
                                                        p_semana: activeWeek,
                                                        p_dia: activeDay,
                                                        p_resultado: resultado,
                                                        p_notas: notas ?? null,
                                                    });
                                                    if (error) throw error;

                                                    await loadPendientes(seed, activeWeek, activeDay);
                                                    setSelectedProgreso(null);
                                                } catch (e: any) {
                                                    alert(e?.message ?? 'Error al guardar');
                                                } finally {
                                                    setSavingCall(false);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <section className="animate-cardIn rounded-[16px] bg-white shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5 grid place-items-center text-neutral-500">
                                            <div className="p-6 text-center">Selecciona un nombre de la lista para ver/editar el detalle.</div>
                                        </section>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="mt-6 md:mt-7 text-lg md:text-xl font-semibold text-neutral-900 animate-cardIn" style={{ animationDelay: '20ms' }}>
                                    Llamadas pendientes
                                </h2>
                                <div className="flex flex-col gap-4 md:flex-row md:flex-nowrap md:items-stretch md:gap-6 mt-3">
                                    <div className="w-full md:flex-1 md:min-w-0">
                                        <WeekCard
                                            week={1}
                                            counts={counts['1']}
                                            onPick={(day) => {
                                                setActiveWeek(1);
                                                setActiveDay(day);
                                                setContactView('panel');
                                            }}
                                        />
                                    </div>
                                    <div className="w-full md:flex-1 md:min-w-0">
                                        <WeekCard
                                            week={2}
                                            delay={80}
                                            counts={counts['2']}
                                            onPick={(day) => {
                                                setActiveWeek(2);
                                                setActiveDay(day);
                                                setContactView('panel');
                                            }}
                                        />
                                    </div>
                                    <div className="w-full md:flex-1 md:min-w-0">
                                        <WeekCard
                                            week={3}
                                            delay={160}
                                            counts={counts['3']}
                                            onPick={(day) => {
                                                setActiveWeek(3);
                                                setActiveDay(day);
                                                setContactView('panel');
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )
                    ) : mode === 'asistencias' ? (
                        <div className="mt-2 md:mt-3">
                            {seed ? (
                                <AttendancePanel modulo={seed} dia="Domingo" onExit={() => setMode('default')} />
                            ) : (
                                <section className="rounded-[16px] bg-white ring-1 ring-black/5 p-6 text-center text-neutral-500 shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)]">
                                    Selecciona una Semilla para ver asistencias.
                                </section>
                            )}
                        </div>
                    ) : (
                        <div className="mt-2 md:mt-3 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                            <section className="rounded-[16px] bg-white shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5">
                                <header className="px-4 md:px-5 py-3 border-b border-black/5">
                                    <h2 className="text-base md:text-lg font-semibold text-neutral-900">Total Llamadas Pendientes Semillas</h2>
                                    <p className="text-neutral-500 text-xs md:text-sm">Tareas para hoy.</p>
                                </header>
                                <div className="px-4 md:px-5 py-6 text-neutral-500 text-sm">Selecciona una Semilla para comenzar.</div>
                            </section>

                            <section className="rounded-[16px] bg-white shadow-[0_10px_28px_-14px_rgba(16,24,40,.28)] ring-1 ring-black/5">
                                <header className="px-4 md:px-5 py-3 border-b border-black/5">
                                    <h2 className="text-base md:text-lg font-semibold text-neutral-900">Asistencia programada Domingo, Martes</h2>
                                    <p className="text-neutral-500 text-xs md:text-sm">Usa el modal para entrar al listado real.</p>
                                </header>
                                <div className="px-4 md:px-5 py-6 text-neutral-500 text-sm">Abre una Semilla y elige “Asistencias”.</div>
                            </section>
                        </div>
                    )}

                    <div className="h-4" />
                </div>
            </div>

            {/* Estilos locales */}
            <style jsx global>{`
                @keyframes cardIn {
                    0% { opacity: 0; transform: translateY(14px) scale(0.98); filter: blur(3px); }
                    60% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-cardIn { animation: cardIn 0.48s cubic-bezier(0.22,1,0.36,1) both; }

                .accent-line {
                    background-size: 200% 100%;
                    animation: accentMove 3.2s ease-in-out infinite;
                }
                @keyframes accentMove {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                /* ===== Modal Semillas: Responsive vertical ===== */
                @media (max-width: 640px){
                    /* fuerza disposición vertical en el contenido del modal */
                    .seed-modal{ display: grid; grid-auto-flow: row; align-content: start; gap: 14px; }
                    .seed-modal__options{ display: grid; grid-template-columns: 1fr; gap: 10px; }
                    /* cualquier contenedor flex interno en el modal -> columna */
                    .seed-modal :is(.flex, .inline-flex){ flex-direction: column !important; align-items: stretch !important; }
                    /* botones a ancho completo en móvil */
                    .seed-modal button{ width: 100%; }
                }

Codex: Set API Key



            `}</style>

            {/* Modal */}
            <Modal
                open={open}
                onClose={() => setOpen(false)}
                seed={seed}
                onSelect={(m) => {
                    setMode(m);
                    if (m === 'contactos') {
                        setContactView('weeks');
                        setActiveWeek(null);
                        setActiveDay(null);
                        setSelectedProgreso(null);
                    }
                }}
            />
        </main>
    );
}


