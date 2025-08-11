// File: src/app/estudiantes/consultar/page.tsx
'use client';

// Safelist para colores dinámicos
const _tw = `bg-rose-500 bg-amber-400 bg-emerald-500`;

import { useEffect, useRef, useState } from 'react';
import { buscarEstudiantes } from '@/lib/academico';

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
    // ⬅️ Reemplaza la definición actual
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
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{loading ? '⏳' : '🔎'}</span>

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
                            ref={(el) => { itemRefs.current[i] = el; }}

                            onMouseEnter={() => setActive(i)}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => onSelect(e)}
                            className={'w-full text-left px-4 py-3 ' + (i === active ? 'bg-slate-100' : 'hover:bg-slate-50')}
                        >
                            <div className="font-medium">{e.nombre}</div>
                            <div className="text-xs text-slate-500">
                                {e.cedula || '—'} · {e.telefono || '—'}
                            </div>
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

function Profile({ e }: { e?: UIStudent }) {
    if (!e)
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-slate-500">Selecciona un estudiante…</div>
            </div>
        );
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-2 text-sm">
                <div className="text-xl font-bold text-blue-900">{e.nombre}</div>
                <div>
                    <span className="font-semibold text-slate-700">Teléfono: </span>
                    <span className="text-slate-700">{e.telefono ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Cédula: </span>
                    <span className="text-slate-700">{e.cedula ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">País / Ciudad: </span>
                    <span className="text-slate-700">
            {e.pais ?? '—'} {e.ciudad ? `· ${e.ciudad}` : ''}
          </span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Dirección: </span>
                    <span className="text-slate-700">{e.direccion ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Congregación: </span>
                    <span className="text-slate-700">{e.congregacion ?? '—'}</span>
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

// ---------- Panel de Notas ----------
import { useToast } from '@/components/ToastProvider'; // 👈 AJUSTA esta ruta si es necesario

type SerieDetalle = { id: number; titulo?: string; clases: { id: number; etiqueta: string; nota: number | null }[] };

function SemesterPanel({
                           open,
                           onClose,
                           estudianteId,
                           estudianteNombre,
                           semestre,
                       }: {
    open: { numero: number } | null;
    onClose: () => void;
    estudianteId: string;
    estudianteNombre: string;
    semestre: number | null;
}) {
    const toast = useToast(); // 👈 1) listo el toast

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
                    })
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
    const updateNota = (claseId: number, v: string) => setDraft((d) => ({ ...d, [claseId]: v }));

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
                toast.error('No se pudieron guardar las notas.'); // 👈 2) error
                return;
            }

            toast.success('Notas actualizadas ✅'); // 👈 3) éxito
            onClose();
        } catch (e) {
            console.error('Guardar notas:', e);
            toast.error('Error guardando notas.'); // 👈 error excepción
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={cls('fixed inset-0 z-50 transition', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
            <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
            <div className="absolute inset-y-0 right-0 w-full lg:w-[860px] max-w-full bg-white shadow-2xl flex flex-col max-h-screen">
                <div className="flex-none flex items-center justify-between px-6 py-4 border-b">
                    <div className="font-bold text-blue-900">
                        {estudianteNombre} · Semestre {semNum}
                    </div>
                    <button onClick={onClose} className="text-slate-600 hover:text-slate-900">✕</button>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 min-h-0">
                    <aside className="border-r p-4 overflow-y-auto">
                        <div className="text-slate-800 font-semibold mb-3">Series</div>
                        {loading && <div className="text-sm text-slate-500">Cargando…</div>}
                        <div className="grid gap-2">
                            {series.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSerie(s.id)}
                                    className={cls(
                                        'w-full text-left px-3 py-2 rounded-xl border',
                                        activeSerie === s.id ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-white hover:bg-slate-50 border-slate-200'
                                    )}
                                >
                                    {s.titulo ?? `Serie ${s.id}`}
                                </button>
                            ))}
                            {!loading && series.length === 0 && <div className="text-sm text-slate-500">Este semestre no tiene series.</div>}
                        </div>
                    </aside>

                    <section className="md:col-span-2 p-4 flex flex-col min-h-0">
                        <div className="text-slate-800 font-semibold mb-3">Notas de la serie</div>

                        <div className="flex-1 overflow-y-auto pr-1">
                            {clases.length === 0 ? (
                                <div className="text-sm text-slate-500">Selecciona una serie para ver sus clases.</div>
                            ) : (
                                <div className="grid gap-3">
                                    {clases.map((c) => (
                                        <div key={c.id} className="grid grid-cols-12 items-center gap-3 border rounded-xl px-3 py-2">
                                            <div className="col-span-7 sm:col-span-8 text-slate-800">{c.etiqueta}</div>
                                            <div className="col-span-5 sm:col-span-4">
                                                <input
                                                    inputMode="decimal"
                                                    placeholder="—"
                                                    value={draft[c.id] ?? ''}
                                                    onChange={(e) => updateNota(c.id, e.target.value)}
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 mt-4 border-t">
                            <button
                                disabled={saving || clases.length === 0}
                                onClick={handleGuardar}
                                className={cls(
                                    'rounded-xl px-4 py-2 font-semibold shadow-sm',
                                    saving ? 'bg-slate-300 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                                )}
                            >
                                {saving ? 'Guardando…' : 'Actualizar notas'}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
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

    const debounced = useDebounce(q, 250);

    // Buscar estudiantes
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!debounced || debounced.trim().length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const data = (await buscarEstudiantes(debounced.trim(), 8)) as UIStudent[];
                if (alive) setResults(data);
            } catch (e) {
                console.error('Buscar estudiantes:', e);
                if (alive) setResults([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [debounced]);

    // Cargar resumen
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
    }, [sel?.id]);

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
                                loading={loading}
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

                    {/* Derecha: datos personales */}
                    <aside>
                        <Profile e={sel} />
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
                />
            )}
        </main>
    );
}
