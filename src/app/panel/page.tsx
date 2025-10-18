// app/panel/page.tsx
export const dynamic = "force-dynamic";

import { RangeFilterButtons } from '@/components/ui/RangeFilterButtons';
import { ContactosKPI } from "@/components/kpi/ContactosKPI";
import { ServidoresKPI } from "@/components/kpi/ServidoresKPI";
import {
  getContactosCount,
  getServidoresCount,
  getAsistenciasConfirmadosYNo,
  getAsistenciasPorEtapa,
  getRestauracionCount,
  getAgendadosPorSemana,
  getAsistenciasPorModulo,
  getContactosPorEtapaDia,
  getServidoresPorRolEtapaDia,
  Range
} from "@/lib/metrics";
import DetalleSecciones from "./DetalleSecciones";
import RtDashboardWatch from "./RtDashboardWatch";

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const currentRange = sp?.range === 'week' ? 'week' : 'month' as Range;

  // ✅ OPTIMIZACIÓN: Todas las llamadas a la base de datos se agrupan en un único Promise.all.
  // Esto ejecuta todas las consultas en paralelo, reduciendo drásticamente el tiempo de carga.
  const [
    totalContactos,
    totalServidores,
    totalRestauracion,
    contactosPorEtapaDia,
    servidoresPorRolEtapaDia,
    asistDetalle,
    asistEtapas,
    asistPorModulo,
    agendados,
  ] = await Promise.all([
    getContactosCount(),
    getServidoresCount(),
    getRestauracionCount(),
    getContactosPorEtapaDia(),
    getServidoresPorRolEtapaDia(),
    getAsistenciasConfirmadosYNo(currentRange),
    getAsistenciasPorEtapa(currentRange),
    getAsistenciasPorModulo(currentRange),
    getAgendadosPorSemana(),
  ]);
  
  // Esta operación se mantiene después, ya que depende de los datos que acabamos de obtener.
  const agendadosTotal = agendados.reduce(
    (s: number, r: { agendados_pendientes: number }) => s + r.agendados_pendientes,
    0
  );

  return (
    <>
      <RtDashboardWatch />

      <div className="flex justify-between items-center mb-6 px-1">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard General</h1>
        <RangeFilterButtons />
      </div>

      <div className="kpi-row">
        <ContactosKPI label="Contactos" initialValue={totalContactos} className="contactos" data-key="contactos" />
        <ServidoresKPI label="Servidores" initialValue={totalServidores} className="servidores" data-key="servidores" />
        
        <article className="kpi-card asistencias" data-key="asistencias">
          <div className="flex items-center justify-between">
            <span className="kpi-label">Asistencias ({currentRange === 'week' ? 'Semana' : 'Mes'})</span>
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
        contactosPorEtapaDia={contactosPorEtapaDia}
        servidoresPorRolEtapaDia={servidoresPorRolEtapaDia}
        defaultKey="asistencias"
        range={currentRange} // <-- Pasamos el rango actual por si el componente hijo lo necesita
      />
    </>
  );
}