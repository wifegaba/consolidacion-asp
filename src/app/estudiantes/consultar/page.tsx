// File: src/app/estudiantes/consultar/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { buscarEstudiantes } from '@/lib/academico';

// —— Tipos de UI (solo campos válidos) ——
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
const barraColor = (p: number) =>
    p < 50 ? 'bg-rose-500' : p >= 90 ? 'bg-emerald-500' : p >= 60 ? 'bg-amber-400' : 'bg-slate-400';

// —— Componentes ——
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
    const itemRefs = useRef<HTMLButtonElement[]>([]);

    // Re-sincroniza refs y reinicia índice al cambiar texto o resultados
    useEffect(() => {
        itemRefs.current = new Array(results.length);
        // Si hay resultados, selecciona el primero, si no, -1
        setActive(results.length > 0 ? 0 : -1);
    }, [results, value]);

    const hasItems = Array.isArray(results) && results.length > 0;
    const activeInRange = active >= 0 && active < (results?.length ?? 0);
    const activeId = activeInRange ? `opt-${results[active]!.id}` : undefined;

    const move = (dir: 1 | -1) => {
        if (!hasItems) return;
        const next =
            active < 0 ? (dir === 1 ? 0 : results.length - 1) : (active + dir + results.length) % results.length;
        setActive(next);
        requestAnimationFrame(() => {
            itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        });
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
        {loading ? '⏳' : '🔎'}
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
                                if (el) itemRefs.current[i] = el;
                            }}
                            onMouseEnter={() => setActive(i)}
                            onMouseDown={(ev) => ev.preventDefault()} // evita perder el foco del input
                            onClick={() => onSelect(e)}
                            className={
                                'w-full text-left px-4 py-3 ' +
                                (i === active ? 'bg-slate-100' : 'hover:bg-slate-50')
                            }
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
    return (
        <button
            onClick={onOpen}
            className="group w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg transition"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="text-blue-900 font-semibold text-lg">Semestre {n}</div>
                <div className="text-slate-600 font-semibold">{percent ?? 0}%</div>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                    className={cls('h-3 rounded-full transition-all', barraColor(percent ?? 0))}
                    style={{ width: `${percent ?? 0}%` }}
                />
            </div>
            <div className="mt-2 text-xs text-slate-500">
                {(percent ?? 0) < 50 && 'Rojo: faltan >50%'}
                {(percent ?? 0) >= 60 && (percent ?? 0) < 90 && 'Amarillo: 60–89%'}
                {(percent ?? 0) >= 90 && 'Verde: 90–100%'}
            </div>
            <div className="mt-1 text-sm text-slate-700">
                Promedio: <b>{promedio == null ? '—' : Number(promedio).toFixed(1)}</b>
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

// —— Hook debounce pequeño ——
function useDebounce<T>(value: T, delay = 250) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const h = setTimeout(() => setV(value), delay);
        return () => clearTimeout(h);
    }, [value, delay]);
    return v;
}

// —— Página ——
export default function Page() {
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<UIStudent[]>([]);
    const [sel, setSel] = useState<UIStudent | undefined>(undefined);

    const [avance, setAvance] = useState<AvanceMap>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const [promedios, setPromedios] = useState<PromMap>({ 1: null, 2: null, 3: null, 4: null, 5: null });

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

    // Cargar resumen cuando hay estudiante seleccionado
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!sel?.id) return;
            const url = `/api/estudiantes/${sel.id}/resumen`;
            try {
                const r = await fetch(url, { cache: 'no-store' });
                if (!r.ok) {
                    console.error('Resumen status:', r.status, await r.text(), 'URL:', url);
                    return;
                }
                const j = await r.json();
                if (!alive) return;

                setAvance({
                    1: j?.resumen?.[1]?.avance ?? 0,
                    2: j?.resumen?.[2]?.avance ?? 0,
                    3: j?.resumen?.[3]?.avance ?? 0,
                    4: j?.resumen?.[4]?.avance ?? 0,
                    5: j?.resumen?.[5]?.avance ?? 0,
                });
                setPromedios({
                    1: j?.resumen?.[1]?.prom ?? null,
                    2: j?.resumen?.[2]?.prom ?? null,
                    3: j?.resumen?.[3]?.prom ?? null,
                    4: j?.resumen?.[4]?.prom ?? null,
                    5: j?.resumen?.[5]?.prom ?? null,
                });
            } catch (e) {
                console.error('Resumen fetch error:', e);
            }
        })();
        return () => {
            alive = false;
        };
    }, [sel?.id]);

    return (
        <main className="min-h-screen bg-slate-50">
            <div className="px-6 py-5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900">
                    Consulta de Estudiantes
                </h1>
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

                        {/* Tarjetas Semestres (1..5) */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <SemesterCard
                                    key={n}
                                    n={n}
                                    percent={avance[n] ?? 0}
                                    promedio={promedios[n] ?? null}
                                    onOpen={() => {
                                        if (!sel?.id) return;
                                        // Aquí puedes abrir un drawer o navegar a detalle del semestre:
                                        // router.push(`/estudiantes/${sel.id}/semestres/${n}`);
                                        alert(`Abrir Semestre ${n} de ${sel?.nombre}`);
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
        </main>
    );
}
