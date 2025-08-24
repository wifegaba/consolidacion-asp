// app/panel/page.tsx
type Kpi = { id: string; label: string; value: string; delta?: string };

const KPIS: Kpi[] = [
    { id: 'users',   label: 'Contactos',   value: '1,284', delta: '+12' },
    { id: 'servers', label: 'Servidores',  value: '48',    delta: '+2'  },
    { id: 'att',     label: 'Asistencias', value: '326',   delta: '+18' },
    { id: 'rest',    label: 'Restauración',value: '12',    delta: '+1'  },
];

export default function Page() {
    return (
        <>
            <header className="toolbar">
                <div className="toolbar-left">
                    <h1 className="title">Dashboard </h1>
                    <span className="subtitle">Panel de Informacion </span>
                </div>

            </header>

            <div className="kpi-row">
                {KPIS.map((k) => (
                    <article key={k.id} className="kpi-card" aria-label={k.label}>
                        <div className="kpi-top">
                            <span className="kpi-label">{k.label}</span>
                            {k.delta && <span className="kpi-delta">{k.delta}</span>}
                        </div>
                        <div className="kpi-value">{k.value}</div>
                    </article>
                ))}
            </div>

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
