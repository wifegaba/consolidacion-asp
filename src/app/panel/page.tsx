// app/panel/page.tsx
export const dynamic = "force-dynamic";

import { ContactosKPIRealtime, ServidoresKPIRealtime } from "@/components/ContactosWidget";
import {
  getContactosCount,
  getServidoresCount,
  getAsistenciasConfirmadosYNo,
  getAsistenciasPorEtapa,
  getRestauracionCount,
  getAgendadosPorSemana,
  getAsistenciasPorModulo, // 👈 NUEVO: trae asistencias agrupadas por módulo
} from "@/lib/metrics";

import DetalleSecciones from "./DetalleSecciones";
import RtDashboardWatch from "./RtDashboardWatch"; // 👈 watcher realtime (cliente)

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

export default async function Page() {
  // Totales base
  const [totalContactos, totalServidores, totalRestauracion] = await Promise.all([
    getContactosCount(),
    getServidoresCount(),
    getRestauracionCount(),
  ]);

  // Asistencias (mes actual) + agrupado por módulo (para el gráfico)
  const [asistMesDetalle, asistEtapas, asistPorModulo] = await Promise.all([
    getAsistenciasConfirmadosYNo("month"),
    getAsistenciasPorEtapa("month"),
    getAsistenciasPorModulo("month"), // 👈 NUEVO
  ]);

  // Agendados por semana (vista v_agendados)
  const agendados = await getAgendadosPorSemana();
  const agendadosTotal = agendados.reduce(
    (s: number, r: { agendados_pendientes: number }) => s + r.agendados_pendientes,
    0
  );

  return (
    <>
      {/* 👇 Habilita Realtime para las tarjetas del dashboard */}
      <RtDashboardWatch />

      <div className="kpi-row">
        <div className="kpi-row-group">
          <ContactosKPIRealtime label="Contactos" initialValue={totalContactos} delta={"+"} className="contactos" />
          <ServidoresKPIRealtime label="Servidores" initialValue={totalServidores} className="servidores" />
        </div>
        <div className="kpi-row-group">
          {/* KPI Asistencias (NO se modifica la tarjeta) */}
          <article
            className="kpi-card asistencias"
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

          {/* KPI Agendados */}
          <article
            className="kpi-card agendados"
            data-key="agendados"
          >
            <div className="kpi-top flex w-full items-center justify-between">
              <span className="kpi-label">Agendados</span>
              <span className="text-sm font-medium">{agendados.length} etapas</span>
            </div>

            <div className="kpi-value">{formatNumber(agendadosTotal)}</div>
          </article>
        </div>
      </div>

      {/* Grid dinámico */}
      <DetalleSecciones
        asistEtapas={asistEtapas}
        asistPorModulo={asistPorModulo}  // 👈 NUEVO: se usa SOLO en el gráfico de asistencias
        agendados={agendados}
        defaultKey="asistencias"
      />
    </>
  );
}








