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
  getAsistenciasPorModulo,
  Range
} from "@/lib/metrics";

import DetalleSecciones from "./DetalleSecciones";
import RtDashboardWatch from "./RtDashboardWatch";

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const currentRange = (params?.range ?? 'month') as Range;

  const [totalContactos, totalServidores, totalRestauracion] = await Promise.all([
    getContactosCount(),
    getServidoresCount(),
    getRestauracionCount(),
  ]);

  const [asistDetalle, asistEtapas, asistPorModulo] = await Promise.all([
    getAsistenciasConfirmadosYNo(currentRange),
    getAsistenciasPorEtapa(currentRange),
    getAsistenciasPorModulo(currentRange),
  ]);

  const agendados = await getAgendadosPorSemana();
  const agendadosTotal = agendados.reduce(
    (s: number, r: { agendados_pendientes: number }) => s + r.agendados_pendientes,
    0
  );

  return (
    <>
      <RtDashboardWatch />

      {/* ✅ CORRECCIÓN ESTRUCTURAL: Se eliminaron los divs "kpi-row-group" para simplificar el layout. */}
      <div className="kpi-row">
        <ContactosKPIRealtime label="Contactos" initialValue={totalContactos} delta={"+"} className="contactos" />
        <ServidoresKPIRealtime label="Servidores" initialValue={totalServidores} className="servidores" />
        <article className="kpi-card asistencias" data-key="asistencias">
          <div className="flex items-center justify-between">
            <span className="kpi-label">Asistencias</span>
          </div>
          <div className="flex items-center gap-6 mt-2">
            <div className="kpi-value">{formatNumber(asistDetalle.total)}</div>
            <span className="flex items-center gap-4 text-sm font-medium">
              <span className="text-green-600">{asistDetalle.confirmados} ✔</span>
              <span className="text-red-600">{asistDetalle.noAsistieron} ✘</span>
            </span>
          </div>
        </article>
        <article className="kpi-card agendados" data-key="agendados">
          <div className="kpi-top flex w-full items-center gap-4">
            <span className="kpi-label">Agendados</span>
            <span className="text-sm font-medium opacity-80">{agendados.length} etapas</span>
          </div>
          <div className="kpi-value">{formatNumber(agendadosTotal)}</div>
        </article>
      </div>

      <DetalleSecciones
        asistEtapas={asistEtapas}
        asistPorModulo={asistPorModulo}
        agendados={agendados}
        defaultKey="asistencias"
      />
    </>
  );
}