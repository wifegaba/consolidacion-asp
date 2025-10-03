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
import { scaleBand, scaleLinear, max as d3max } from "d3";

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
function etiquetaEtapaModulo(etapa: string, modulo: number) {
  if (!etapa) return `Módulo ${modulo}`;
  const base = etapa.trim().split(/\s+/)[0];
  const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  return `${nombre} ${modulo}`;
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

/* ====================== Barras Horizontales (base) ===================== */
type HBarDatum = { key: string; value: number; color?: string };

/** Barra individual con animación de ancho */
const BarRow = memo(function BarRow({
  topPct,
  heightPct,
  widthPct,
  gradientClass,
  value,
}: {
  topPct: number;
  heightPct: number;
  widthPct: number; // 0..100
  gradientClass: string;
  value: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(widthPct));
    return () => cancelAnimationFrame(id);
  }, [widthPct]);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: `${topPct}%`,
        width: `${w}%`,
        height: `${heightPct}%`,
        borderRadius: "0 6px 6px 0",
        boxShadow: "0 2px 18px 0 rgba(56,189,248,0.18)",
        transition: "width 800ms cubic-bezier(.2,.8,.2,1)",
      }}
      className={`bg-gradient-to-b ${gradientClass}`}
    >
      <span
        className="absolute right-2 top-1 text-[11px] font-bold text-white pointer-events-none tabular-nums"
        style={{
          textShadow: "0 2px 8px rgba(0,0,0,0.18)",
          background: "rgba(56,189,248,0.12)",
          borderRadius: 4,
          padding: "2px 6px",
        }}
      >
        {value}
      </span>
    </div>
  );
});

/* ======= Segmento para barra apilada de inasistencias (por etapa) ======= */
const EtapaSegment = memo(function EtapaSegment({
  leftPct,
  widthPct,
  color,
  radiusLeft,
  radiusRight,
}: {
  leftPct: number;
  widthPct: number;
  color: string;
  radiusLeft?: number;
  radiusRight?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(widthPct));
    return () => cancelAnimationFrame(id);
  }, [widthPct]);

  return (
    <div
      className="absolute top-0 h-full"
      style={{
        left: `${leftPct}%`,
        width: `${w}%`,
        background: color,
        borderTopLeftRadius: radiusLeft ?? 0,
        borderBottomLeftRadius: radiusLeft ?? 0,
        borderTopRightRadius: radiusRight ?? 0,
        borderBottomRightRadius: radiusRight ?? 0,
        transition: "width 800ms cubic-bezier(.2,.8,.2,1)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08) inset",
      }}
    />
  );
});

/* ============ Barras por módulo + barra apilada de inasistencias ============ */
function BarsWithInasistStack({
  dataBars,           // barras por módulo
  asistPorModulo,     // para armar stack por etapa
  className = "",
}: {
  dataBars: HBarDatum[];
  asistPorModulo: AsistModuloRow[];
  className?: string;
}) {
  // --- preparar datos base ---
  const sorted = [...dataBars].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  // total inasistencias por etapa y total global
  const byEtapa = new Map<string, number>();
  for (const row of asistPorModulo) {
    const etapa = (row.etapa || "Desconocido").trim();
    const n = row.noAsistieron || 0;
    if (n > 0) byEtapa.set(etapa, (byEtapa.get(etapa) || 0) + n);
  }
  const etapas = [...byEtapa.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "es", { sensitivity: "base" })
  );
  const totalInasist = etapas.reduce((s, [, v]) => s + v, 0);

  // --- escalas y geometría (mismo xScale para TODO) ---
  const maxValue = d3max([
    ...sorted.map((d) => d.value),
    totalInasist,
    0,
  ]) ?? 0;

  const xScale = scaleLinear().domain([0, maxValue]).range([0, 100]);

  // yScale: barras por módulo + 1 fila extra ("Inasistencias")
  const keys = [...sorted.map((d) => d.key), "Inasistencias"];
  const yScale = scaleBand<string>().domain(keys).range([0, 100]).padding(0.175);

  const longest = keys.reduce((m, k) => Math.max(m, k.length), 1);

  // altura dinámica en px (elástica)
  const rows = keys.length;
  const heightPx = Math.max(160, 34 * rows); // 34px por fila aprox.

  // colores de barras por módulo
  const gradients = [
    "from-pink-300 to-pink-400",
    "from-purple-300 to-purple-400",
    "from-indigo-300 to-indigo-400",
    "from-sky-300 to-sky-400",
    "from-orange-200 to-orange-300",
    "from-lime-300 to-lime-400",
  ];

  return (
    <div
      className={`relative w-full ${className}`}
      style={
        {
          height: heightPx,
          "--marginTop": "0px",
          "--marginRight": "0px",
          "--marginBottom": "16px",
          "--marginLeft": `${longest * 7}px`,
        } as CSSProperties
      }
    >
      {/* Área de dibujo */}
      <div
        className="absolute inset-0 z-10
          h-[calc(100%-var(--marginTop)-var(--marginBottom))]
          translate-y-[var(--marginTop)]
          w-[calc(100%-var(--marginLeft)-var(--marginRight))]
          translate-x-[var(--marginLeft)]
          overflow-visible"
      >
        {/* 1) Barras por módulo */}
        {sorted.map((d, index) => {
          const widthPct = xScale(d.value);
          const heightPct = yScale.bandwidth();
          const topPct = yScale(d.key)!;
          const gradientClass = d.color ?? gradients[index % gradients.length];
          return (
            <BarRow
              key={`mod-${d.key}`}
              topPct={topPct}
              heightPct={heightPct}
              widthPct={widthPct}
              gradientClass={gradientClass}
              value={d.value}
            />
          );
        })}

        {/* 2) Barra única apilada (Inasistencias) */}
        {totalInasist > 0 && (
          <div
            className="absolute left-0"
            style={{
              top: `${yScale("Inasistencias")!}%`,
              width: `${xScale(totalInasist)}%`,
              height: `${yScale.bandwidth()}%`,
              borderRadius: "0 6px 6px 0",
              background: "transparent",
            }}
          >
            {(() => {
              // segmentación por etapa
              let acc = 0;
              const segments = etapas.map(([etapa, value], i, arr) => {
                const start = acc;
                acc += value;
                const leftPct = xScale(start);
                const widthPct = xScale(value);
                const isFirst = i === 0;
                const isLast = i === arr.length - 1;
                return (
                  <EtapaSegment
                    key={`seg-${etapa}`}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    color={colorPorEtapa(etapa)}
                    radiusLeft={isFirst ? 8 : 0}
                    radiusRight={isLast ? 8 : 0}
                  />
                );
              });

              // etiqueta del total (chip)
              const totalLeft = Math.max(0, xScale(totalInasist) - 4);
              return (
                <>
                  {segments}
                  <span
                    className="absolute -top-4 text-[11px] font-bold text-slate-700 tabular-nums"
                    style={{ left: `${totalLeft}%` }}
                  >
                    {totalInasist}
                  </span>
                </>
              );
            })()}
          </div>
        )}

        {/* Grid vertical punteado (común) */}
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {xScale
            .ticks(8)
            .map(xScale.tickFormat(8, "d"))
            .map((active, i) => (
              <g
                key={`grid-${i}`}
                transform={`translate(${xScale(+active)},0)`}
                className="text-gray-300/80 dark:text-gray-800/80"
              >
                <line
                  y1={0}
                  y2={100}
                  stroke="currentColor"
                  strokeDasharray="6,5"
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
        </svg>

        {/* Eje X (valores) */}
        {xScale.ticks(4).map((value, i) => (
          <div
            key={`xtick-${i}`}
            style={{ left: `${xScale(value)}%`, top: "100%" }}
            className="absolute text-xs -translate-x-1/2 tabular-nums text-gray-400"
          >
            {value}
          </div>
        ))}
      </div>

      {/* Eje Y (etiquetas) */}
      <div
        className="h-[calc(100%-var(--marginTop)-var(--marginBottom))]
           w-[var(--marginLeft)]
           translate-y-[var(--marginTop)]
           overflow-visible relative"
      >
        {keys.map((k) => (
          <span
            key={`ylabel-${k}`}
            style={{
              left: "-8px",
              top: `${yScale(k)! + yScale.bandwidth() / 2}%`,
            }}
            className={`absolute text-xs -translate-y-1/2 w-full text-right ${
              k === "Inasistencias" ? "text-rose-500 font-semibold" : "text-gray-400"
            }`}
            title={k}
          >
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ========================= Componente principal ========================= */
export default function DetalleSecciones({
  asistEtapas,
  agendados = [],
  asistPorModulo = [],
  defaultKey,
}: DetalleSeccionesProps) {
  const [view, setView] = useState<string | null>(defaultKey || null);

  // Totales asistencias para la dona
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

  // Totales agendados
  const totalAgend = agendados.reduce((s, r) => s + (r.agendados_pendientes || 0), 0);

  // Data para barras por módulo (Total)
  const barsDataTotal: HBarDatum[] = asistPorModulo
    .map((m) => ({
      key: etiquetaEtapaModulo(m.etapa, m.modulo),
      value: m.total,
      color: [
        "from-pink-300 to-pink-400",
        "from-purple-300 to-purple-400",
        "from-indigo-300 to-indigo-400",
        "from-sky-300 to-sky-400",
        "from-orange-200 to-orange-300",
        "from-lime-300 to-lime-400",
      ][(m.modulo - 1) % 6],
    }))
    .sort((a, b) => b.value - a.value);

  // Chips de inasistencias por etapa·módulo (fila horizontal en la "tabla")
  const inasistChips = asistPorModulo
    .filter((m) => (m.noAsistieron || 0) > 0)
    .map((m) => ({
      etapa: m.etapa,
      label: `${etiquetaEtapaModulo(m.etapa, m.modulo)}`,
      value: m.noAsistieron,
      color: colorPorEtapa(m.etapa),
    }))
    .sort((a, b) => b.value - a.value);

  // Tooltip para la dona
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string }>;
  }) => {
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

  // Click en tarjetas KPI
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-key]");
      if (target) setView(target.getAttribute("data-key"));
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Contador animado del total en el centro de la dona
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
    <div className="grid premium-grid items-start overflow-visible">
      {!view && (
        <section className="card span-2 animate-fadeIn premium-glass">
          <h2 className="card-title">Bienvenido</h2>
          <p className="text-muted">Selecciona una tarjeta KPI para ver detalles.</p>
        </section>
      )}

      {view === "asistencias" && (
        <>
          {/* Panel izquierdo: Dona */}
          <section className="card premium-glass animate-slideIn relative panel-compact self-start max-w-[min(560px,94vw)] mx-auto lg:max-w-none">
            <div className="card-head">
              <h2 className="card-title">Gráfico de Asistencias</h2>
            </div>

            <div className="panel-body">
              <div className="asistencias-labels flex justify-between w-full px-4 mt-1 mb-3 text-sm">
                <div className="flex flex-col items-center text-green-600 font-semibold">
                  <span>
                    Asistieron{" "}
                    <span className="font-bold text-lg tabular-nums">{totalConfirmados}</span>
                  </span>
                  <span className="text-green-600 font-bold text-sm tabular-nums">{pctOk}%</span>
                </div>
                <div className="flex flex-col items-center text-red-600 font-semibold">
                  <span>
                    No asistieron{" "}
                    <span className="font-bold text-lg tabular-nums">{totalNoAsistieron}</span>
                  </span>
                  <span className="text-red-600 font-bold text-sm tabular-nums">{pctNo}%</span>
                </div>
              </div>

              <div className="panel-chart relative mx-auto max-w-[min(360px,88vw)] aspect-square overflow-hidden flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GREEN_LIGHT} />
                        <stop offset="100%" stopColor={GREEN} />
                      </linearGradient>
                      <linearGradient id="gradNo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={RED_LIGHT} />
                        <stop offset="100%" stopColor={RED} />
                      </linearGradient>
                    </defs>

                    <Pie
                      data={dataAsist}
                      dataKey="value"
                      innerRadius="55%"
                      outerRadius="82%"
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={0}
                      cornerRadius={12}
                      isAnimationActive
                      animationBegin={100}
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {dataAsist.map((d, i) => (
                        <Cell key={i} fill={d.color} stroke="#ffffff" strokeWidth={3} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-2">
                  <p className="text-3xl leading-tight font-extrabold text-gray-900 tabular-nums">
                    {animatedTotal.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">Total</p>
                </div>
              </div>
            </div>
          </section>

          {/* Panel derecho: ELÁSTICO; barras + chips + tabla */}
          <section className="card premium-glass animate-slideIn panel-compact panel-elastico self-start max-w-[min(560px,94vw)] mx-auto lg:max-w-none flex flex-col overflow-visible pb-4">
            <div className="card-head pb-0">
              <h2 className="card-title">Detalle por etapa</h2>
            </div>

            <div className="px-2 pt-3">
              <h3 className="text-sm font-semibold text-slate-700 px-1 mb-2">
                Asistencias por módulo (Total) + Inasistencias
              </h3>

              <BarsWithInasistStack
                dataBars={barsDataTotal}
                asistPorModulo={asistPorModulo}
              />
            </div>




            

            {/* Fila única de chips de inasistencias */}
            {inasistChips.length > 0 && (
              <div className="px-4 pt-2 pb-3">
                <div className="w-full rounded-xl bg-white/70 ring-1 ring-slate-200/70 backdrop-blur-sm px-3 py-2 flex items-center gap-3">
                  <span className="text-rose-600 font-semibold whitespace-nowrap">
                    Inasistencias
                  </span>
                  <div className="flex flex-wrap items-center gap-2 overflow-visible">
                    {inasistChips.map((c) => (
                      <span
                        key={`chip-${c.label}`}
                        className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 rounded-full px-2 py-1 ring-1 ring-slate-200 bg-white/80"
                        title={`${c.label}: ${c.value}`}
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ background: c.color, boxShadow: "0 0 0 1px rgba(0,0,0,0.06) inset" }}
                        />
                        <span className="truncate">{c.label}</span>
                        <span className="tabular-nums font-semibold">{c.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tabla por etapa */}
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
        </>
      )}

      {view === "agendados" && (
        <>
          <section className="card premium-glass animate-slideIn relative panel-compact self-start">
            <div className="card-head">
              <h2 className="card-title">Agendados por semana</h2>
            </div>

            <div className="panel-body">
              <div className="panel-chart relative">
                <ResponsiveContainer width="100%" height="100%">
                  <></>
                </ResponsiveContainer>

                <div className="absolute top-3 right-4 text-right chart-meta">
                  <p className="chart-meta-label">Total agendados</p>
                  <p className="chart-meta-value tabular-nums">{totalAgend.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="card premium-glass animate-slideIn panel-compact self-start">
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
        </>
      )}
    </div>
  );
}
