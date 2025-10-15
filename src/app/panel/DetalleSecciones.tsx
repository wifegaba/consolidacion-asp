// app/panel/DetalleSecciones.tsx
"use client";

import { useEffect, useState, CSSProperties, memo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/* ============================ Tipos ============================ */
type AsistEtapaRow = {
  etapa: string;
  confirmados: number;
  noAsistieron: number;
  total: number;
};

type AgendadoRow = {
  etapa_modulo: string;
  agendados_pendientes: number;
};

type AsistModuloRow = {
  etapa: string;
  modulo: number;
  dia: string;
  confirmados: number;
  noAsistieron: number;
  total: number;
};

type DetalleSeccionesProps = {
  asistEtapas: AsistEtapaRow[];
  agendados?: AgendadoRow[];
  asistPorModulo?: AsistModuloRow[];
  defaultKey?: string;
};

/* ============================ Constantes ============================ */
const GREEN = "#34d399";
const GREEN_LIGHT = "#4ade80";
const RED = "#dc2626";
const RED_LIGHT = "#f87171";

/* ============================ Util ============================ */
function etiquetaEtapaModulo(etapa: string, modulo: number, dia: string) {
  if (!etapa) return `Módulo ${modulo}`;
  const base = etapa.trim().split(/\s+/)[0];
  const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  return `${nombre} ${modulo} (${dia})`;
}

/* ====================== Paleta para etapas (stack) ===================== */
function colorPorEtapa(etapa: string): string {
  const m: Record<string, string> = {
    Semillas: "linear-gradient(180deg, #fecaca 0%, #f87171 100%)",
    Devocionales: "linear-gradient(180deg, #ddd6fe 0%, #a78bfa 100%)",
    Restauracion: "linear-gradient(180deg, #bfdbfe 0%, #60a5fa 100%)",
    Consolidacion: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)",
    Discipulado: "linear-gradient(180deg, #bbf7d0 0%, #34d399 100%)",
    Liderazgo: "linear-gradient(180deg, #fbcfe8 0%, #f472b6 100%)",
  };
  if (m[etapa]) return m[etapa];
  const colors = [
    ["#fecaca", "#f87171"],
    ["#ddd6fe", "#a78bfa"],
    ["#bfdbfe", "#60a5fa"],
    ["#fde68a", "#f59e0b"],
    ["#bbf7d0", "#34d399"],
    ["#fbcfe8", "#f472b6"],
    ["#c7d2fe", "#6366f1"],
    ["#bae6fd", "#38bdf8"],
  ];
  let hash = 0;
  for (let i = 0; i < etapa.length; i++) hash = (hash * 31 + etapa.charCodeAt(i)) >>> 0;
  const [c1, c2] = colors[hash % colors.length];
  return `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`;
}


/* ====================== Componentes de Gráficos de Barras Horizontales ===================== */

// --- Componente de Gráfico para la sección de AGENDADOS ---
const PremiumHorizontalBars = ({ data }: { data: AgendadoRow[] }) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const sortedData = [...data].sort((a, b) => b.agendados_pendientes - a.agendados_pendientes);
  const maxValue = Math.max(...sortedData.map(d => d.agendados_pendientes), 0);
  
  const gradients = [
    "from-violet-500 to-purple-500",
    "from-sky-500 to-indigo-500",
    "from-emerald-500 to-teal-500",
    "from-rose-500 to-pink-500",
    "from-amber-500 to-orange-500",
  ];
  
  useEffect(() => {
    const newWidths: Record<string, number> = {};
    sortedData.forEach(d => {
      newWidths[d.etapa_modulo] = maxValue > 0 ? (d.agendados_pendientes / maxValue) * 100 : 0;
    });
    const id = requestAnimationFrame(() => setWidths(newWidths));
    return () => cancelAnimationFrame(id);
  }, [data, maxValue]);

  if (!data || data.length === 0) {
    return <p className="text-center text-slate-500 py-8">No hay datos de agendados.</p>
  }
  
  return (
    <div className="w-full h-full flex flex-col gap-1 py-1 pr-2">
      {sortedData.map((d, index) => (
        <div key={d.etapa_modulo} className="grid grid-cols-[minmax(80px,1fr)_2fr] items-center gap-x-3">
          <div className="text-sm text-slate-500 text-right truncate" title={d.etapa_modulo}>
            {d.etapa_modulo}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative h-3.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradients[index % gradients.length]}`}
                style={{
                  width: `${widths[d.etapa_modulo] || 0}%`,
                  transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)'
                }}
              />
            </div>
            <div className="text-sm font-semibold text-slate-700 tabular-nums w-8 text-left">
              {d.agendados_pendientes}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- NUEVO Componente de Gráfico para la sección de ASISTENCIAS ---
type AsistBarData = { label: string; value: number; type: 'asistencia' | 'inasistencia' };

const AsistenciasHorizontalBars = ({ data }: { data: AsistBarData[] }) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const sortedData = [...data].sort((a, b) => {
    if (a.type === 'inasistencia' && b.type !== 'inasistencia') return 1;
    if (a.type !== 'inasistencia' && b.type === 'inasistencia') return -1;
    return b.value - a.value;
  });
  
  const maxValue = Math.max(...sortedData.map(d => d.value), 0);

  const asistGradients = [
    "from-emerald-400 to-teal-500",
    "from-green-400 to-emerald-500",
    "from-cyan-400 to-sky-500",
    "from-teal-400 to-cyan-500",
    "from-lime-400 to-green-500",
  ];
  const inasistGradient = "from-rose-500 to-red-600";
  
  useEffect(() => {
    const newWidths: Record<string, number> = {};
    sortedData.forEach(d => {
      newWidths[d.label] = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
    });
    const id = requestAnimationFrame(() => setWidths(newWidths));
    return () => cancelAnimationFrame(id);
  }, [data, maxValue]);

  if (!data || data.length === 0) {
    return <p className="text-center text-slate-500 py-8">No hay datos de asistencias.</p>;
  }
  
  let asistenciaIndex = 0;
  return (
    <div className="w-full h-full flex flex-col gap-4 py-1 px-1">
      {sortedData.map((d) => {
        const isAsistencia = d.type === 'asistencia';
        const gradient = isAsistencia ? asistGradients[asistenciaIndex++ % asistGradients.length] : inasistGradient;
        const labelColor = isAsistencia ? "text-slate-500" : "text-red-600 font-semibold";
        
        return (
          <div key={d.label} className="grid grid-cols-[minmax(0,1.2fr)_2fr_auto] items-center gap-x-2">
            <div className={`text-xs sm:text-sm text-right truncate ${labelColor}`} title={d.label}>
              {d.label}
            </div>

            <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradient}`}
                  style={{
                    width: `${widths[d.label] || 0}%`,
                    transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)'
                  }}
                />
            </div>

            <div className="text-sm font-semibold text-slate-700 tabular-nums w-8 text-left">
              {d.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};


/* ========================= Componente principal ========================= */
export default function DetalleSecciones({
  asistEtapas,
  agendados = [],
  asistPorModulo = [],
  defaultKey,
}: DetalleSeccionesProps) {
  const [view, setView] = useState<string | null>(defaultKey || null);

  const totalConfirmados = asistEtapas.reduce((s, r) => s + (r.confirmados || 0), 0);
  const totalNoAsistieron = asistEtapas.reduce((s, r) => s + (r.noAsistieron || 0), 0);
  const totalAsist = totalConfirmados + totalNoAsistieron;
  const dataAsist = [
    { name: "Asistieron", value: totalConfirmados, color: "url(#gradOk)" },
    { name: "No asistieron", value: totalNoAsistieron, color: "url(#gradNo)" },
  ];
  const pct = (v: number, base: number) => (base > 0 ? ((v / base) * 100).toFixed(1) : "0");
  const pctOk = pct(totalConfirmados, totalAsist);
  const pctNo = pct(totalNoAsistieron, totalAsist);
  const totalAgend = agendados.reduce((s, r) => s + (r.agendados_pendientes || 0), 0);
  
  const totalInasist = asistPorModulo.reduce((s, r) => s + (r.noAsistieron || 0), 0);
  
  const asistenciasChartData: AsistBarData[] = [
    ...asistPorModulo.map(m => ({
      label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia),
      value: m.total,
      type: 'asistencia' as const,
    })),
    {
      label: 'Inasistencias',
      value: totalInasist,
      type: 'inasistencia' as const,
    }
  ].filter(item => item.value > 0);

  const inasistChips = asistPorModulo
    .filter((m) => (m.noAsistieron || 0) > 0)
    .map((m) => ({
      etapa: m.etapa,
      label: `${etiquetaEtapaModulo(m.etapa, m.modulo, m.dia)}`,
      value: m.noAsistieron,
      color: colorPorEtapa(m.etapa),
    }))
    .sort((a, b) => b.value - a.value);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }>; }) => {
    if (active && payload && payload.length) {
      const { name, value } = payload[0];
      const base = view === "agendados" ? totalAgend : totalAsist;
      return (
        <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-[12px] ring-1 ring-black/10">
          <p className="font-semibold text-slate-800">{name}</p>
          <p className="tabular-nums text-slate-700">
            {value} <span className="text-slate-500">({pct(value, base)}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-key]");
      if (target) setView(target.getAttribute("data-key"));
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const [animatedTotal, setAnimatedTotal] = useState(0);
  useEffect(() => {
    const target = view === "agendados" ? totalAgend : totalAsist;
    let raf = 0;
    const start = performance.now();
    const dur = 800;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      setAnimatedTotal(Math.round(target * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view, totalAsist, totalAgend]);

  return (
    <>
      <style jsx>{`
        .agendados-container, .asistencias-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem; /* 24px */
          align-items: start;
        }
      `}</style>
    
      <div className="overflow-visible mt-6">
        {!view && (
          <div className="grid premium-grid">
            <section className="card span-2 animate-fadeIn premium-glass p-4">
              <h2 className="card-title">Bienvenido</h2>
              <p className="text-muted">Selecciona una tarjeta KPI para ver detalles.</p>
            </section>
          </div>
        )}

        {view === "asistencias" && (
          <div className="asistencias-container">
            <section className="card premium-glass animate-slideIn relative self-start p-4">
              <div className="card-head !pb-0"><h2 className="card-title">Gráfico de Asistencias</h2></div>
              <div className="panel-body !p-2">
                <div className="asistencias-labels flex justify-between w-full px-4 mt-1 mb-2 text-sm">
                  <div className="flex flex-col items-center text-green-600 font-semibold">
                    <span>Asistieron <span className="font-bold text-lg tabular-nums">{totalConfirmados}</span></span>
                    <span className="text-green-600 font-bold text-sm tabular-nums">{pctOk}%</span>
                  </div>
                  <div className="flex flex-col items-center text-red-600 font-semibold">
                    <span>No asistieron <span className="font-bold text-lg tabular-nums">{totalNoAsistieron}</span></span>
                    <span className="text-red-600 font-bold text-sm tabular-nums">{pctNo}%</span>
                  </div>
                </div>
                <div className="relative mx-auto max-w-[180px] aspect-square overflow-hidden flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN_LIGHT} /><stop offset="100%" stopColor={GREEN} /></linearGradient>
                        <linearGradient id="gradNo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RED_LIGHT} /><stop offset="100%" stopColor={RED} /></linearGradient>
                      </defs>
                      <Pie data={dataAsist} dataKey="value" innerRadius="55%" outerRadius="82%" startAngle={90} endAngle={-270} paddingAngle={0} cornerRadius={12} isAnimationActive animationBegin={100} animationDuration={900} animationEasing="ease-out">
                        {dataAsist.map((d, i) => (<Cell key={i} fill={d.color} stroke="#ffffff" strokeWidth={3} />))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-2">
                    <p className="text-2xl leading-tight font-extrabold text-gray-900 tabular-nums">{animatedTotal.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Total</p>
                  </div>
                </div>
              </div>
            </section>
            
            <section className="card premium-glass animate-slideIn self-start flex flex-col overflow-visible p-4">
              <div className="card-head pb-0"><h2 className="card-title">Detalle por etapa</h2></div>
              <div className="px-2 pt-3">
                <h3 className="text-sm font-semibold text-slate-700 px-1 mb-2">Asistencias por módulo (Total) + Inasistencias</h3>
                <AsistenciasHorizontalBars data={asistenciasChartData} />
              </div>
              
              {inasistChips.length > 0 && (
                <div className="px-4 pt-2 pb-3">
                  {/* ✅ CORRECCIÓN DE LAYOUT DE CHIPS */}
                  <div className="w-full rounded-xl bg-white/70 ring-1 ring-slate-200/70 backdrop-blur-sm px-3 py-2 flex items-start gap-x-3 gap-y-2">
                    <span className="text-rose-600 font-semibold whitespace-nowrap pt-1">Inasistencias</span>
                    <div className="flex flex-wrap gap-2">
                      {inasistChips.map((c) => (
                        <span key={`chip-${c.label}`} className="chip-inasistencia" title={`${c.label}: ${c.value}`}>
                          <span className="chip-inasistencia-color" style={{ background: c.color, boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset' }} />
                          <span className="truncate">{c.label}</span>
                          <span className="tabular-nums font-semibold"> = {c.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="panel-body px-0 py-0 mt-1">
                <div className="premium-table-row premium-table-header">
                  <span>ETAPA</span>
                  <span className="text-center">ASISTENCIAS</span>
                  <span className="text-center">INASISTENCIAS</span>
                  <span className="text-right">TOTAL</span>
                </div>
                {asistEtapas.map((row, i) => (
                  <div key={i} className="premium-table-row premium-table-item">
                    <span className="font-medium text-slate-700">{row.etapa}</span>
                    <span className="text-center font-semibold text-green-600 tabular-nums">{row.confirmados}</span>
                    <span className="text-center font-semibold text-red-600 tabular-nums">{row.noAsistieron}</span>
                    <span className="text-right font-semibold text-gray-800 tabular-nums">{row.total}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === "agendados" && (
          <div className="agendados-container">
            <section className="agendados-grafico card premium-glass animate-slideIn">
              <div className="card-head flex justify-between items-center">
                <h2 className="card-title">Agendados por semana</h2>
                <div className="text-right chart-meta">
                  <p className="chart-meta-label">Total agendados</p>
                  <p className="chart-meta-value tabular-nums">{totalAgend.toLocaleString()}</p>
                </div>
              </div>
              <div className="panel-body py-2 px-4">
                <PremiumHorizontalBars data={agendados} />
              </div>
            </section>

            <section className="agendados-detalle card premium-glass animate-slideIn">
              <div className="card-head pb-0">
                <h2 className="card-title">Detalle por etapa/módulo</h2>
              </div>
              <div className="panel-body px-0 py-0">
                <div className="premium-table-row premium-table-header two-cols">
                  <span>Etapa · Módulo</span>
                  <span className="text-right">Agendados</span>
                </div>
                {agendados.map((row, i) => (
                  <div key={i} className="premium-table-row premium-table-item two-cols">
                    <span className="font-medium text-slate-700">{row.etapa_modulo}</span>
                    <span className="text-right font-semibold text-gray-800 tabular-nums">
                      {row.agendados_pendientes}
                    </span>
                  </div>
                ))}
                <div className="premium-table-row premium-table-total two-cols">
                  <span>Total</span>
                  <span className="text-right tabular-nums">{totalAgend}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}