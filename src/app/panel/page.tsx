// app/panel/page.tsx
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import ContactosWidget from '@/components/ContactosWidget';

function formatNumber(n: number) {
    return new Intl.NumberFormat('es-CO').format(n);
}

async function getContactosCount(): Promise<number> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, anon);

    // Usamos conteo directo de la tabla persona
    const { count, error } = await supabase
        .from('persona')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error obteniendo total de contactos:', error);
        return 0;
    }
    return count ?? 0;
}

export default async function Page() {
    const totalContactos = await getContactosCount();

    return (
        <>
            <header className="toolbar">
                <div className="toolbar-left">
                    <h1 className="title">Dashboard</h1>
                    <span className="subtitle">Panel de Información</span>
                </div>
            </header>

            {/* KPIs */}
            <div className="kpi-row">
                {/* Tarjeta Contactos con modal */}
                <ContactosWidget
                    label="Contactos"
                    value={formatNumber(totalContactos)}
                    delta="+"
                />

                {/* Tarjetas estáticas (por ahora) */}
                <article className="kpi-card" aria-label="Servidores">
                    <div className="kpi-top">
                        <span className="kpi-label">Servidores</span>
                        <span className="kpi-delta">+2</span>
                    </div>
                    <div className="kpi-value">48</div>
                </article>

                <article className="kpi-card" aria-label="Asistencias">
                    <div className="kpi-top">
                        <span className="kpi-label">Asistencias</span>
                        <span className="kpi-delta">+18</span>
                    </div>
                    <div className="kpi-value">326</div>
                </article>

                <article className="kpi-card" aria-label="Restauración">
                    <div className="kpi-top">
                        <span className="kpi-label">Restauración</span>
                        <span className="kpi-delta">+1</span>
                    </div>
                    <div className="kpi-value">12</div>
                </article>
            </div>

            {/* Grid de secciones */}
            <div className="grid">
                <section className="card">
                    <div className="card-head">
                        <h2 className="card-title">Resumen general</h2>
                        <div className="card-actions">
                            <button className="chip">Hoy</button>
                            <button className="chip">Semana</button>
                            <button className="chip active">Mes</button>
                        </div>
                    </div>
                    <div className="card-body chart-area">
                        <div className="chart-donut" />
                        <ul className="legend">
                            <li><span className="dot a" />Consolidación</li>
                            <li><span className="dot b" />Asistencia</li>
                            <li><span className="dot c" />Restauración</li>
                        </ul>
                    </div>
                </section>

                <section className="card">
                    <div className="card-head">
                        <h2 className="card-title">Actividad reciente</h2>
                        <button className="btn tiny ghost">Ver todo</button>
                    </div>
                    <div className="card-body list">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="row">
                                <div className="row-left">
                                    <span className="bullet" />
                                    <span className="row-title">Carlos Pérez actualizado</span>
                                </div>
                                <div className="row-right">
                                    <span className="row-meta">Hoy • {9 + i}:0{i} AM</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="card span-2">
                    <div className="card-head">
                        <h2 className="card-title">Historial</h2>
                        <button className="btn tiny ghost">Exportar</button>
                    </div>
                    <div className="card-body table">
                        <div className="table-row header">
                            <span>Fecha</span>
                            <span>Nombre</span>
                            <span>Tipo</span>
                            <span>Estado</span>
                            <span>Acciones</span>
                        </div>
                        {[
                            ['2025-08-18', 'María López',  'Llamada',     'Completado'],
                            ['2025-08-18', 'Julian Ortiz', 'Seguimiento', 'Pendiente'],
                            ['2025-08-17', 'Ana Pérez',    'Visita',      'Programado'],
                            ['2025-08-16', 'Carlos Ruiz',  'Llamada',     'Completado'],
                        ].map((r, i) => (
                            <div key={i} className="table-row">
                                <span>{r[0]}</span>
                                <span>{r[1]}</span>
                                <span>{r[2]}</span>
                                <span className={`badge ${r[3].toLowerCase()}`}>{r[3]}</span>
                                <span className="row-actions">
                  <button className="btn tiny ghost">Ver</button>
                  <button className="btn tiny">Editar</button>
                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}
