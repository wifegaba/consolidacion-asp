// File: src/app/estudiantes/consultar/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Estudiante = {
    id: string;
    nombre: string;
    genero?: string;
    edad?: number;
    fechaNacimiento?: string;
    correo?: string;
    celular?: string;
    cedula?: string;
    pais?: string;
    ciudad?: string;
    direccion?: string;
    congregacion?: string;
    avatar?: string;
    // % de avance por semestre (1..5)
    semestres: Record<number, number>;
};

// —— Demo data (reemplaza luego con fetch a tu backend) ——
const DATA: Estudiante[] = [
    {
        id: '1',
        nombre: 'William Fancyson',
        genero: 'Masculino',
        edad: 25,
        fechaNacimiento: '1999-01-14',
        correo: 'test.alumn@correo.com',
        celular: '+3208868434',
        cedula: '1090xxxxxx',
        pais: 'Colombia',
        ciudad: 'Bogotá',
        direccion: 'Calle 123 #45',
        congregacion: 'Central',
        avatar:
            'https://images.unsplash.com/photo-1607746882042-944635dfe10e?q=80&w=512&auto=format&fit=crop',
        semestres: { 1: 65, 2: 75, 3: 85, 4: 95, 5: 42 },
    },
    {
        id: '2',
        nombre: 'María Rodríguez',
        genero: 'Femenino',
        edad: 22,
        fechaNacimiento: '2002-05-28',
        correo: 'maria.rod@correo.com',
        celular: '+57 3001112233',
        cedula: '1007xxxxxx',
        pais: 'Colombia',
        ciudad: 'Medellín',
        direccion: 'Carrera 9 #12',
        congregacion: 'Norte',
        avatar:
            'https://images.unsplash.com/photo-1554151228-14d9def656e4?q=80&w=512&auto=format&fit=crop',
        semestres: { 1: 48, 2: 62, 3: 79, 4: 93, 5: 88 },
    },
];

// —— Helpers ——
function barraColor(p: number) {
    if (p < 50) return 'bg-rose-500';
    // “después de 60% amarillo hasta 80” -> tratamos 60–89 como amarillo
    if (p >= 60 && p < 90) return 'bg-amber-400';
    if (p >= 90) return 'bg-emerald-500';
    // valores 50–59: neutro
    return 'bg-slate-400';
}

function cls(...s: (string | false | undefined)[]) {
    return s.filter(Boolean).join(' ');
}

// —— Componentes UI ——
function SearchBox({
                       value,
                       onChange,
                       onSelect,
                       results,
                   }: {
    value: string;
    onChange: (v: string) => void;
    onSelect: (e: Estudiante) => void;
    results: Estudiante[];
}) {
    return (
        <div className="relative w-full max-w-2xl mx-auto">
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Buscar estudiante por nombre, cédula o teléfono"
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 pr-12 text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
        🔎
      </span>

            {value && results.length > 0 && (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
                    {results.map((e) => (
                        <button
                            key={e.id}
                            onClick={() => onSelect(e)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50"
                        >
                            <div className="font-medium">{e.nombre}</div>
                            <div className="text-xs text-slate-500">
                                {e.cedula} · {e.celular}
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
                          onOpen,
                      }: {
    n: number;
    percent: number;
    onOpen: () => void;
}) {
    return (
        <button
            onClick={onOpen}
            className="group w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg transition"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="text-blue-900 font-semibold text-lg">
                    Semestre {n}
                </div>
                <div className="text-slate-600 font-semibold">{percent}%</div>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                    className={cls('h-3 rounded-full transition-all', barraColor(percent))}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div className="mt-2 text-xs text-slate-500">
                {percent < 50 && 'Faltan >50% de notas (Rojo)'}
                {percent >= 60 && percent < 90 && 'Entre 60% y 89% (Amarillo)'}
                {percent >= 90 && '90–100% (Verde)'}
            </div>
        </button>
    );
}

function Profile({ e }: { e?: Estudiante }) {
    if (!e)
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-slate-500">Selecciona un estudiante…</div>
            </div>
        );

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center gap-3">
                {/* Avatar */}
                <img
                    src={e.avatar}
                    alt={e.nombre}
                    className="h-28 w-28 rounded-full object-cover"
                />
                <h3 className="text-xl font-bold text-blue-900 text-center">
                    {e.nombre}
                </h3>
            </div>

            <div className="mt-4 grid gap-2 text-sm">
                <div>
                    <span className="font-semibold text-slate-700">Género: </span>
                    <span className="text-slate-600">{e.genero ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Edad: </span>
                    <span className="text-slate-600">{e.edad ?? '—'}</span>
                </div>
                <div>
          <span className="font-semibold text-slate-700">
            Fecha Nacimiento:{' '}
          </span>
                    <span className="text-slate-600">{e.fechaNacimiento ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Correo: </span>
                    <span className="text-slate-600">{e.correo ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Celular: </span>
                    <span className="text-slate-600">{e.celular ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Cédula: </span>
                    <span className="text-slate-600">{e.cedula ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">País / Ciudad: </span>
                    <span className="text-slate-600">
            {e.pais ?? '—'} {e.ciudad ? `· ${e.ciudad}` : ''}
          </span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Dirección: </span>
                    <span className="text-slate-600">{e.direccion ?? '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Congregación: </span>
                    <span className="text-slate-600">{e.congregacion ?? '—'}</span>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    const [q, setQ] = useState('');
    const [sel, setSel] = useState<Estudiante | undefined>(DATA[0]);
    const [openSem, setOpenSem] = useState<number | null>(null);
    const router = useRouter();

    const results = useMemo(() => {
        const x = q.trim().toLowerCase();
        if (!x) return [];
        return DATA.filter(
            (e) =>
                e.nombre.toLowerCase().includes(x) ||
                (e.cedula ?? '').toLowerCase().includes(x) ||
                (e.celular ?? '').toLowerCase().includes(x)
        );
    }, [q]);

    return (
        <main className="min-h-screen bg-slate-50">
            {/* Topbar simple */}
            <div className="px-6 py-5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900">
                    Consulta de Estudiantes
                </h1>
            </div>

            <div className="mx-auto max-w-7xl px-6 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Columna izquierda: búsqueda + semestres */}
                    <section className="lg:col-span-2 space-y-6">
                        {/* —— Búsqueda al centro —— */}
                        <div className="flex justify-center">
                            <SearchBox
                                value={q}
                                onChange={setQ}
                                results={results}
                                onSelect={(e) => {
                                    setSel(e);
                                    setQ('');
                                }}
                            />
                        </div>

                        {/* —— Tarjetas de Semestres —— */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <SemesterCard
                                    key={n}
                                    n={n}
                                    percent={sel?.semestres?.[n] ?? 0}
                                    onOpen={() => setOpenSem(n)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Columna derecha: perfil */}
                    <aside>
                        <Profile e={sel} />
                    </aside>
                </div>
            </div>

            {/* —— Drawer de semestre (ver/ingresar notas) —— */}
            {openSem !== null && (
                <div
                    className="fixed inset-0 z-20 bg-black/30"
                    onClick={() => setOpenSem(null)}
                >
                    <div
                        className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl p-6 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-blue-900">
                                Semestre {openSem} — Notas
                            </h2>
                            <button
                                onClick={() => setOpenSem(null)}
                                className="rounded-full border px-3 py-1 text-slate-600 hover:bg-slate-50"
                            >
                                Cerrar
                            </button>
                        </div>

                        {/* —— Aquí montas tu formulario real —— */}
                        <div className="space-y-4">
                            <div className="text-sm text-slate-600">
                                Estudiante: <b>{sel?.nombre}</b>
                            </div>

                            <div className="grid gap-4">
                                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-700">
                    Materia
                  </span>
                                    <input
                                        className="rounded-xl border border-slate-200 px-3 py-2"
                                        placeholder="Ej. Matemáticas"
                                    />
                                </label>

                                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-700">
                    Nota (0–100)
                  </span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        className="rounded-xl border border-slate-200 px-3 py-2"
                                        placeholder="90"
                                    />
                                </label>

                                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-700">
                    Observación
                  </span>
                                    <textarea
                                        rows={3}
                                        className="rounded-xl border border-slate-200 px-3 py-2"
                                        placeholder="Opcional"
                                    />
                                </label>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => alert('Guardar (conecta backend)')}
                                        className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                                    >
                                        Guardar
                                    </button>
                                    <button
                                        onClick={() =>
                                            alert('Ver listado de notas (conecta backend)')
                                        }
                                        className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Ver notas del semestre
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
