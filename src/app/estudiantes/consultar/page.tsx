// File: src/app/estudiantes/consultar/page.tsx
'use client';

// Safelist para colores dinámicos
const _tw = `bg-rose-500 bg-amber-400 bg-emerald-500`;

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { buscarEstudiantes } from '@/lib/academico';
import { useToast } from '@/components/ToastProvider';

// Tipos UI
type UIStudent = {
    id: string;
    nombre: string;
    telefono?: string;
    cedula?: string;
    pais?: string;
    ciudad?: string;
    direccion?: string;
    congregacion?: string;
};

type AvanceMap = Record<number, number>;
type PromMap = Record<number, number | null>;

const cls = (...s: (string | false | undefined)[]) => s.filter(Boolean).join(' ');
const safePercent = (p: unknown) => {
    const n = Number(p ?? 0);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
};
const safeProm = (n: unknown) => {
    if (n == null) return null;
    const v = Number(n);
    if (Number.isNaN(v)) return null;
    return Number(Math.max(0, Math.min(10, v)).toFixed(1));
};

const barraColor = (p: number) => (p <= 50 ? 'bg-rose-500' : p < 100 ? 'bg-amber-400' : 'bg-emerald-500');
const cardGradient = (n: number) =>
    n === 1
        ? 'from-[#4f46e5] via-[#3b82f6] to-[#22d3ee]'
        : n === 2
            ? 'from-[#06b6d4] via-[#22d3ee] to-[#34d399]'
            : n === 3
                ? 'from-[#ec4899] via-[#f43f5e] to-[#fb7185]'
                : n === 4
                    ? 'from-[#2563eb] via-[#38bdf8] to-[#60a5fa]'
                    : 'from-[#64748b] via-[#94a3b8] to-[#cbd5e1]';
const cardChrome = 'rounded-3xl p-5 shadow-xl ring-1 ring-white/15 backdrop-blur-md relative overflow-hidden min-h-[140px]';
const titleStyle = 'text-white font-extrabold text-[1.15rem] tracking-wide leading-none';
const subtitleStyle = 'text-white/80 text-xs';

// ---------- SearchBox ----------
function SearchBox({
                       value,
                       onChange,
                       results,
                       loading,
                       onSelect,
                   }: {
    value: string;
    onChange: (v: string) => void;
    results: UIStudent[];
    loading: boolean;
    onSelect: (e: UIStudent) => void;
}) {
    const [active, setActive] = useState<number>(-1);
    const listRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        itemRefs.current = new Array(results.length);
        setActive(results.length > 0 ? 0 : -1);
    }, [results, value]);

    const hasItems = results.length > 0;
    const activeInRange = active >= 0 && active < results.length;
    const activeId = activeInRange ? `opt-${results[active]!.id}` : undefined;

    const move = (dir: 1 | -1) => {
        if (!hasItems) return;
        const next = active < 0 ? (dir === 1 ? 0 : results.length - 1) : (active + dir + results.length) % results.length;
        setActive(next);
        requestAnimationFrame(() => itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                move(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                move(-1);
                break;
            case 'Enter':
                if (hasItems && activeInRange) {
                    e.preventDefault();
                    onSelect(results[active]);
                }
                break;
            case 'Escape':
                setActive(-1);
                break;
        }
    };

    return (
        <div className="relative w-full max-w-2xl mx-auto">
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar por nombre, cédula o teléfono"
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 pr-12 text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                role="combobox"
                aria-expanded={Boolean(value && hasItems)}
                aria-controls="lista-estudiantes"
                aria-activedescendant={activeId}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
        {loading ? <span className="inline-block animate-spin">⏳</span> : '🔎'}
      </span>

            {value && hasItems && (
                <div
                    id="lista-estudiantes"
                    ref={listRef}
                    role="listbox"
                    className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl max-h-80 overflow-auto"
                >
                    {results.map((e, i) => (
                        <button
                            key={e.id}
                            id={`opt-${e.id}`}
                            role="option"
                            aria-selected={i === active}
                            ref={(el) => {
                                itemRefs.current[i] = el;
                            }}
                            onMouseEnter={() => setActive(i)}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => onSelect(e)}
                            className={'w-full text-left px-4 py-3 ' + (i === active ? 'bg-slate-100' : 'hover:bg-slate-50')}
                        >
                            <div className="font-medium">{e.nombre}</div>
                            <div className="text-xs text-slate-500">{e.cedula || '—'} · {e.telefono || '—'}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------- Tarjeta de semestre ----------
function SemesterCard({
                          n,
                          percent,
                          promedio,
                          onOpen,
                      }: {
    n: number;
    percent: number;
    promedio?: number | null;
    onOpen: () => void;
}) {
    const p = safePercent(percent);
    const prom = safeProm(promedio);
    return (
        <button onClick={onOpen} className={cls('transition hover:scale-[1.01]', cardChrome, `bg-gradient-to-br ${cardGradient(n)}`)}>
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute -left-8 -bottom-10 h-28 w-28 rounded-full bg-white/10 blur-xl" />

            <div className="flex items-baseline justify-between mb-3 relative z-10">
                <div className={titleStyle}>Semestre {n}</div>
                <div className="text-white/90 font-bold leading-none translate-y-[1px]">{p}%</div>
            </div>

            <div className="h-3 w-full rounded-full bg-white/25 overflow-hidden relative z-10">
                <div
                    className={cls('h-3 rounded-full transition-[width] duration-500 ease-out', p === 0 ? 'bg-transparent' : barraColor(p))}
                    style={{ width: p === 0 ? 0 : `${p}%` }}
                />
            </div>

            <div className="mt-2 flex items-end justify-between relative z-10">
                <div className={subtitleStyle}>
                    {p <= 50 && 'Rojo: ≤50% completado'}
                    {p > 50 && p < 100 && 'Amarillo: >50% y <100%'}
                    {p === 100 && 'Verde: completado'}
                </div>
                <div className="text-white font-extrabold text-4xl md:text-5xl leading-none tabular-nums drop-shadow-sm">
                    {prom == null ? '—' : prom.toFixed(1)}
                </div>
            </div>
        </button>
    );
}

// ---------- Panel de datos del estudiante ----------
const initials = (n?: string) =>
    (n ?? '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || '—';

function InfoRow({
                     label,
                     value,
                     href,
                     icon,
                 }: {
    label: string;
    value?: string | null;
    href?: string;
    icon: ReactNode;
}) {
    const content =
        value && href ? (
            <a href={href} className="text-slate-800 hover:text-blue-700 underline decoration-blue-200 break-all">
                {value}
            </a>
        ) : (
            <span className="text-slate-800 break-all">{value ?? '—'}</span>
        );

    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 text-blue-600">{icon}</span>
            <div className="text-sm">
                <div className="font-semibold text-slate-600">{label}</div>
                <div className="leading-5">{content}</div>
            </div>
        </div>
    );
}

function Profile({
                     e,
                     onOpen,
                 }: {
    e?: UIStudent;
    onOpen: () => void;
}) {
    if (!e)
        return (
            <div className="rounded-3xl bg-white/80 backdrop-blur-md ring-1 ring-slate-200 shadow-xl p-6">
                <div className="text-slate-500">Selecciona un estudiante…</div>
            </div>
        );

    return (
        <button
            onClick={onOpen}
            className="
        group w-full text-left rounded-3xl overflow-hidden
        shadow-xl ring-1 ring-slate-200 bg-white transition
        hover:-translate-y-0.5 hover:shadow-2xl hover:ring-blue-300/40
        focus:outline-none focus:ring-4 focus:ring-blue-100
      "
            aria-label="Abrir datos del estudiante"
        >
            {/* Header */}
            <div className="relative px-6 py-5 bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-cyan-400/20 backdrop-blur-sm">
                <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-sky-300/30 blur-2xl transition group-hover:scale-110" />
                <div className="absolute -right-8 -bottom-8 h-20 w-20 rounded-full bg-indigo-300/25 blur-2xl transition group-hover:scale-110" />
                <div className="flex items-center gap-4 relative">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white grid place-items-center font-bold">
                        {initials(e.nombre)}
                    </div>
                    <div>
                        <div className="text-lg font-extrabold text-blue-900 leading-tight">{e.nombre}</div>
                        <div className="text-xs text-slate-600">Perfil del estudiante</div>
                    </div>
                </div>
            </div>

            {/* Cuerpo */}
            <div className="p-6 grid gap-4">
                <InfoRow
                    label="Teléfono"
                    value={e.telefono ?? undefined}
                    href={e.telefono ? `tel:${e.telefono}` : undefined}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1v3.48a1 1 0 01-.92 1A18.91 18.91 0 013 5.92 1 1 0 014 5h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" />
                        </svg>
                    }
                />

                <InfoRow
                    label="Cédula"
                    value={e.cedula ?? undefined}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm2 4h8v2H6V8zm0 4h12v2H6v-2z" />
                        </svg>
                    }
                />

                <InfoRow
                    label="País / Ciudad"
                    value={[e.pais ?? '—', e.ciudad].filter(Boolean).join(e.ciudad ? ' · ' : '')}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7zm0 9a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                    }
                />

                <InfoRow
                    label="Dirección"
                    value={e.direccion ?? undefined}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M3 10l9-7 9 7v9a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2v-9z" />
                        </svg>
                    }
                />

                <InfoRow
                    label="Congregación"
                    value={e.congregacion ?? undefined}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" />
                        </svg>
                    }
                />
            </div>
        </button>
    );
}

// ---------- Panel de edición de estudiante ----------
function StudentPanel({
                          open,
                          onClose,
                          student,
                          onSaved,
                          onDeleted,
                      }: {
    open: boolean;
    onClose: () => void;
    student: UIStudent;
    onSaved: (s: UIStudent) => void;
    onDeleted: () => void;
}) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<UIStudent>(student);
    useEffect(() => setForm(student), [student?.id]);

    const set = (k: keyof UIStudent, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const inputCls =
        'w-full rounded-xl border border-white/10 bg-white/15 text-white placeholder-white/50 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-cyan-400/30';

    // Guardar -> PATCH /api
    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: student.id,
                    nombre: form.nombre ?? '',
                    telefono: form.telefono ?? null,
                    cedula: form.cedula ?? null,
                    pais: form.pais ?? null,
                    ciudad: form.ciudad ?? null,
                    direccion: form.direccion ?? null,
                    congregacion: form.congregacion ?? null,
                }),
            });

            const j = await res.json().catch(() => ({}));
            if (!res.ok || j?.ok === false) {
                toast.error('No se pudo actualizar el estudiante.');
                return;
            }

            toast.success('Estudiante actualizado ✅');
            onSaved(form);
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Error actualizando.');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar -> DELETE /api
    const handleDelete = async () => {
        const ok = confirm('¿Eliminar este estudiante y sus notas? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
            setSaving(true);
            const res = await fetch('/api', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: student.id }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || j?.ok === false) {
                toast.error('No se pudo eliminar.');
                return;
            }
            toast.success('Estudiante eliminado 🗑️');
            onDeleted();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Error eliminando.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={cls('fixed inset-0 z-50 transition', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute inset-y-4 right-4 left-4 lg:left-auto lg:w-[800px] flex">
                <div
                    className="
            relative w-full max-h-[calc(100vh-2rem)]
            rounded-[22px] shadow-2xl ring-1 ring-white/15
            bg-gradient-to-br from-[#0ea5e9]/30 via-[#0b3ea7]/50 to-[#0ea5e9]/25
            backdrop-blur-xl text-white overflow-hidden
          "
                >
                    <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-2xl" />
                    <div className="pointer-events-none absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />

                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                        <div className="font-semibold">
                            <span className="opacity-90">Datos del Estudiante</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/15"
                            aria-label="Cerrar"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 56px)' }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-white/70 mb-1">Nombre</div>
                                <input value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <div className="text-xs text-white/70 mb-1">Teléfono</div>
                                <input value={form.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <div className="text-xs text-white/70 mb-1">Cédula</div>
                                <input value={form.cedula ?? ''} onChange={(e) => set('cedula', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <div className="text-xs text-white/70 mb-1">País</div>
                                <input value={form.pais ?? ''} onChange={(e) => set('pais', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <div className="text-xs text-white/70 mb-1">Ciudad</div>
                                <input value={form.ciudad ?? ''} onChange={(e) => set('ciudad', e.target.value)} className={inputCls} />
                            </div>
                            <div className="md:col-span-2">
                                <div className="text-xs text-white/70 mb-1">Dirección</div>
                                <input value={form.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} className={inputCls} />
                            </div>
                            <div className="md:col-span-2">
                                <div className="text-xs text-white/70 mb-1">Congregación</div>
                                <input value={form.congregacion ?? ''} onChange={(e) => set('congregacion', e.target.value)} className={inputCls} />
                            </div>
                        </div>

                        <div className="pt-5 mt-6 border-t border-white/10 flex items-center gap-3">
                            <button
                                disabled={saving}
                                onClick={handleSave}
                                className="
                  rounded-xl px-4 py-2 font-semibold
                  bg-gradient-to-r from-cyan-400 to-sky-500
                  text-slate-900 hover:from-cyan-300 hover:to-sky-400
                  disabled:opacity-60 disabled:cursor-not-allowed
                  shadow-lg shadow-cyan-500/20
                "
                            >
                                {saving ? 'Guardando…' : 'Actualizar Estudiante'}
                            </button>

                            <button
                                disabled={saving}
                                onClick={handleDelete}
                                className="
                  rounded-xl px-4 py-2 font-semibold
                  border border-rose-300/60 text-rose-100
                  hover:bg-rose-500/20 hover:border-rose-300/80
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
                            >
                                Eliminar Estudiante
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------- Panel de Notas ----------
type SerieDetalle = { id: number; titulo?: string; clases: { id: number; etiqueta: string; nota: number | null }[] };

function SemesterPanel({
                           open,
                           onClose,
                           estudianteId,
                           estudianteNombre,
                           semestre,
                           onUpdated, // 👈 avisa al padre
                       }: {
    open: { numero: number } | null;
    onClose: () => void;
    estudianteId: string;
    estudianteNombre: string;
    semestre: number | null;
    onUpdated: () => void;
}) {
    const toast = useToast();

    const [series, setSeries] = useState<SerieDetalle[]>([]);
    const [activeSerie, setActiveSerie] = useState<number | null>(null);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const semNum = open?.numero ?? semestre ?? null;

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!open || !estudianteId || !semNum) return;
            setLoading(true);
            try {
                const r = await fetch(`/api/estudiantes/buscar?id=${estudianteId}&detalle=1&semestre=${semNum}`, { cache: 'no-store' });
                const j = await r.json();
                if (!alive) return;

                const s = (j?.series ?? []) as SerieDetalle[];
                setSeries(s);
                setActiveSerie(s[0]?.id ?? null);

                const d: Record<number, string> = {};
                s.forEach((serie) =>
                    serie.clases.forEach((c) => {
                        if (c.nota != null) d[c.id] = String(c.nota);
                    }),
                );
                setDraft(d);
            } catch (e) {
                console.error('detalle semestre:', e);
                setSeries([]);
                setActiveSerie(null);
                setDraft({});
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [open?.numero, estudianteId, semNum]);

    const clases = series.find((s) => s.id === activeSerie)?.clases ?? [];

    const handleGuardar = async () => {
        try {
            setSaving(true);
            const payload = {
                estudianteId,
                notas: clases
                    .map((c) => {
                        const raw = draft[c.id];
                        if (raw === undefined) return null;
                        const parsed = raw === '' ? null : Number(raw);
                        if (parsed != null && (Number.isNaN(parsed) || parsed < 0 || parsed > 10)) return null; // 0–10
                        return { clase_id: c.id, nota: parsed };
                    })
                    .filter(Boolean),
            };

            const res = await fetch('/api/estudiantes/buscar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await res.json();

            if (!res.ok || !j?.ok) {
                console.error('Guardar notas error:', j);
                toast.error?.('No se pudieron guardar las notas.');
                return;
            }

            toast.success?.('Notas actualizadas ✅');
            onUpdated?.(); // refresca tarjetas en el padre
            onClose();
        } catch (e) {
            console.error('Guardar notas:', e);
            toast.error?.('Error guardando notas.');
        } finally {
            setSaving(false);
        }
    };

    const nombreVis = (estudianteNombre ?? '').trim() || 'Estudiante';

    return (
        <div className={cls('fixed inset-0 z-50 transition', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="absolute inset-y-4 right-4 left-4 lg:left-auto lg:w-[980px] flex">
                <div
                    className="
            relative w-full max-h-[calc(100vh-2rem)]
            rounded-[22px] shadow-2xl ring-1 ring-white/15
            bg-gradient-to-br from-[#0ea5e9]/30 via-[#0b3ea7]/50 to-[#0ea5e9]/25
            backdrop-blur-xl text-white overflow-hidden
          "
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                        <div className="font-semibold">
                            <span className="opacity-90" title={nombreVis}>{nombreVis}</span>
                            <span className="opacity-70"> · Semestre {semNum}</span>
                        </div>
                        <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Cerrar">
                            ✕
                        </button>
                    </div>

                    {/* Contenido */}
                    <div className="grid grid-cols-1 md:grid-cols-3 min-h-0" style={{ height: 'calc(100% - 56px)' }}>
                        {/* Series */}
                        <aside className="border-r border-white/10 p-4 overflow-y-auto">
                            <div className="text-sm font-semibold mb-3 text-white/90">Series</div>
                            {loading && <div className="text-xs text-white/70">Cargando…</div>}

                            <div className="grid gap-2">
                                {series.map((s) => {
                                    const active = activeSerie === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setActiveSerie(s.id)}
                                            className={
                                                'w-full text-left px-3 py-2 rounded-2xl border transition ' +
                                                (active ? 'bg-cyan-500 text-white border-transparent shadow-cyan-500/30 shadow' : 'bg-white/10 hover:bg-white/15 text-white/90 border-white/10')
                                            }
                                        >
                                            {s.titulo ?? `Serie ${s.id}`}
                                        </button>
                                    );
                                })}
                                {!loading && series.length === 0 && <div className="text-xs text-white/70">Este semestre no tiene series.</div>}
                            </div>
                        </aside>

                        {/* Notas */}
                        <section className="md:col-span-2 p-4 flex flex-col min-h-0">
                            <div className="text-sm font-semibold mb-3 text-white/90">Notas de la serie</div>

                            <div className="flex-1 overflow-y-auto pr-1">
                                {clases.length === 0 ? (
                                    <div className="text-xs text-white/70">Selecciona una serie para ver sus clases.</div>
                                ) : (
                                    <div className="grid gap-2">
                                        {clases.map((c) => (
                                            <div key={c.id} className="grid grid-cols-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                                <div className="col-span-7 sm:col-span-8 text-white/90">{c.etiqueta}</div>
                                                <div className="col-span-5 sm:col-span-4">
                                                    <input
                                                        inputMode="decimal"
                                                        placeholder="—"
                                                        value={draft[c.id] ?? ''}
                                                        onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                                                        className="
                              w-full rounded-xl border
                              border-white/10 bg-white/15 text-white placeholder-white/50
                              px-3 py-2 focus:outline-none focus:ring-4 focus:ring-cyan-400/30
                            "
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 mt-4 border-t border-white/10">
                                <button
                                    disabled={saving || clases.length === 0}
                                    onClick={handleGuardar}
                                    className="
                    rounded-xl px-4 py-2 font-semibold
                    bg-gradient-to-r from-cyan-400 to-sky-500
                    text-slate-900 hover:from-cyan-300 hover:to-sky-400
                    disabled:opacity-60 disabled:cursor-not-allowed
                    shadow-lg shadow-cyan-500/20
                  "
                                >
                                    {saving ? 'Guardando…' : 'Actualizar notas'}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Debounce
function useDebounce<T>(value: T, delay = 250) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const h = setTimeout(() => setV(value), delay);
        return () => clearTimeout(h);
    }, [value, delay]);
    return v;
}

/* ====== anti-parpadeo del spinner ====== */
function useDelayedFlag(flag: boolean, delay = 150) {
    const [show, setShow] = useState(false);
    useEffect(() => {
        let t: any;
        if (flag) t = setTimeout(() => setShow(true), delay);
        else setShow(false);
        return () => t && clearTimeout(t);
    }, [flag, delay]);
    return show;
}

/* ====== caché simple por prefijo (TS-safe) ====== */
function useSearchCache(limit = 30) {
    const ref = useRef<Map<string, UIStudent[]>>(new Map<string, UIStudent[]>());

    const get = (k: string) => ref.current.get(k);

    const set = (k: string, v: UIStudent[]) => {
        if (ref.current.has(k)) ref.current.delete(k); // move-to-front
        ref.current.set(k, v);

        if (ref.current.size > limit) {
            const iter = ref.current.keys().next();
            if (!iter.done) {
                ref.current.delete(iter.value);
            }
        }
    };

    const bestPrefix = (q: string) => {
        let best: string | null = null;
        for (const key of ref.current.keys()) {
            if (q.startsWith(key) && (!best || key.length > best.length)) best = key;
        }
        return best ? (ref.current.get(best) ?? []) : [];
    };

    return { get, set, bestPrefix };
}

// ---------- Página ----------
export default function Page() {
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<UIStudent[]>([]);
    const [sel, setSel] = useState<UIStudent | undefined>(undefined);

    const [avance, setAvance] = useState<AvanceMap>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const [promedios, setPromedios] = useState<PromMap>({ 1: null, 2: null, 3: null, 4: null, 5: null });

    const [openSem, setOpenSem] = useState<{ numero: number } | null>(null);
    const [openStudent, setOpenStudent] = useState(false);

    // tick para refrescar resumen tras guardar notas
    const [resumenTick, setResumenTick] = useState(0);
    const bumpResumen = () => setResumenTick((t) => t + 1);

    // debounce ágil
    const debounced = useDebounce(q, 120);

    // control de concurrencia y caché
    const cache = useSearchCache(30);
    const currentReq = useRef<number | null>(null);

    // spinner sólo si la espera es real
    const delayedLoading = useDelayedFlag(loading, 150);

    // Buscar estudiantes (SWR + caché por prefijo)
    useEffect(() => {
        let alive = true;
        const reqId = Math.random();

        const run = async () => {
            const q0 = debounced?.trim() ?? '';
            if (q0.length < 2) {
                setResults([]);
                setLoading(false);
                return;
            }

            // respuesta instantánea desde caché (normaliza campos)
            const qKey = q0.toLowerCase();
            const norm = (s?: string) => (s ?? '').toLowerCase();

            const instant = cache
                .bestPrefix(qKey)
                .filter(
                    (e) =>
                        norm(e.nombre).includes(qKey) ||
                        norm(e.cedula).includes(qKey) ||
                        norm(e.telefono).includes(qKey),
                )
                .slice(0, 8);

            if (instant.length) setResults(instant);

            // fetch real
            setLoading(true);
            try {
                const data = (await buscarEstudiantes(q0, 8)) as UIStudent[];
                if (!alive) return;
                if (reqId !== currentReq.current) return;
                cache.set(qKey, data);
                setResults(data);
            } catch (e) {
                if (alive) setResults(instant.length ? instant : []);
                console.error('Buscar estudiantes:', e);
            } finally {
                if (alive) setLoading(false);
            }
        };

        currentReq.current = reqId;
        run();

        return () => {
            alive = false;
        };
    }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cargar resumen (se refresca cuando cambia resumenTick)
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!sel?.id) {
                setAvance({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
                setPromedios({ 1: null, 2: null, 3: null, 4: null, 5: null });
                return;
            }
            const url = `/api/estudiantes/buscar?id=${sel.id}&resumen=1`;
            try {
                const r = await fetch(url, { cache: 'no-store' });
                const j = await r.json();
                if (!alive) return;

                const baseAvance: AvanceMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                const baseProm: PromMap = { 1: null, 2: null, 3: null, 4: null, 5: null };
                (Array.isArray(j?.resumen) ? j.resumen : []).forEach((sem: any) => {
                    const n = Number(sem?.numero);
                    if (n >= 1 && n <= 5) {
                        baseAvance[n] = safePercent(sem?.avance ?? 0);
                        baseProm[n] = safeProm(sem?.promedio);
                    }
                });
                setAvance(baseAvance);
                setPromedios(baseProm);
            } catch (e) {
                console.error('Resumen fetch error:', e);
            }
        })();
        return () => {
            alive = false;
        };
    }, [sel?.id, resumenTick]);

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
            <div className="px-6 py-5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900">Consulta de Estudiantes</h1>
            </div>

            <div className="mx-auto max-w-7xl px-6 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Izquierda: búsqueda + semestres */}
                    <section className="lg:col-span-2 space-y-6">
                        <div className="flex justify-center">
                            <SearchBox
                                value={q}
                                onChange={setQ}
                                results={results}
                                loading={delayedLoading}
                                onSelect={(e) => {
                                    setSel(e);
                                    setQ('');
                                    setResults([]);
                                }}
                            />
                        </div>

                        {/* Tarjetas Semestres */}
                        <div className="grid sm:grid-cols-2 gap-5">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <SemesterCard
                                    key={n}
                                    n={n}
                                    percent={avance[n] ?? 0}
                                    promedio={promedios[n] ?? null}
                                    onOpen={() => {
                                        if (!sel?.id) return;
                                        setOpenSem({ numero: n });
                                    }}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Derecha: datos personales (click abre panel) */}
                    <aside>
                        <Profile e={sel} onOpen={() => sel?.id && setOpenStudent(true)} />
                    </aside>
                </div>
            </div>

            {/* Panel de edición de notas */}
            {sel?.id && (
                <SemesterPanel
                    open={openSem}
                    onClose={() => setOpenSem(null)}
                    estudianteId={sel.id}
                    estudianteNombre={sel.nombre}
                    semestre={openSem?.numero ?? null}
                    onUpdated={bumpResumen} // refresca tarjetas al guardar
                />
            )}

            {/* Panel de edición de estudiante */}
            {sel && (
                <StudentPanel
                    open={openStudent}
                    onClose={() => setOpenStudent(false)}
                    student={sel}
                    onSaved={(s) => setSel(s)} // refresca el perfil en UI
                    onDeleted={() => {
                        // limpiar UI al eliminar
                        setSel(undefined);
                        setOpenStudent(false);
                        setAvance({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
                        setPromedios({ 1: null, 2: null, 3: null, 4: null, 5: null });
                    }}
                />
            )}
        </main>
    );
}
