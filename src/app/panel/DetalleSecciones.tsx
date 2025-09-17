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
} from "recharts";






type DetalleSeccionesProps = {
  asistEtapas: any[];
  agendados?: { etapa_modulo: string; agendados_pendientes: number }[];
  defaultKey?: string; // 👈 AÑADIR AQUÍ
};

const GREEN = "#34d399";   // verde premium
const GREEN_LIGHT = "#4ade80";
const RED = "#dc2626";     // rojo profundo
const RED_LIGHT = "#f87171";
const BLUE = "#3b82f6";    // azul premium
const BLUE_LIGHT = "#93c5fd";

export default function DetalleSecciones({
  asistEtapas,
  agendados,
  defaultKey,
}: {
  asistEtapas: any[];
  agendados?: Array<{ etapa_modulo: string; agendados_pendientes: number }>;
  defaultKey?: string; // 👈 nuevo
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

  // Tooltip elegante reutilizable
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const { name, value } = payload[0];
      const base = view === "agendados" ? totalAgend : totalAsist;
      return (
        <div className="bg-white/90 backdrop-blur-md p-2 rounded-md shadow-md text-sm">
          <p className="font-semibold">{name}</p>
          <p className="tabular-nums">
            {value} ({pct(value, base)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Listener KPI
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-key]");
      if (target) setView(target.getAttribute("data-key"));
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Contador animado del total (cambia según vista)
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
    <div className="grid premium-grid">
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
          {/* PANEL IZQUIERDO */}
          <section className="card premium-glass animate-slideIn relative panel-compact">
            <div className="card-head">
              <h2 className="card-title">Gráfico de Asistencias</h2>
            </div>

            <div className="panel-body">
              {/* Etiquetas arriba */}
              <div className="flex justify-between w-full px-4 mt-1 mb-3 text-sm">
                <div className="flex flex-col items-center text-green-600 font-semibold">
                  <span>
                    Asistieron{' '}
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
                    No asistieron{' '}
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
              <div className="panel-chart relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" className="donut-chart">
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
                      innerRadius={62}
                      outerRadius={104}
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
                        <Cell
                          key={i}
                          fill={d.color}
                          stroke="#ffffff"
                          strokeWidth={3}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center">
                  <p className="text-3xl leading-tight font-extrabold text-gray-900 tabular-nums">
                    {animatedTotal.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">Total</p>
                </div>
              </div>
            </div>
          </section>

          {/* PANEL DERECHO */}
          <section className="card premium-glass animate-slideIn panel-compact">
            <div className="card-head pb-0 compact-head">
              <h2 className="card-title">Detalle por etapa</h2>
            </div>

            <div className="panel-body panel-scroll px-0 py-0">
              <div className="premium-table-row premium-table-header">
                <span>Etapa</span>
                <span className="text-center">Asistencias</span>
                <span className="text-center">Inasistencias</span>
                <span className="text-right">Total</span>
              </div>

              {asistEtapas.map((row: any, i: number) => (
                <div
                  key={i}
                  className="premium-table-row premium-table-item"
                >
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
          <section className="card premium-glass animate-slideIn relative panel-compact">
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
                    <CartesianGrid strokeDasharray="4 8" stroke="rgba(148, 163, 184, 0.24)" vertical={false} />
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
                    <Bar
                      dataKey="value"
                      radius={[14, 14, 14, 14]}
                      maxBarSize={48}
                      fill="url(#gradAg)"
                    />
                    <defs>
                      <linearGradient id="gradAg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9cb9ff" />
                        <stop offset="50%" stopColor="#6690ff" />
                        <stop offset="100%" stopColor="#3a6bff" />
                      </linearGradient>
                      <linearGradient id="gradAgGlow" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgba(162, 201, 255, 0.25)" />
                        <stop offset="100%" stopColor="rgba(58, 107, 255, 0)" />
                      </linearGradient>
                    </defs>
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
          <section className="card premium-glass animate-slideIn panel-compact">
            <div className="card-head pb-0">
              <h2 className="card-title">Detalle por etapa/módulo</h2>
            </div>

            <div className="panel-body panel-scroll px-0 py-0">
              <div className="premium-table-row premium-table-header two-cols">
                <span>Etapa · Módulo</span>
                <span className="text-right">Agendados</span>
              </div>

              {(agendados ?? []).map((row, i) => (
                <div
                  key={i}
                  className="premium-table-row premium-table-item two-cols"
                >
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
