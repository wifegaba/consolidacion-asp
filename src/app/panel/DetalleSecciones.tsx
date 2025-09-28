// app/panel/DetalleSecciones.tsx
"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList, // 👈 para chips de valor en las barras
} from "recharts";

type DetalleSeccionesProps = {
  asistEtapas: any[];
  agendados?: { etapa_modulo: string; agendados_pendientes: number }[];
  asistPorModulo?: Array<{ etapa: string; modulo: number; confirmados: number; noAsistieron: number; total: number }>;
  defaultKey?: string;
};

const GREEN = "#34d399";       // verde premium
const GREEN_LIGHT = "#4ade80";
const RED = "#dc2626";         // rojo profundo
const RED_LIGHT = "#f87171";
const BLUE = "#3b82f6";        // azul premium
const BLUE_LIGHT = "#93c5fd";

// Normaliza la etiqueta a "Semillas 1", "Devocionales 3", "Restauración 1"
function etiquetaEtapaModulo(etapa: string, modulo: number) {
  if (!etapa) return `Módulo ${modulo}`;
  const base = etapa.trim().split(/\s+/)[0];
  const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  return `${nombre} ${modulo}`;
}

// Label tipo "chip" para el valor en cada barra (diseño anti-desborde)
function ValorChip(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  // Decidimos si va dentro o fuera de la barra para evitar desbordes visuales
  const inside = width > 36;
  const padX = 6;
  const padY = 4;
  const chipX = inside ? x + width - 4 : x + width + 6;
  const chipY = y + height / 2;

  // estimamos ancho ~ 8px por carácter
  const text = String(value);
  const textW = Math.max(22, text.length * 8);
  const rectW = textW + padX * 2;
  const rectH = 20;

  return (
    <g transform={`translate(${chipX}, ${chipY})`}>
      <g transform={`translate(${inside ? -rectW : 0}, ${-rectH / 2})`}>
        <rect
          width={rectW}
          height={rectH}
          rx="10"
          ry="10"
          fill="#ffffff"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="1"
        />
        <text
          x={rectW / 2}
          y={rectH / 2 + 4}
          textAnchor="middle"
          fontSize="11"
          fontWeight={700}
          fill="#0f172a"
          style={{ fontVariantNumeric: "tabular-nums" as any }}
        >
          {text}
        </text>
      </g>
    </g>
  );
}

export default function DetalleSecciones({
  asistEtapas,
  agendados,
  asistPorModulo, // se usa para el gráfico por etapa+modulo
  defaultKey,
}: {
  asistEtapas: any[];
  agendados?: Array<{ etapa_modulo: string; agendados_pendientes: number }>;
  asistPorModulo?: Array<{ etapa: string; modulo: number; confirmados: number; noAsistieron: number; total: number }>;
  defaultKey?: string;
}) {
  const [view, setView] = useState<string | null>(defaultKey || null);

  // --- Totales asistencias ---
  const totalConfirmados = asistEtapas.reduce((s, r) => s + r.confirmados, 0);
  const totalNoAsistieron = asistEtapas.reduce((s, r) => s + r.noAsistieron, 0);
  const totalAsist = totalConfirmados + totalNoAsistieron;

  const dataAsist = [
    { name: "Asistieron", value: totalConfirmados, color: "url(#gradOk)" },
    { name: "No asistieron", value: totalNoAsistieron, color: "url(#gradNo)" },
  ];

  const pct = (v: number, base: number) =>
    base > 0 ? ((v / base) * 100).toFixed(1) : "0";
  const pctOk = pct(totalConfirmados, totalAsist);
  const pctNo = pct(totalNoAsistieron, totalAsist);

  // --- Totales agendados ---
  const totalAgend = (agendados ?? []).reduce(
    (s, r) => s + r.agendados_pendientes,
    0
  );

  // --- Datos por etapa+modulo (panel derecho) ---
  const dataMods =
    (asistPorModulo ?? [])
      .slice()
      .sort((a, b) => {
        const ea = a.etapa?.localeCompare(b.etapa ?? "", "es", { sensitivity: "base" }) ?? 0;
        if (ea !== 0) return ea;
        return a.modulo - b.modulo;
      })
      .map((m) => ({
        name: etiquetaEtapaModulo(m.etapa, m.modulo),
        value: m.total,
      }));

  // Tooltip elegante reutilizable
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
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

  // Listener KPI (cambia vista al hacer click en una tarjeta KPI con data-key)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-key]");
      if (target) setView(target.getAttribute("data-key"));
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Contador animado del total
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
    // Ítems arriba y cada panel crece según su contenido
    <div className="grid premium-grid items-start">
      {!view && (
        <section className="card span-2 animate-fadeIn premium-glass">
          <h2 className="card-title">Bienvenido</h2>
          <p className="text-muted">
            Selecciona una tarjeta KPI para ver detalles.
          </p>
        </section>
      )}

      {view === "asistencias" && (
        <>
          {/* PANEL IZQUIERDO (DONUT) */}
          <section className="card premium-glass animate-slideIn relative panel-compact self-start max-w-[min(560px,94vw)] mx-auto lg:max-w-none">
            <div className="card-head">
              <h2 className="card-title">Gráfico de Asistencias</h2>
            </div>

            <div className="panel-body">
              {/* Etiquetas arriba */}
              <div className="asistencias-labels flex justify-between w-full px-4 mt-1 mb-3 text-sm">
                <div className="flex flex-col items-center text-green-600 font-semibold">
                  <span>
                    Asistieron{" "}
                    <span className="font-bold text-lg tabular-nums">
                      {totalConfirmados}
                    </span>
                  </span>
                  <span className="text-green-600 font-bold text-sm tabular-nums">
                    {pctOk}%
                  </span>
                </div>
                <div className="flex flex-col items-center text-red-600 font-semibold">
                  <span>
                    No asistieron{" "}
                    <span className="font-bold text-lg tabular-nums">
                      {totalNoAsistieron}
                    </span>
                  </span>
                  <span className="text-red-600 font-bold text-sm tabular-nums">
                    {pctNo}%
                  </span>
                </div>
              </div>

              {/* Donut */}
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

                {/* Centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-2">
                  <p className="text-3xl leading-tight font-extrabold text-gray-900 tabular-nums">
                    {animatedTotal.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">Total</p>
                </div>
              </div>
            </div>
          </section>

          {/* PANEL DERECHO (GRÁFICO POR ETAPA+MÓDULO + TABLA) */}
          <section className="card premium-glass animate-slideIn panel-compact self-start max-w-[min(560px,94vw)] mx-auto lg:max-w-none flex flex-col min-h-0 h-auto" style={{minHeight: '0', height: 'auto'}}>
            <div className="card-head pb-0">
              <h2 className="card-title">Detalle por etapa</h2>
            </div>

            {/* Barras por Etapa+Módulo – versión premium */}
            {dataMods.length > 0 && (
              <div className="px-2 pt-3">
                <h3 className="text-sm font-semibold text-slate-700 px-1 mb-2">
                  Asistencias por módulo
                </h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dataMods}
                      margin={{ top: 8, right: 16, left: 8, bottom: 10 }}
                      barCategoryGap="18%"
                    >
                      {/* Grid sutil */}
                      <CartesianGrid
                        strokeDasharray="4 8"
                        stroke="rgba(148, 163, 184, 0.24)"
                        vertical={false}
                      />
                      {/* Eje X con etiquetas estilizadas */}
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-10}
                        textAnchor="end"
                        height={44}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#1f2937", fontWeight: 600 }}
                      />
                      {/* Eje Y minimalista */}
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                        tick={{ fontSize: 12, fill: "rgba(15, 23, 42, 0.65)" }}
                      />
                      {/* Tooltip personalizado */}
                      <Tooltip content={<CustomTooltip />} />
                      {/* Defs para gradiente */}
                      <defs>
                        <linearGradient id="gradAsistMod" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={BLUE_LIGHT} />
                          <stop offset="100%" stopColor={BLUE} />
                        </linearGradient>
                      </defs>
                      {/* Fondo suave de cada barra */}
                      <Bar
                        dataKey="value"
                        background={{ fill: "rgba(148,163,184,0.18)", radius: 12 }}
                        radius={[12, 12, 12, 12]}
                        maxBarSize={52}
                        fill="url(#gradAsistMod)"
                        animationDuration={700}
                        animationBegin={80}
                        animationEasing="ease-out"
                      >
                        {/* Chip de valor (tabular-nums, anti-desborde) */}
                        <LabelList dataKey="value" content={<ValorChip />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TABLA por etapa */}
            <div className="panel-body px-0 py-0">
              <div className="premium-table-row premium-table-header">
                <span>Etapa</span>
                <span className="text-center">Asistencias</span>
                <span className="text-center">Inasistencias</span>
                <span className="text-right">Total</span>
              </div>

              {asistEtapas.map((row: any, i: number) => (
                <div key={i} className="premium-table-row premium-table-item">
                  <span className="font-medium text-slate-700">{row.etapa}</span>
                  <span className="text-center font-semibold text-green-600 tabular-nums">
                    {row.confirmados}
                  </span>
                  <span className="text-center font-semibold text-red-600 tabular-nums">
                    {row.noAsistieron}
                  </span>
                  <span className="text-right font-semibold text-gray-800 tabular-nums">
                    {row.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {view === "agendados" && (
        <>
          {/* PANEL IZQUIERDO */}
          <section className="card premium-glass animate-slideIn relative panel-compact self-start">
            <div className="card-head">
              <h2 className="card-title">Agendados por semana</h2>
            </div>

            <div className="panel-body">
              <div className="panel-chart relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(agendados ?? []).map((r) => ({
                      name: r.etapa_modulo,
                      value: r.agendados_pendientes,
                    }))}
                    margin={{ top: 16, right: 20, left: 6, bottom: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 8"
                      stroke="rgba(148, 163, 184, 0.24)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#1f2933", fontWeight: 600 }}
                      interval={0}
                      angle={-12}
                      textAnchor="end"
                      height={54}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "rgba(15, 23, 42, 0.65)" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <defs>
                      <linearGradient id="gradAg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9cb9ff" />
                        <stop offset="50%" stopColor="#6690ff" />
                        <stop offset="100%" stopColor="#3a6bff" />
                      </linearGradient>
                    </defs>
                    <Bar
                      dataKey="value"
                      radius={[14, 14, 14, 14]}
                      maxBarSize={48}
                      fill="url(#gradAg)"
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="absolute top-3 right-4 text-right chart-meta">
                  <p className="chart-meta-label">Total agendados</p>
                  <p className="chart-meta-value tabular-nums">
                    {animatedTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* PANEL DERECHO */}
          <section className="card premium-glass animate-slideIn panel-compact self-start">
            <div className="card-head pb-0">
              <h2 className="card-title">Detalle por etapa/módulo</h2>
            </div>

            <div className="panel-body px-0 py-0">
              <div className="premium-table-row premium-table-header two-cols">
                <span>Etapa · Módulo</span>
                <span className="text-right">Agendados</span>
              </div>

              {(agendados ?? []).map((row, i) => (
                <div key={i} className="premium-table-row premium-table-item two-cols">
                  <span className="font-medium text-slate-700">
                    {row.etapa_modulo}
                  </span>
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
