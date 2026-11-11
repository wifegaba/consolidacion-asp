// app/panel/page.tsx
export const dynamic = "force-dynamic";

import { RangeFilterButtons } from '@/components/ui/RangeFilterButtons';
import { ContactosKPI } from "@/components/kpi/ContactosKPI";
import { ServidoresKPI } from "@/components/kpi/ServidoresKPI";
import { DashboardMetric } from '@/components/kpi/DashboardMetric';
import {
  getContactosCount,
  getServidoresCount,
  getAsistenciasConfirmadosYNo,
  getAsistenciasPorEtapa,
  getAgendadosPorSemana,
  getAsistenciasPorModulo,
  getContactosPorEtapaDia,
  getServidoresPorRolEtapaDia,
  Range
} from "@/lib/metrics";
import DetalleSecciones from "./DetalleSecciones";
import RtDashboardWatch from "./RtDashboardWatch";
import { formatDashboardMonth, isDashboardMonth } from '@/lib/dashboard-month';

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}



export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; valor?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const currentRange: Range = resolvedSearchParams?.range === 'week' ? 'week'
    : resolvedSearchParams?.range === 'today' ? 'today'
      : 'month';
  const currentMonth = new Date().toISOString().slice(0, 7);
  const requestedValue = resolvedSearchParams?.valor;
  const currentValue = currentRange === 'month' && !isDashboardMonth(requestedValue) ? undefined : requestedValue;
  const monthLabel = currentRange === 'month' ? formatDashboardMonth(currentValue ?? currentMonth) : undefined;


  const [
    totalContactos,
    totalServidores,
    contactosPorEtapaDia,
    servidoresPorRolEtapaDia,
    asistDetalle,
    asistEtapas,
    asistPorModulo,
    agendados,
  ] = await Promise.all([
    getContactosCount(),
    getServidoresCount(),
    getContactosPorEtapaDia(),
    getServidoresPorRolEtapaDia(),
    getAsistenciasConfirmadosYNo(currentRange, currentValue),
    getAsistenciasPorEtapa(currentRange, currentValue),
    getAsistenciasPorModulo(currentRange, currentValue),
    getAgendadosPorSemana(),
  ]);

  const agendadosTotal = agendados.reduce(
    (s: number, r: { agendados_pendientes: number }) => s + r.agendados_pendientes,
    0
  );

  return (
    <div className="consolidation-dashboard">
      <RtDashboardWatch />

      <header className="consolidation-heading">
        <div>
          <p className="consolidation-eyebrow">Consolidación</p>
          <h1>Panel general</h1>
          <p className="consolidation-subtitle">Personas, asistencia y seguimiento.</p>
        </div>
        <RangeFilterButtons
          currentRange={currentRange}
          currentValue={currentValue}
          currentMonth={currentMonth}
        />
      </header>

      <div className="kpi-row">
        <ContactosKPI label="Personas registradas" initialValue={totalContactos} />
        <ServidoresKPI label="Equipo de servicio" initialValue={totalServidores} />
        <DashboardMetric tone="asistencias" label="Asistencias" value={formatNumber(asistDetalle.total)} detail={<>
          <span className="metric-present">{formatNumber(asistDetalle.confirmados)} asistieron</span>
          <span className="metric-absent">{formatNumber(asistDetalle.noAsistieron)} faltaron</span>
        </>} />
        <DashboardMetric tone="agendados" label="Citas pendientes" value={formatNumber(agendadosTotal)} detail="Agenda de la semana" />
      </div>

      <DetalleSecciones
        asistEtapas={asistEtapas}
        asistPorModulo={asistPorModulo}
        agendados={agendados}
        contactosPorEtapaDia={contactosPorEtapaDia}
        servidoresPorRolEtapaDia={servidoresPorRolEtapaDia}
        defaultKey="asistencias"
        range={currentRange}
        valor={currentValue}
        monthLabel={monthLabel}
      />
    </div>
  );
}
