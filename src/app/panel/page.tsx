// app/panel/page.tsx
export const dynamic = "force-dynamic";

import ContactosWidget from "@/components/ContactosWidget";
import {
  getContactosCount,
  getServidoresCount,
  getAsistenciasConfirmadosYNo,
  getAsistenciasPorEtapa,
  getRestauracionCount,
  getAgendadosPorSemana, // 👈 NUEVO
} from "@/lib/metrics";

import DetalleSecciones from "./DetalleSecciones";


function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

export default async function Page() {
  // Totales base
  const totalContactos    = await getContactosCount();
  const totalServidores   = await getServidoresCount();
  const totalRestauracion = await getRestauracionCount();

  // Asistencias (mes actual)
  const asistMesDetalle = await getAsistenciasConfirmadosYNo("month");
  const asistEtapas     = await getAsistenciasPorEtapa("month");

  // Agendados por semana (vista v_agendados)
  const agendados = await getAgendadosPorSemana();
  const agendadosTotal = agendados.reduce((s: number, r: { agendados_pendientes: number }) => s + r.agendados_pendientes, 0);

  return (
    <>
      <header className="toolbar">
        <div className="toolbar-left">
          <h1 className="title">Dashboard</h1>
          <span className="subtitle">Panel de Información</span>
        </div>
      </header>

      {/* KPI Row */}
      <div className="kpi-row">
        <ContactosWidget label="Contactos" value={formatNumber(totalContactos)} delta="+" />

        <article className="kpi-card" aria-label="Servidores">
          <div className="kpi-top"><span className="kpi-label">Servidores</span></div>
          <div className="kpi-value">{formatNumber(totalServidores)}</div>
        </article>

        {/* KPI Asistencias */}
        <article
          className="kpi-card clickable"
          data-key="asistencias"
        >
<div className="flex items-center justify-between">
  <span className="kpi-label">Asistencias</span>
</div>

<div className="flex items-center gap-6 mt-2">
 <div className="kpi-value">{formatNumber(asistMesDetalle.total)}</div>
  <span className="flex items-center gap-4 text-sm font-medium">
    <span className="text-green-600">{asistMesDetalle.confirmados} ✔</span>
    <span className="text-red-600">{asistMesDetalle.noAsistieron} ✘</span>
  </span>
</div>
        </article>




        {/* KPI Agendados (NUEVA) */}
        <article
          className="kpi-card clickable"
          data-key="agendados"
        >
            
        <div className="kpi-top flex w-full items-center justify-between">
  <span className="kpi-label">Agendados</span>
  <span className="text-sm font-medium">{agendados.length} etapas</span>
</div>


          <div className="kpi-value">{formatNumber(agendadosTotal)}</div>
        </article>

        
      </div>

      {/* Grid dinámico (UNA sola instancia) */}
      <DetalleSecciones asistEtapas={asistEtapas} agendados={agendados}  defaultKey="asistencias"/>
    </>
  );
}



