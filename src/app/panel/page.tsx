// app/panel/page.tsx
export const dynamic = 'force-dynamic';

import ContactosWidget from '@/components/ContactosWidget';
import {
  getContactosCount,
  getServidoresCount,
  getAsistenciasCount,
  getRestauracionCount,
  getAsistenciasSummary,
  getAsistenciasConfirmadosYNo,
  getAsistenciasPorEtapa,
} from '@/lib/metrics';

function formatNumber(n: number) {
  return new Intl.NumberFormat('es-CO').format(n);
}

export default async function Page(): Promise<JSX.Element> {
  const totalContactos    = await getContactosCount();
  const totalServidores   = await getServidoresCount();
const asistEtapas = await getAsistenciasPorEtapa('month');








  // Asistencias del MES (número y % del mes)
  const totalAsistencias  = await getAsistenciasCount('month');
  const asistMes          = await getAsistenciasSummary('month');
const asistMesDetalle = await getAsistenciasConfirmadosYNo('month');

  const totalRestauracion = await getRestauracionCount();

  return (
    <>
      <div className="kpi-row">
        <ContactosWidget
          label="Contactos"
          value={formatNumber(totalContactos)}
          delta="+"
        />

        <article className="kpi-card" aria-label="Servidores">
          <div className="kpi-top">
            <span className="kpi-label">Servidores</span>
            <span className="kpi-delta">{'\u00A0'}</span>
          </div>
          <div className="kpi-value">{formatNumber(totalServidores)}</div>
        </article>

<article className="kpi-card kpi-expandable" aria-label="Asistencias">
  <div className="kpi-top flex justify-between items-center">
    <span className="kpi-label pr-4">Asistencias</span>
    <span className="flex items-center gap-4 text-sm font-medium">
      <span className="text-green-600">{asistMesDetalle.confirmados} ✔</span>
      <span className="text-red-600">{asistMesDetalle.noAsistieron} ✘</span>
    </span>
  </div>
  <div className="kpi-value">{formatNumber(asistMesDetalle.total)}</div>




  {/* Panel emergente */}
  <div className="kpi-panel">
    <h3 className="panel-title">Detalle por etapa</h3>
    <div className="panel-table">
      <div className="table-row header">
        <span>Etapa</span>
        <span>✔</span>
        <span>✘</span>
        <span>Total</span>
      </div>
      {asistEtapas.map((row, i) => (
        <div key={i} className="table-row">
          <span>{row.etapa}</span>
          <span className="text-green-600">{row.confirmados}</span>
          <span className="text-red-600">{row.noAsistieron}</span>
          <span>{row.total}</span>
        </div>
      ))}
    </div>
  </div>
</article>









        <article className="kpi-card" aria-label="Restauración">
          <div className="kpi-top">
            <span className="kpi-label">Restauración</span>
            <span className="kpi-delta">{'\u00A0'}</span>
          </div>
          <div className="kpi-value">{formatNumber(totalRestauracion)}</div>
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
