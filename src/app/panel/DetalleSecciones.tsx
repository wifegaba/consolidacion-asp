// src/app/panel/DetalleSecciones.tsx
"use client";

import { FileText, LoaderCircle, Search } from 'lucide-react';

import React, { useEffect, useState, useMemo, useSyncExternalStore, startTransition } from "react";
import dynamic from 'next/dynamic';
import { ModuleDetailDialog, type ModuleDetail, type ModuleSelection } from './ModuleDetailDialog';
// MEJORA 1: Eliminamos imports estáticos de Recharts y jsPDF para reducir el bundle inicial
import { getContactosPorFiltro, getServidoresPorFiltro, getAsistentesPorEtapaFiltro, getActivosPorFiltro } from "@/app/actions";
import type { Range } from "@/app/actions";

const chartDuration = 900;
const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function DonutTotal({ total, reduceMotion }: { total: number; reduceMotion: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.max(0, Math.min(1, (now - start) / chartDuration));
      setCount(Math.round(total * (1 - Math.pow(1 - progress, 2))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [total, reduceMotion]);

  return <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-1">
    <p className="text-3xl leading-tight font-extrabold text-gray-900 tabular-nums">
      <span aria-hidden="true">{(reduceMotion ? total : count).toLocaleString('es-CO')}</span>
      <span className="sr-only">{total.toLocaleString('es-CO')}</span>
    </p>
    <p className="text-gray-500 text-sm mt-0.5">Total</p>
  </div>;
}

// ============================ COMPONENTE DE GRÁFICO DINÁMICO ============================
// MEJORA 2: Encapsulamos TODO el gráfico en un módulo dinámico.
// Esto evita que 'Pie', 'Cell', 'Tooltip' y 'ResponsiveContainer' bloqueen la carga inicial.
const DonutChartModule = dynamic(async () => {
  const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } = await import("recharts");

  // Definimos el Tooltip dentro del módulo diferido
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DonutSegmentData }>; }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-sm ring-1 ring-black/10">
          <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1">{data.baseName}</p>
          <p className={`${data.type === 'asistencia' ? 'text-green-600' : 'text-red-600'} font-medium`}>
            {data.type === 'asistencia' ? 'Asist.:' : 'Inasist.:'} <span className="font-bold tabular-nums">{data.value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Definimos el Label dentro del módulo diferido
  const RadialLabel = ({ cx, cy, midAngle, outerRadius, percent, payload }: any) => {
    if (!payload) return null;
    const isInas = payload.type === 'inasistencia';
    const threshold = isInas ? 0.005 : 0.03;
    if (percent < threshold && !isInas) return null;

    try {
      const baseName: string = String(payload.baseName || payload.name || '');
      const match = baseName.match(/^(\s*([^\d]+?)\s+)?(\d+)/);
      let etapaShort = '';
      let moduloNum = '';
      if (match) {
        etapaShort = (match[2] || '').trim().substring(0, 1).toUpperCase();
        moduloNum = match[3] || '';
      } else {
        const parts = baseName.split(/\s+/).filter(Boolean);
        etapaShort = parts[0] ? parts[0].substring(0, 1).toUpperCase() : 'M';
        moduloNum = parts[1] || '';
      }
      const shortType = isInas ? 'Inas.' : 'Asist.';
      const shortLabel = moduloNum ? `${etapaShort}${moduloNum} ${shortType}` : `${baseName} ${shortType}`;

      const RADIAN = Math.PI / 180;
      const radiusLineStart = outerRadius + 5;
      const radiusLineEnd = outerRadius + 13;
      const radiusText = outerRadius + 17;
      const sx = cx + radiusLineStart * Math.cos(-midAngle * RADIAN);
      const sy = cy + radiusLineStart * Math.sin(-midAngle * RADIAN);
      const mx = cx + radiusLineEnd * Math.cos(-midAngle * RADIAN);
      const my = cy + radiusLineEnd * Math.sin(-midAngle * RADIAN);
      const tx = cx + radiusText * Math.cos(-midAngle * RADIAN);
      const ty = cy + radiusText * Math.sin(-midAngle * RADIAN);
      const textAnchor = tx > cx ? 'start' : 'end';
      const color = isInas ? '#b91c1c' : '#666';

      return (
        <g>
          <path d={`M${sx},${sy}L${mx},${my}L${tx},${my}`} stroke={color} fill="none" strokeWidth={1} />
          <text x={tx + (tx > cx ? 3 : -3)} y={ty} fill={color} textAnchor={textAnchor} dominantBaseline="middle" style={{ fontSize: '11px', fontWeight: 500, pointerEvents: 'none' }}>
            {shortLabel}
          </text>
        </g>
      );
    } catch (e) { return null; }
  };

  // Componente Retornado (convertido a componente nombrado para evitar error `react/display-name`)
  const DonutInner = (props: any) => {
    const { data, onHover, hoveredModuloKey, colors, total } = props;
    const reduceMotion = useSyncExternalStore(subscribeToReducedMotion, () => window.matchMedia(motionQuery).matches, () => true);
    return (<>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart onMouseLeave={() => onHover(null, null)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            cornerRadius={5}
            isAnimationActive={!reduceMotion}
            animationBegin={0}
            animationDuration={chartDuration}
            animationEasing="ease-out"
            labelLine={false}
            label={<RadialLabel />}
          >
            {data.map((entry: DonutSegmentData, index: number) => {
              const [etapa, moduloStr] = entry.baseName.split(' ');
              const moduloNum = parseInt(moduloStr, 10);

              let segmentColor = colors.Default;
              if (entry.type === 'asistencia' && etapa && !isNaN(moduloNum)) {
                // Replicamos la lógica de color interna
                const base = colors[etapa] || colors.Default;
                // Lógica simple de aclarado manual para no duplicar funciones complejas dentro del dynamic
                segmentColor = base;
              } else if (entry.type === 'inasistencia') {
                segmentColor = colors.Inasistencia;
              }

              return (
                <Cell
                  key={`cell-${index}-${entry.name}`}
                  fill={segmentColor}
                  stroke={"#fff"}
                  strokeWidth={1}
                  style={{
                    transition: 'opacity 0.2s ease, filter 0.2s ease',
                    opacity: hoveredModuloKey ? (hoveredModuloKey === entry.baseName ? 1 : 0.3) : 1,
                    filter: hoveredModuloKey === entry.baseName ? 'brightness(1.10)' : 'brightness(1)'
                  }}
                  onMouseEnter={() => onHover(entry.baseName, entry.etapa)}
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <DonutTotal key={total} total={total} reduceMotion={reduceMotion} />
    </>);
  };

  DonutInner.displayName = 'DonutChartModuleInner';

  return DonutInner;
}, {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-full animate-pulse">Cargando gráfico...</div>
});

/* ============================ Tipos ============================ */
type AsistEtapaRow = { etapa: string; confirmados: number; noAsistieron: number; total: number; };
type AgendadoRow = { etapa_modulo: string; agendados_pendientes: number; };
type AsistModuloRow = { etapa: string; modulo: number; dia: string; confirmados: number; noAsistieron: number; total: number; };
type BarChartData = { key: string; value: number; color: string; };
type Persona = { nombre: string; telefono: string | null; };

type AsistBarData = {
  label: string;
  value: number;
  type: 'asistencia' | 'inasistencia';
  etapa: string;
  modulo: number;
  dia: string;
  asistio: boolean;
};

type DonutSegmentData = {
  name: string;
  baseName: string;
  etapa: string;
  value: number;
  type: 'asistencia' | 'inasistencia';
};

type DetalleSeccionesProps = {
  asistEtapas: AsistEtapaRow[];
  agendados?: AgendadoRow[];
  asistPorModulo?: AsistModuloRow[];
  contactosPorEtapaDia?: BarChartData[];
  servidoresPorRolEtapaDia?: BarChartData[];
  defaultKey?: string;
  range?: Range;
  valor?: string;
  monthLabel?: string;
};

/* ============================ Constantes y Utils ============================ */
const ETAPA_BASE_COLORS: Record<string, string> = {
  Semillas: "#34d399",
  Devocionales: "#a78bfa",
  Restauracion: "#60a5fa",
  Consolidacion: "#14b8a6",
  Discipulado: "#a3e635",
  Liderazgo: "#06b6d4",
  Default: "#9ca3af",
  Inasistencia: "#ef4444"
};

const normalizeDayKey = (day?: string) => (day ? String(day).trim().toLowerCase() : '');
// MEJORA 3: Funciones de PDF asíncronas (Lazy Loading de jspdf)
const generateContactosPdf = async (title: string, data: Persona[]) => {
  if (!data.length) return;
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor("#ffffff");
  doc.setFillColor(44, 62, 80);
  doc.rect(0, 0, 210, 25, "F");
  doc.text(title, 105, 16, { align: "center" });
  autoTable(doc, { startY: 35, head: [['Nombre', 'Teléfono']], body: data.map(p => [p.nombre, p.telefono || 'N/A']), theme: 'grid', headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' }, styles: { cellPadding: 3, fontSize: 10, valign: 'middle' }, alternateRowStyles: { fillColor: [245, 245, 245] }, });
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' }); }
  const fileName = `${title.replace(/[^\w\s]/gi, '').replace(/ /g, '_')}.pdf`;
  doc.save(fileName);
};

const downloadModulePdf = (detail: ModuleDetail) => {
  const people = detail.showDocument
    ? detail.data.map(person => ({ ...person, nombre: person.cedula ? person.nombre + ' — ' + person.cedula : person.nombre }))
    : detail.data;
  return generateContactosPdf(detail.title, people);
};

function etiquetaEtapaModulo(etapa: string, modulo: number, dia: string) { if (!etapa) return `Módulo ${modulo}`; const base = etapa.trim().split(/\s+/)[0]; const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase(); return `${nombre} ${modulo} (${dia})`; }
const normalizeWs = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
const parseContactoKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^(.+?)\s+(\d+)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { etapa: normalizeWs(m[1]), modulo: parseInt(m[2], 10), dia: normalizeWs(m[3]) }; };
const parseServidorKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^([^-\n]+)-\s*(.+?)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { rol: normalizeWs(m[1]), etapa: normalizeWs(m[2]), dia: normalizeWs(m[3]) }; };
const stageOrder = ['Semillas', 'Devocionales', 'Restauracion', 'Consolidacion', 'Discipulado', 'Liderazgo'];
const dayOrder = ['domingo', 'martes', 'jueves', 'sábado', 'virtual'];

type ModuleReportRow = { key: string; etapa: string; modulo: number; dia: string; value: number; hasActions?: boolean };

const reportLabels = {
  asistencia: { total: 'Total de asistencias', empty: 'No hay asistencias en este periodo.', people: 'asistentes' },
  inasistencia: { total: 'Total de inasistencias', empty: 'No hay inasistencias registradas.', people: 'inasistentes' },
  contacto: { total: 'Total de contactos activos', empty: 'No hay contactos activos.', people: 'contactos activos' },
  coordinador: { total: 'Total de coordinadores', empty: 'No hay coordinadores registrados.', people: 'coordinadores' },
  timoteo: { total: 'Total de timoteos', empty: 'No hay timoteos registrados.', people: 'timoteos' },
  cita: { total: 'Total de citas pendientes', empty: 'No hay citas pendientes esta semana.', people: 'citas pendientes' },
};

const serviceReports = [
  { kind: 'coordinador', role: 'Maestros', title: 'Detalle de Coordinadores' },
  { kind: 'timoteo', role: 'Contactos', title: 'Detalle de Timoteos' },
] as const;

function ModuleBreakdown<Row extends ModuleReportRow>({ data, onDetail, hoveredModuloKey, kind }: {
  data: Row[];
  onDetail: (item: Row) => Promise<ModuleDetail>;
  hoveredModuloKey?: string | null;
  kind: keyof typeof reportLabels;
}) {
  const [selection, setSelection] = useState<ModuleSelection | null>(null);
  const [loadingPdfKeys, setLoadingPdfKeys] = useState<Set<string>>(() => new Set());
  async function download(item: Row) {
    setLoadingPdfKeys(keys => new Set(keys).add(item.key));
    try {
      await downloadModulePdf(await onDetail(item));
    } catch (error) {
      console.error('Error al descargar el PDF del módulo', error);
    } finally {
      setLoadingPdfKeys(keys => {
        const remaining = new Set(keys);
        remaining.delete(item.key);
        return remaining;
      });
    }
  }
  const absence = kind === 'inasistencia';
  const labels = reportLabels[kind];
  const rows = absence ? data.filter(item => item.etapa !== 'General') : data;
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...rows.map(item => item.value));
  const stages = new Map<string, Map<number, Row[]>>();
  for (const row of rows) {
    if (!stages.has(row.etapa)) stages.set(row.etapa, new Map());
    const modules = stages.get(row.etapa)!;
    if (!modules.has(row.modulo)) modules.set(row.modulo, []);
    modules.get(row.modulo)!.push(row);
  }

  if (!rows.length) return <p className="module-empty">{labels.empty}</p>;

  const rank = (order: string[], value: string) => {
    const index = order.indexOf(value);
    return index < 0 ? order.length : index;
  };
  const orderedStages = [...stages].sort(([a], [b]) => rank(stageOrder, a) - rank(stageOrder, b) || a.localeCompare(b, 'es'));

  return <div className="module-attendance" data-absence={absence || undefined}>
    {selection && <ModuleDetailDialog selection={selection} onDismiss={() => setSelection(null)} onPdf={downloadModulePdf} />}
    <div className="module-overview">
      <span>{labels.total}</span>
      <strong>{total.toLocaleString('es-CO')}</strong>
    </div>
    {orderedStages.map(([stage, modules]) => {
      const name = stage === 'Restauracion' ? 'Restauración' : stage === 'Consolidacion' ? 'Consolidación' : stage;
      return <section className="module-stage" key={stage} data-stage={stage}>
        <h3 className="module-stage-name">{name}</h3>
        <div className="module-pairs">
          {[...modules].sort(([a], [b]) => a - b).map(([module, items]) => {
            const moduleKey = stage + ' ' + module;
            const moduleName = module ? name + ' ' + module : name;
            const ordered = [...items].sort((a, b) => rank(dayOrder, normalizeDayKey(a.dia)) - rank(dayOrder, normalizeDayKey(b.dia)) || a.dia.localeCompare(b.dia, 'es'));
            const available = ordered.filter(item => item.hasActions !== false);
            const tone = module > 0 ? (module - 1) % 4 + 1 : undefined;
            function open(trigger: HTMLButtonElement, selectedKey?: string) {
              const origin = trigger.closest('article')?.getBoundingClientRect();
              if (!origin) return;
              setSelection({
                origin, trigger, tone, name: moduleName,
                selectedKey: selectedKey ?? (available.length === 1 ? available[0].key : undefined),
                choices: available.map(item => ({ key: item.key, day: item.dia, count: item.value, load: () => onDetail(item) })),
              });
            }
            return <article className="module-tile" key={module} data-module={moduleKey} data-module-tone={tone}
              data-dimmed={Boolean(hoveredModuloKey && hoveredModuloKey !== moduleKey) || undefined}>
              <div className="module-tile-heading">
                <h4>{available.length ? <button type="button" aria-haspopup="dialog" onClick={event => open(event.currentTarget)}>{moduleName}</button> : moduleName}</h4>
                <strong title={labels.total}>
                  {items.reduce((sum, item) => sum + item.value, 0).toLocaleString('es-CO')}
                </strong>
              </div>
              {ordered.map(item => {
                const { key } = item;
                const isDownloading = loadingPdfKeys.has(key);
                const label = moduleName + ' · ' + item.dia;
                return <div className="module-day" key={key}>
                  <div className="module-day-data">
                    <div className="module-day-label"><span>{item.dia}</span><strong>{item.value.toLocaleString('es-CO')}</strong></div>
                    <div className="module-bar" aria-hidden="true">
                      <div className="module-bar-fill" data-day={normalizeDayKey(item.dia)} style={{ width: (item.value / max) * 100 + '%' }} />
                    </div>
                  </div>
                  {item.hasActions !== false && <div className="module-actions">
                    <button type="button" aria-haspopup="dialog" onClick={event => open(event.currentTarget, item.key)} aria-label={'Consultar ' + labels.people + ' de ' + label} title="Consultar detalle"><Search size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => download(item)} aria-label={'Descargar PDF de ' + label} title="Descargar PDF" disabled={isDownloading} aria-busy={isDownloading}>
                      {isDownloading ? <LoaderCircle size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
                    </button>
                  </div>}
                </div>;
              })}
            </article>;
          })}
        </div>
      </section>;
    })}
  </div>;
}

/* ========================= Componente principal ========================= */
export default function DetalleSecciones({
  asistEtapas,
  agendados = [],
  asistPorModulo = [],
  contactosPorEtapaDia = [],
  servidoresPorRolEtapaDia = [],
  defaultKey,
  range = 'month',
  valor,
  monthLabel,
}: DetalleSeccionesProps) {
  const [view, setView] = useState<string | null>(defaultKey || null);

  const [hoveredModuloKey, setHoveredModuloKey] = useState<string | null>(null);
  const [hoveredEtapaKey, setHoveredEtapaKey] = useState<string | null>(null);

  const loadContactDetails = async (key: string, active: boolean): Promise<ModuleDetail> => {
    const parsed = parseContactoKey(key);
    if (!parsed) throw new Error('Invalid contact key');
    const { etapa, modulo, dia } = parsed;
    const load = active ? getActivosPorFiltro : getContactosPorFiltro;
    return { title: 'Contactos de ' + normalizeWs(key), data: await load(etapa, modulo, dia) };
  };

  const loadServiceDetails = async (key: string): Promise<ModuleDetail> => {
    const parsed = parseServidorKey(key);
    if (!parsed) throw new Error('Invalid server key');
    const { rol, etapa, dia } = parsed;
    const role = serviceReports.find(report => report.role === rol);
    const label = role?.kind === 'coordinador' ? 'Coordinadores' : role?.kind === 'timoteo' ? 'Timoteos' : rol;
    return {
      title: label + ' de ' + etapa + ' (' + dia + ')',
      data: await getServidoresPorFiltro(rol, etapa, dia),
      showDocument: true,
    };
  };

  const loadAttendanceDetails = async (item: AsistBarData): Promise<ModuleDetail> => {
    const { etapa, modulo, dia, asistio } = item;
    const label = asistio ? 'Asistentes' : 'Inasistentes';
    return {
      title: label + ' de ' + etiquetaEtapaModulo(etapa, modulo, dia),
      data: await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio, range, valor),
    };
  };

  const totalAsist = asistEtapas.reduce((s, r) => s + (r.total || 0), 0);

  const donutChartData: DonutSegmentData[] = useMemo(() => {
    const modulosMap = asistPorModulo.reduce((acc, m) => {
      if (!m.etapa || typeof m.modulo !== 'number') return acc;
      const key = `${m.etapa} ${m.modulo}`;
      if (!acc[key]) {
        acc[key] = { name: key, etapa: m.etapa, confirmados: 0, noAsistieron: 0 };
      }
      acc[key].confirmados += m.confirmados || 0;
      acc[key].noAsistieron += m.noAsistieron || 0;
      return acc;
    }, {} as Record<string, { name: string, etapa: string, confirmados: number, noAsistieron: number }>);

    return Object.values(modulosMap).flatMap(moduloData => {
      const segments: DonutSegmentData[] = [];
      if (moduloData.confirmados > 0) {
        segments.push({
          name: `${moduloData.name} Asist.`,
          baseName: moduloData.name,
          etapa: moduloData.etapa,
          value: moduloData.confirmados,
          type: 'asistencia',
        });
      }
      if (moduloData.noAsistieron > 0) {
        segments.push({
          name: `${moduloData.name} Inas.`,
          baseName: moduloData.name,
          etapa: moduloData.etapa,
          value: moduloData.noAsistieron,
          type: 'inasistencia',
        });
      }
      return segments;
    }).filter(segment => segment.value > 0);
  }, [asistPorModulo]);

  const asistenciasChartData = useMemo(() => asistPorModulo.filter(m => (m.confirmados || 0) > 0).map(m => ({
    label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia), value: m.confirmados, type: 'asistencia' as const, etapa: m.etapa, modulo: m.modulo, dia: m.dia, asistio: true
  })), [asistPorModulo]);

  const inasistenciasChartData = useMemo(() => {
    const totalInasist = asistPorModulo.reduce((s, r) => s + (r.noAsistieron || 0), 0);
    const inasistenciasPorModulo = asistPorModulo.filter(m => (m.noAsistieron || 0) > 0).map(m => ({
      label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia), value: m.noAsistieron, type: 'inasistencia' as const, etapa: m.etapa, modulo: m.modulo, dia: m.dia, asistio: false
    }));
    return [
      ...inasistenciasPorModulo,
      { label: 'Inasistencias Total', value: totalInasist, type: 'inasistencia' as const, etapa: 'General', modulo: 0, dia: '', asistio: false }
    ].filter(item => item.value > 0);
  }, [asistPorModulo]);

  // MEJORA 5: startTransition para cambiar pestañas sin bloquear
  useEffect(() => { const handler = (e: MouseEvent) => { const target = (e.target as HTMLElement).closest(".consolidation-dashboard .kpi-row [data-key]"); if (target) startTransition(() => setView(target.getAttribute("data-key"))); }; document.addEventListener("click", handler); return () => document.removeEventListener("click", handler); }, []);

  const serviceRows = useMemo(() => {
    const reports: Record<(typeof serviceReports)[number]['role'], ModuleReportRow[]> = { Maestros: [], Contactos: [] };
    for (const row of servidoresPorRolEtapaDia) {
      const parsed = parseServidorKey(row.key);
      const role = parsed?.rol ?? normalizeWs(row.key);
      if (role !== 'Maestros' && role !== 'Contactos') continue;

      const course = parsed && parseContactoKey(parsed.etapa + ' (' + parsed.dia + ')');
      reports[role].push({
        key: row.key,
        value: row.value,
        etapa: course?.etapa ?? parsed?.etapa ?? 'Sin asignación',
        modulo: course?.modulo ?? 0,
        dia: parsed?.dia ?? 'Sin día',
        hasActions: Boolean(parsed),
      });
    }
    return reports;
  }, [servidoresPorRolEtapaDia]);

  const appointmentRows = useMemo(() => agendados.map(row => {
    const key = row.etapa_modulo;
    const course = parseContactoKey(key);
    return {
      ...(course ?? { etapa: 'Sin módulo', modulo: 0, dia: key }),
      key,
      value: row.agendados_pendientes,
      hasActions: Boolean(course && row.agendados_pendientes > 0),
    };
  }), [agendados]);

  const activeContacts = useMemo(() => contactosPorEtapaDia.flatMap(row => {
    const parsed = parseContactoKey(row.key);
    return parsed ? [{ ...parsed, key: row.key, value: row.value }] : [];
  }), [contactosPorEtapaDia]);

  const monthHeading = monthLabel && <p key={monthLabel} className="dashboard-month-label">{monthLabel}</p>;

  return (
    <>
      <div id="consolidation-metric-detail" className="consolidation-metric-detail" data-metric={view ?? undefined}>
        {!view && (<div className="grid premium-grid"><section className="card span-2 animate-fadeIn premium-glass p-4"><h2 className="card-title">Bienvenido</h2><p className="text-muted">Selecciona una tarjeta KPI para ver detalles.</p></section></div>)}

        {view === "asistencias" && (
          <div key={range + ':' + (monthLabel ?? valor ?? '')} className="consolidation-attendance">
            <section className="dashboard-surface dashboard-summary">
              <div className="dashboard-surface-head"><p className="consolidation-eyebrow">Vista general</p><h2>Resumen por módulo</h2>{monthHeading}</div>

              <div className="dashboard-summary-chart">
                <div className="dashboard-summary-ring">
                  {/* DonutChartModule se carga dinámicamente */}
                  <DonutChartModule
                    data={donutChartData}
                    onHover={(baseName: string | null, etapa: string | null) => {
                      setHoveredModuloKey(baseName);
                      setHoveredEtapaKey(etapa);
                    }}
                    hoveredModuloKey={hoveredModuloKey}
                    colors={ETAPA_BASE_COLORS}
                    total={totalAsist}
                  />
                </div>
              </div>

              <div className="dashboard-stage-summary">
                <h3>Resumen por etapa</h3>
                <div className="premium-table-row premium-table-header">
                  <span>ETAPA</span>
                  <span className="text-center">ASIST.</span>
                  <span className="text-center">INAS.</span>
                  <span className="text-right">TOTAL</span>
                </div>
                {asistEtapas.map((row, i) => (
                  <div
                    key={i}
                    className={`premium-table-row premium-table-item transition-opacity duration-300 ${hoveredEtapaKey ? (hoveredEtapaKey === row.etapa ? 'opacity-100' : 'opacity-30') : 'opacity-100'
                      }`}
                    style={hoveredEtapaKey === row.etapa ? {
                      backgroundColor: 'rgba(230, 245, 255, 0.7)'
                    } : {}}
                    onMouseEnter={() => {
                      setHoveredEtapaKey(row.etapa);
                      setHoveredModuloKey(null);
                    }}
                    onMouseLeave={() => setHoveredEtapaKey(null)}
                  >
                    <span className="font-medium text-slate-700">{row.etapa}</span>
                    <div className="flex items-center justify-center gap-x-1">
                      <span className="font-semibold text-green-600 tabular-nums">{row.confirmados}</span>
                    </div>
                    <div className="flex items-center justify-center gap-x-1">
                      <span className="font-semibold text-red-600 tabular-nums">{row.noAsistieron}</span>
                    </div>
                    <span className="text-right font-semibold text-gray-800 tabular-nums">{row.total}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="dashboard-reports">
              <section className="dashboard-surface dashboard-report">
                <div className="dashboard-surface-head"><p className="consolidation-eyebrow">Asistencias</p><h2>Detalle por módulo</h2>{monthHeading}</div>
                <div className="dashboard-report-body">
                  <ModuleBreakdown kind="asistencia"
                    data={asistenciasChartData.map(item => ({ ...item, key: [item.etapa, item.modulo, item.dia, item.asistio].join('-') }))}
                    onDetail={loadAttendanceDetails}

                    hoveredModuloKey={hoveredModuloKey}
                  />
                </div>
              </section>

              <section className="dashboard-surface dashboard-report">
                <div className="dashboard-surface-head"><p className="consolidation-eyebrow">Seguimiento</p><h2>Inasistencias por módulo</h2>{monthHeading}</div>
                <div className="dashboard-report-body">
                  <ModuleBreakdown kind="inasistencia"
                    data={inasistenciasChartData.map(item => ({ ...item, key: [item.etapa, item.modulo, item.dia, item.asistio].join('-') }))}
                    onDetail={loadAttendanceDetails}

                    hoveredModuloKey={hoveredModuloKey}
                  />
                </div>
              </section>
            </div>
          </div>
        )}

        {view === "agendados" && (
          <section className="dashboard-surface dashboard-report">
            <div className="dashboard-surface-head"><h2>Citas pendientes de la semana</h2></div>
            <div className="dashboard-report-body">
              <ModuleBreakdown kind="cita" data={appointmentRows}
                onDetail={item => loadContactDetails(item.key, false)} />
            </div>
          </section>
        )}
        {view === "contactos" && (
          <section className="dashboard-surface dashboard-report">
            <div className="dashboard-surface-head"><p className="consolidation-eyebrow">Personas registradas</p><h2>Detalle de Contactos Activos</h2></div>
            <div className="dashboard-report-body">
              <ModuleBreakdown kind="contacto" data={activeContacts}
                onDetail={item => loadContactDetails(item.key, true)} />
            </div>
          </section>
        )}
        {view === "servidores" && (
          <div className="dashboard-reports">
            {serviceReports.map(({ kind, role, title }) => (
              <section key={role} className="dashboard-surface dashboard-report">
                <div className="dashboard-surface-head"><h2>{title}</h2></div>
                <div className="dashboard-report-body">
                  <ModuleBreakdown kind={kind} data={serviceRows[role]}
                    onDetail={item => loadServiceDetails(item.key)} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
