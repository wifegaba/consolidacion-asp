// src/app/panel/DetalleSecciones.tsx
"use client";

import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { 
  getContactosPorFiltro, 
  getServidoresPorFiltro, 
  getAsistentesPorEtapaFiltro,
  getActivosPorFiltro // <-- 1. IMPORTACIÓN AÑADIDA
} from "@/app/actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Range } from "@/lib/metrics";

/* ============================ Tipos ============================ */
type AsistEtapaRow = { etapa: string; confirmados: number; noAsistieron: number; total: number; };
type AgendadoRow = { etapa_modulo: string; agendados_pendientes: number; };
type AsistModuloRow = { etapa: string; modulo: number; dia: string; confirmados: number; noAsistieron: number; total: number; };
type BarChartData = { key: string; value: number; color: string; };
type Persona = { nombre: string; telefono: string | null; };
type ServidorDetalle = { nombre: string; telefono: string | null; cedula: string; };

type AsistBarData = {
  label: string;
  value: number;
  type: 'asistencia' | 'inasistencia';
  etapa: string;
  modulo: number;
  dia: string;
  asistio: boolean;
};

type DetalleSeccionesProps = {
  asistEtapas: AsistEtapaRow[];
  agendados?: AgendadoRow[];
  asistPorModulo?: AsistModuloRow[];
  contactosPorEtapaDia?: BarChartData[];
  servidoresPorRolEtapaDia?: BarChartData[];
  defaultKey?: string;
  range?: Range;
};

/* ============================ Constantes y Utils ============================ */
const GREEN = "#34d399"; const GREEN_LIGHT = "#4ade80"; const RED = "#dc2626"; const RED_LIGHT = "#f87171";
function etiquetaEtapaModulo(etapa: string, modulo: number, dia: string) { if (!etapa) return `Módulo ${modulo}`; const base = etapa.trim().split(/\s+/)[0]; const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase(); return `${nombre} ${modulo} (${dia})`; }
function colorPorEtapa(etapa: string): string { const m: Record<string, string> = { Semillas: "linear-gradient(180deg, #fecaca 0%, #f87171 100%)", Devocionales: "linear-gradient(180deg, #ddd6fe 0%, #a78bfa 100%)", Restauracion: "linear-gradient(180deg, #bfdbfe 0%, #60a5fa 100%)", Consolidacion: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)", Discipulado: "linear-gradient(180deg, #bbf7d0 0%, #34d399 100%)", Liderazgo: "linear-gradient(180deg, #fbcfe8 0%, #f472b6 100%)", }; if (m[etapa]) return m[etapa]; const colors = [ ["#fecaca", "#f87171"], ["#ddd6fe", "#a78bfa"], ["#bfdbfe", "#60a5fa"], ["#fde68a", "#f59e0b"], ["#bbf7d0", "#34d399"], ["#fbcfe8", "#f472b6"], ["#c7d2fe", "#6366f1"], ["#bae6fd", "#38bdf8"], ]; let hash = 0; for (let i = 0; i < etapa.length; i++) hash = (hash * 31 + etapa.charCodeAt(i)) >>> 0; const [c1, c2] = colors[hash % colors.length]; return `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`; }

const normalizeWs = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
const parseContactoKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^(.+?)\s+(\d+)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { etapa: normalizeWs(m[1]), modulo: parseInt(m[2], 10), dia: normalizeWs(m[3]) }; };
const parseServidorKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^([^-\n]+)-\s*(.+?)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { rol: normalizeWs(m[1]), etapa: normalizeWs(m[2]), dia: normalizeWs(m[3]) }; };

const parseSortKey = (key: string) => { const k = normalizeWs(key); const match = k.match(/^(.+?)\s+(\d+)\s*\((.+)\)\s*$/); if (match) { const etapaNameParts = match[1].split(' '); const etapaName = etapaNameParts.length > 1 ? etapaNameParts.slice(0, -1).join(' ') : match[1]; return { etapa: etapaName, modulo: parseInt(match[2], 10), dia: match[3] }; } const simpleMatch = k.match(/(Semillas|Devocionales|Restauracion)\s+(\d+)/); if(simpleMatch) { return { etapa: simpleMatch[1], modulo: parseInt(simpleMatch[2], 10), dia: '' }; } return { etapa: k, modulo: 0, dia: '' }; };


const generateContactosPdf = (title: string, data: Persona[]) => { if (!data.length) return; const doc = new jsPDF(); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor("#ffffff"); doc.setFillColor(44, 62, 80); doc.rect(0, 0, 210, 25, "F"); doc.text(title, 105, 16, { align: "center" }); autoTable(doc, { startY: 35, head: [['Nombre', 'Teléfono']], body: data.map(p => [p.nombre, p.telefono || 'N/A']), theme: 'grid', headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' }, styles: { cellPadding: 3, fontSize: 10, valign: 'middle' }, alternateRowStyles: { fillColor: [245, 245, 245] }, }); const pageCount = (doc as any).internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' }); } const fileName = `${title.replace(/[^\w\s]/gi, '').replace(/ /g, '_')}.pdf`; doc.save(fileName); };
const generateServidoresPdf = (title: string, subTitle: string, data: ServidorDetalle[]) => { const personas: Persona[] = data.map(s => ({ nombre: `${s.nombre}${s.cedula ? ` — ${s.cedula}` : ''}`, telefono: s.telefono })); const fullTitle = subTitle ? `${title} ${subTitle}` : title; generateContactosPdf(fullTitle, personas); };


/* ====================== Componentes Internos ===================== */

// Agregamos la interfaz para Agendados agrupados por módulo
interface AgendadoGroup {
    key: string; // Ej: Semillas 1
    items: AgendadoRow[];
}

// -------------------------------------------------------------
// COMPONENTE MODIFICADO: PremiumHorizontalBars (Agendados por Semana)
// Agrupa por Módulo e incluye iconos de acción
// -------------------------------------------------------------
// -------------------------------------------------------------
// COMPONENTE: PremiumHorizontalBars (Agendados por Semana)
// - Mobile: etiqueta arriba, barra/totales/acciones debajo (evita truncado)
// - sm+: grid de 4 columnas (etiqueta, barra, valor, acciones)
// -------------------------------------------------------------
const PremiumHorizontalBars = ({ data, onRowClick, onPdfClick, loadingPdfKey }: {
  data: AgendadoRow[];
  onRowClick: (key: string) => void;
  onPdfClick: (key: string) => void;
  loadingPdfKey: string | null;
}) => {
  const [widths, setWidths] = useState<Record<string, number>>({});

  // Normalizar y parsear los datos
  const parsedData: (BarChartData & { etapa_modulo: string; dia: string })[] = data.map(d => {
    const parts = d.etapa_modulo.split('(');
    const etapaModulo = normalizeWs(parts[0]);
    const dia = parts.length > 1 ? normalizeWs(parts[1].replace(')', '')) : '';
    return { key: d.etapa_modulo, value: d.agendados_pendientes, color: '#a78bfa', etapa_modulo: etapaModulo, dia };
  });

  const maxValue = Math.max(...parsedData.map(d => d.value), 0);

  // Agrupar por módulo (Semillas 1, Semillas 2...) -> mantener items como AgendadoRow originales
  const groups: AgendadoGroup[] = parsedData.reduce((acc, row) => {
    const groupKey = row.etapa_modulo;
    let group = acc.find(g => g.key === groupKey);
    if (!group) { group = { key: groupKey, items: [] as AgendadoRow[] }; acc.push(group); }
    const original = data.find(d => d.etapa_modulo === row.key);
    if (original) group.items.push(original);
    return acc;
  }, [] as AgendadoGroup[]).sort((a, b) => a.key.localeCompare(b.key));

  const gradients = ["linear-gradient(90deg, #6366f1, #818cf8)", "linear-gradient(90deg, #10b981, #34d399)", "linear-gradient(90deg, #06b6d4, #22d3ee)"];

  useEffect(() => {
    const newWidths: Record<string, number> = {};
    parsedData.forEach(d => { newWidths[d.key] = maxValue > 0 ? (d.value / maxValue) * 100 : 0; });
    const id = requestAnimationFrame(() => setWidths(newWidths));
    return () => cancelAnimationFrame(id);
  }, [parsedData, maxValue]);

  if (!parsedData.length) return <p className="text-center text-slate-500 py-4">No hay agendados para mostrar.</p>;

  let gradientIndex = 0;

  return (
    <div className="w-full h-full flex flex-col gap-1 py-1">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2 py-1">
          <h4 className="text-lg md:text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
          {group.items.map((row) => {
            const parsed = parsedData.find(d => d.key === row.etapa_modulo)!;
            const barGradient = gradients[gradientIndex++ % gradients.length];
            const currentKey = row.etapa_modulo;

            return (
              <div key={row.etapa_modulo} className="flex flex-col sm:grid sm:grid-cols-[1.6fr_2fr_auto_auto] items-start gap-2 sm:gap-x-3 pl-3 py-2">
                <div className={`w-full text-sm md:text-base text-left text-slate-600 whitespace-normal`} title={parsed.dia || row.etapa_modulo}>{parsed.dia || 'N/A'}</div>

                <div className="flex items-center w-full mt-1 sm:mt-0">
                  <div className="relative flex-1 h-6 w-full bg-slate-200/60 rounded-full overflow-hidden shadow-inner shadow-black/10">
                    <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: `${widths[currentKey] || 0}%`, background: barGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} />
                  </div>

                  <div className="text-base font-semibold text-slate-700 tabular-nums ml-3 w-12 text-left">{row.agendados_pendientes}</div>

                  <div className="flex items-center space-x-2 w-[52px] ml-2">
                    {row.agendados_pendientes > 0 && (
                      <>
                        <button onClick={() => onRowClick(currentKey)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Consultar detalles">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </button>
                        {loadingPdfKey === currentKey ? (
                          <div className="w-5 h-5 flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          </div>
                        ) : (
                          <button onClick={() => onPdfClick(currentKey)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Descargar PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};


// Interfaz para agrupar las asistencias por Etapa y Módulo
interface AsistenciaGroup {
    key: string; // Ej: Semillas 1
    items: AsistBarData[];
}

// -------------------------------------------------------------
// COMPONENTE MODIFICADO: AsistenciasHorizontalBars (Detalle por etapa)
// -------------------------------------------------------------
const AsistenciasHorizontalBars = ({ data, onDetalleClick, onPdfClick, loadingPdfKey }: {
  data: AsistBarData[];
  onDetalleClick: (item: AsistBarData) => void;
  onPdfClick: (item: AsistBarData) => void;
  loadingPdfKey: string | null;
}) => {
    const [widths, setWidths] = useState<Record<string, number>>({});
    
    // Filtramos solo las asistencias
    const asistencias = data.filter(d => d.type === 'asistencia');
    
    // 1. Agrupar asistencias por Etapa y Módulo
    const groups: AsistenciaGroup[] = asistencias.reduce((acc, row) => {
        const groupKey = `${row.etapa} ${row.modulo}`;
        let group = acc.find(g => g.key === groupKey);
        if (!group) {
            group = { key: groupKey, items: [] };
            acc.push(group);
        }
        group.items.push(row);
        return acc;
    }, [] as AsistenciaGroup[]).sort((a, b) => {
      const aParts = a.key.split(' ');
      const bParts = b.key.split(' ');
      const aEtapa = aParts[0];
      const bEtapa = bParts[0];
      const aModulo = parseInt(aParts[1], 10);
      const bModulo = parseInt(bParts[1], 10);

      const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 };
      const orderA = etapaOrder[aEtapa] || 99;
      const orderB = etapaOrder[bEtapa] || 99;

      if (orderA !== orderB) return orderA - orderB;
      return aModulo - bModulo;
    });

    const maxValue = Math.max(...asistencias.map(d => d.value), 0); // Máximo solo de asistencias
    const asistGradients = ["from-emerald-400 to-teal-500", "from-green-400 to-emerald-500", "from-cyan-400 to-sky-500", "from-teal-400 to-cyan-500", "from-lime-400 to-green-500"];
    
    useEffect(() => { 
        const newWidths: Record<string, number> = {}; 
        asistencias.forEach(d => { newWidths[d.label] = maxValue > 0 ? (d.value / maxValue) * 100 : 0; }); 
        const id = requestAnimationFrame(() => setWidths(newWidths)); 
        return () => cancelAnimationFrame(id); 
    }, [asistencias, maxValue]);
    
    if (asistencias.length === 0) { return <p className="text-center text-slate-500 py-4">No hay datos de asistencias para mostrar.</p>; }
    
    let asistenciaIndex = 0;
    
    return (
      <div className="w-full h-full flex flex-col gap-1 py-1 px-1">
        <h3 className="text-sm font-semibold text-slate-700 px-1 mb-3">Asistencias por módulo</h3>
        {groups.map((group) => (
            <div key={group.key} className="space-y-1 py-1">
                <h4 className="text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
                {group.items.map((d, i) => {
                    const gradient = asistGradients[asistenciaIndex++ % asistGradients.length];
                    const currentPdfKey = `${d.etapa}-${d.modulo}-${d.dia}-${d.asistio}`;
                    
                    return (
                        // Grid modificado: 1.5fr para etiqueta de día, 1.5fr para barra, y auto
                        <div key={d.label} className="grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3">
                            {/* Etiqueta solo muestra el DÍA */}
                            <div className={`text-xs sm:text-sm text-left text-slate-500 truncate`}>{d.dia}</div>
                            
                            {/* BARRA DE PROGRESO (ancho reducido a 1.5fr) */}
                            <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                                <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradient}`} 
                                    style={{ 
                                        width: `${widths[d.label] || 0}%`, 
                                        transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' 
                                    }}
                                />
                            </div>

                            {/* VALOR y ACCIONES (se mantiene el ancho de 8 y 52px) */}
                            <div className="text-sm font-semibold text-slate-700 tabular-nums w-8 text-left">{d.value}</div>
                            <div className="flex items-center space-x-2 w-[52px]">
                                {d.value > 0 && (
                                    <>
                                        <button onClick={() => onDetalleClick(d)} className="text-slate-400 hover:text-slate-700 transition-colors" title={`Consultar asistentes de ${d.label}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        </button>
                                        {loadingPdfKey === currentPdfKey ? (
                                            <div className="w-5 h-5 flex items-center justify-center">
                                                <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            </div>
                                        ) : (
                                            <button onClick={() => onPdfClick(d)} className="text-slate-400 hover:text-red-600 transition-colors" title="Descargar PDF">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        ))}
      </div>
    );
};

// -------------------------------------------------------------
// COMPONENTE MODIFICADO: InasistenciasPanel (Agrupa por Módulo)
// -------------------------------------------------------------
const InasistenciasPanel = ({ data, onDetalleClick, onPdfClick, loadingPdfKey }: {
  data: AsistBarData[];
  onDetalleClick: (item: AsistBarData) => void;
  onPdfClick: (item: AsistBarData) => void;
  loadingPdfKey: string | null;
}) => {
    const [widths, setWidths] = useState<Record<string, number>>({});
    
    const inasistencias = data.filter(d => d.type === 'inasistencia');
    const totalInasistencias = inasistencias.reduce((sum, d) => sum + d.value, 0);
    const generalInasistencia = inasistencias.find(d => d.etapa === 'General');
    const inasistenciasDetalle = inasistencias.filter(d => d.etapa !== 'General');

    // 1. Agrupar inasistencias detalladas por Etapa y Módulo
    const groups: AsistenciaGroup[] = inasistenciasDetalle.reduce((acc, row) => {
        const groupKey = `${row.etapa} ${row.modulo}`;
        let group = acc.find(g => g.key === groupKey);
        if (!group) {
            group = { key: groupKey, items: [] };
            acc.push(group);
        }
        group.items.push(row);
        return acc;
    }, [] as AsistenciaGroup[]).sort((a, b) => {
      // Ordenamiento igual que en AsistenciasHorizontalBars
      const aParts = a.key.split(' ');
      const bParts = b.key.split(' ');
      const aEtapa = aParts[0];
      const bEtapa = bParts[0];
      const aModulo = parseInt(aParts[1], 10);
      const bModulo = parseInt(bParts[1], 10);
      const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3 };
      const orderA = etapaOrder[aEtapa] || 99;
      const orderB = etapaOrder[bEtapa] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return aModulo - bModulo;
    });

    const maxValue = Math.max(...inasistencias.map(d => d.value), 1);
    const inasistGradient = "from-rose-500 to-red-600";

    useEffect(() => { 
        const newWidths: Record<string, number> = {}; 
        inasistencias.forEach(d => { newWidths[d.label] = maxValue > 0 ? (d.value / maxValue) * 100 : 0; }); 
        const id = requestAnimationFrame(() => setWidths(newWidths)); 
        return () => cancelAnimationFrame(id); 
    }, [inasistencias, maxValue]);

    if (inasistencias.length === 0 || totalInasistencias === 0) {
        return <p className="text-center text-slate-500 py-4">No hay inasistencias registradas.</p>;
    }
    
    return (
        <div className="w-full h-full flex flex-col gap-2 py-1 px-1">
            <h3 className="text-sm font-semibold text-rose-600 px-1 mb-3">Detalle por Módulo</h3>
            
            {groups.map((group) => (
                <div key={group.key} className="space-y-1 py-1">
                    <h4 className="text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
                    {group.items.map((d, i) => {
                        const currentPdfKey = `${d.etapa}-${d.modulo}-${d.dia}-${d.asistio}`;
                        
                        return (
                            // Grid: 1.5fr para etiqueta de día/módulo, 1.5fr para barra, y auto
                            <div key={d.label} className={`grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3`}>
                                {/* Etiqueta (solo el día) */}
                                <div className={`text-xs sm:text-sm text-left text-slate-600 truncate`}>{d.dia}</div>
                                
                                {/* BARRA DE PROGRESO */}
                                <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                                    <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${inasistGradient}`} 
                                        style={{ 
                                            width: `${widths[d.label] || 0}%`, 
                                            transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' 
                                        }}
                                    />
                                </div>

                                {/* VALOR y ACCIONES */}
                                <div className="text-sm tabular-nums w-8 text-left font-bold text-rose-700">{d.value}</div>
                                <div className="flex items-center space-x-2 w-[52px]">
                                    {d.value > 0 && (
                                        <>
                                            <button onClick={() => onDetalleClick(d)} className="text-slate-400 hover:text-rose-700 transition-colors" title={`Consultar inasistentes de ${d.label}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                            </button>
                                            {loadingPdfKey === currentPdfKey ? (
                                                <div className="w-5 h-5 flex items-center justify-center">
                                                    <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                </div>
                                            ) : (
                                                <button onClick={() => onPdfClick(d)} className="text-slate-400 hover:text-rose-600 transition-colors" title="Descargar PDF">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}

            {/* Inasistencia Total al final */}
            {generalInasistencia && (
                <div key={generalInasistencia.label} className={`grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3 pt-3 mt-2 border-t border-slate-300`}>
                    <div className={`text-sm sm:text-base font-extrabold text-rose-700 text-left truncate`}>{generalInasistencia.label}</div>
                    <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${inasistGradient}`} 
                            style={{ 
                                width: '100%',
                                opacity: 0.5, // Menos opacidad para que parezca una barra de resumen
                                transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' 
                            }}
                        />
                    </div>
                    <div className="text-sm tabular-nums w-8 text-left font-extrabold text-rose-700">{generalInasistencia.value}</div>
                    <div className="w-[52px]"></div>
                </div>
            )}
        </div>
    );
};


const ContactosDetalleModal = ({ isOpen, onClose, title, data, isLoading, premium }: { isOpen: boolean; onClose: () => void; title: string; data: Persona[]; isLoading: boolean; premium?: boolean; }) => { 
  const [currentPage, setCurrentPage] = useState(0); 
  const ITEMS_PER_PAGE = 10; 
  useEffect(() => { setCurrentPage(0); }, [data]); 
  if (!isOpen) return null; 
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE); 
  const startIndex = currentPage * ITEMS_PER_PAGE; 
  const paginatedData = data.slice(startIndex, startIndex + ITEMS_PER_PAGE); 
  const handlePrev = () => setCurrentPage(p => Math.max(0, p - 1)); 
  const handleNext = () => setCurrentPage(p => Math.min(totalPages - 1, p + 1)); 
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out" onClick={onClose} />
      {/* Contenedor principal con max-w-md */}
      <div
        className={"relative z-10 w-full max-w-md rounded-2xl shadow-2xl text-white transition-all duration-300 ease-out " + (premium ? 'bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-black/60 border border-white/10 backdrop-blur-2xl' : 'bg-black/80 backdrop-blur-xl border border-white/10')}
        style={{ transform: 'scale(0.95)', opacity: 0, animation: 'enter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
        <div className={"px-5 py-3 rounded-t-2xl border-b flex justify-between items-center " + (premium ? 'bg-white/70 backdrop-blur-md border border-white/30 shadow-sm' : 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300')}>
          <h3 className={"text-base font-semibold truncate pr-4 " + (premium ? 'text-slate-900' : 'text-slate-900')}>{title}</h3>
          <button onClick={() => generateContactosPdf(title, data)} disabled={isLoading || data.length === 0} className={premium ? "p-1.5 rounded-full text-slate-800 hover:text-slate-900 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" : "p-1.5 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"} title="Descargar en PDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
        </div>

        {/* Contenedor de contenido - Permite Scroll vertical y define una altura máxima */}
  <div className="p-5 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>
          ) : (
            <div className="flex flex-col">
              <div className="flex flex-col gap-3 mt-0">
                {paginatedData.map((persona, index) => (
                  // FILA DE DATOS: Solo Nombre y Teléfono
                  <div key={index} className="grid grid-cols-[1fr_140px] items-center gap-x-4 text-sm px-3 py-2 border-b border-white/10">
                    <span className="text-slate-200 truncate">{persona.nombre}</span>
                    <span className="text-slate-400 font-mono text-right">{persona.telefono || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/20 flex justify-between items-center">
          <button onClick={handlePrev} disabled={currentPage === 0} className="text-sm text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors">Anterior</button>
          <span className="text-xs text-slate-400">Página {currentPage + 1} de {totalPages > 0 ? totalPages : 1}</span>
          <button onClick={handleNext} disabled={currentPage >= totalPages - 1} className="text-sm text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors">Siguiente</button>
        </div>
      </div>
      <style jsx global>{` @keyframes enter { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } `}</style>
    </div>
  );
};

// ==============================================================================
// MODAL DE DETALLE DE SERVIDORES (Mantiene 3 columnas y Cédula centrada)
// ==============================================================================
const ServidoresDetalleModal = ({ isOpen, onClose, title, subTitle, data, isLoading, premium }: { isOpen: boolean; onClose: () => void; title: string; subTitle: string; data: ServidorDetalle[]; isLoading: boolean; premium?: boolean; }) => { 
  if (!isOpen) return null; 

  const containerClasses = premium
    ? 'relative z-10 w-full max-w-lg rounded-2xl text-white shadow-2xl bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-black/60 border border-white/10 backdrop-blur-2xl'
    : 'relative z-10 w-full max-w-lg bg-black rounded-2xl shadow-2xl text-white border border-slate-700/80';

  const headerClasses = premium
    ? 'px-5 py-3 rounded-t-2xl border-b border-white/10 bg-white/95 shadow-sm sticky top-0 z-20'
    : 'px-5 py-3 bg-gradient-to-b from-slate-200 to-slate-300 rounded-t-2xl border-b border-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out animate-fadeIn" onClick={onClose} />
      {/* Contenedor principal con max-w-lg */}
      <div className={containerClasses} style={{ transform: 'scale(0.95)', opacity: 0, animation: 'enter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
        <div className={headerClasses}>
          {/* Premium header: fondo blanco con texto oscuro, esquina redondeada superior preservada */}
          <h2 className={premium ? 'text-lg font-bold text-slate-900' : 'text-lg font-bold text-slate-800'}>{title}</h2>
          <p className={premium ? 'text-sm text-slate-700 font-medium' : 'text-sm text-slate-600 font-medium'}>{subTitle}</p>
        </div>

        {/* Contenedor de contenido - Permite Scroll vertical y define una altura máxima */}
        <div className="p-1 sm:p-3 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px] text-slate-400">Cargando servidores...</div>
          ) : (
            <div className="flex flex-col">
              {/* ENCABEZADO: responsive - mobile: 2 columnas (Nombre, Cédula). md+: 3 columnas (Nombre, Cédula, Teléfono) */}
              <div className="grid grid-cols-[1fr_120px] md:grid-cols-[1fr_120px_140px] gap-x-4 px-3 py-2 border-b border-white/20 sticky top-0 z-10" style={{ background: premium ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' : undefined }}>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[0.65rem]">Nombre</span>
                {/* Cédula centrada */}
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[0.65rem] text-center">Cédula</span>
                {/* Teléfono sólo visible en md+ */}
                <span className="hidden md:block font-semibold text-slate-400 uppercase tracking-wider text-[0.65rem] text-right">Teléfono</span>
              </div>

              {data.map((servidor, index) => (
                // FILA DE DATOS - responsive: hide phone column on small screens
                <div key={index} className="grid grid-cols-[1fr_120px] md:grid-cols-[1fr_120px_140px] items-center gap-x-4 text-sm px-3 py-3 border-b border-white/10">
                  <span className="text-slate-200 truncate font-medium">{servidor.nombre}</span>
                  {/* Cédula alineada al centro */}
                  <span className="text-slate-400 font-mono text-center">{servidor.cedula}</span>
                  {/* Teléfono alineado a la derecha - hidden on small screens */}
                  <span className="hidden md:block text-slate-400 font-mono text-right">{servidor.telefono || 'N/A'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style jsx global>{` @keyframes enter { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-fadeIn { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } `}</style>
    </div>
  );
};


// Componentes y tipos para agrupamiento (Contactos)
interface ContactGroup {
  key: string;
  etapa: string;
  modulo: number;
  items: BarChartData[];
  // Se agregan estas propiedades para evitar el error de asignación con ServerGroup
  role: string; 
  dia: string;
}

// -------------------------------------------------------------
// COMPONENTE 1: MinimalistContactCard (Contactos Activos)
// -------------------------------------------------------------
const MinimalistContactCard = ({
  data,
  title,
  onRowClick,
  onPdfClick,
  loadingPdfKey
}: {
  data: BarChartData[];
  title: string;
  onRowClick: (key: string) => void;
  onPdfClick: (key: string) => void;
  loadingPdfKey: string | null;
}) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    const newWidths: Record<string, number> = {};
    data.forEach(d => { newWidths[d.key] = (d.value / maxValue) * 100; });
    const id = requestAnimationFrame(() => setWidths(newWidths));
    return () => cancelAnimationFrame(id);
  }, [data, maxValue]);

  if (!data || data.length === 0) {
    return <p className="text-center text-slate-500 py-8">No hay datos para mostrar.</p>;
  }

  // 1. Agrupar la data por Etapa y Módulo para obtener los títulos de tarjeta (Semillas 1, Semillas 2...)
  const groups: ContactGroup[] = data.reduce((acc, row) => {
    const parsed = parseContactoKey(row.key);
    if (!parsed) return acc;
    const groupKey = `${parsed.etapa} ${parsed.modulo}`;
    
    // Inicialización corregida para cumplir con la interfaz ContactGroup (y evitar el error ServerGroup)
    let group = acc.find(g => g.key === groupKey);
    if (!group) {
      group = { 
        key: groupKey, 
        etapa: parsed.etapa, 
        modulo: parsed.modulo, 
        items: [],
        role: 'Contacto', // Propiedad añadida para cumplir la interfaz
        dia: '' // Propiedad añadida para cumplir la interfaz
      };
      acc.push(group);
    }
    group.items.push(row);
    return acc;
  }, [] as ContactGroup[]).sort((a, b) => {
    const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3 };
    const orderA = etapaOrder[a.etapa] || 99;
    const orderB = etapaOrder[b.etapa] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.modulo - b.modulo;
  });
  
  // Agrupar los grupos en filas de 2 (chunking)
  const chunkedGroups: ContactGroup[][] = [];
  for (let i = 0; i < groups.length; i += 2) {
    chunkedGroups.push(groups.slice(i, i + 2));
  }


  // Degradados de color CLAROS y FRESCOS (Estilo Mac Premium - Replicado de GroupedStyledList)
  const premiumLightGradients = [
    "linear-gradient(90deg, #93c5fd, #a5b4fc)", // Blue/Lavender
    "linear-gradient(90deg, #a7f3d0, #6ee7b7)", // Mint/Aqua
    "linear-gradient(90deg, #fbcfe8, #f0abfc)", // Pink/Fuchsia
    "linear-gradient(90deg, #fde68a, #fcd34d)", // Yellow/Amber
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Mapear las filas de 2 grupos */}
      {chunkedGroups.map((rowOfGroups, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rowOfGroups.map((group) => {
            const groupTotal = group.items.reduce((sum, item) => sum + item.value, 0); // Calcular total del grupo

            return (
              // Estilo de tarjeta Mac (Glassmorphism premium)
              <div key={group.key} className="p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 ring-1 ring-white/8 shadow-lg shadow-black/20 transition-all duration-300 hover:shadow-black/25">
                
                {/* Título de la Tarjeta (Ej: Semillas 1) con Círculo Premium de Total */}
                <div className="flex justify-between items-center border-b border-white/6 pb-2 mb-3">
                  <h3 className="text-lg font-bold text-slate-800">
                    {group.key}
                  </h3>
                  {/* Círculo Premium (Estilo Mac Neumorphism/Glassmorphism para el total) */}
                  <div 
                    className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-extrabold text-slate-700 tabular-nums"
                    style={{
                      background: 'linear-gradient(145deg, #e6e6e6, #ffffff)',
                      boxShadow: '4px 4px 8px #cccccc, -4px -4px 8px #ffffff',
                      color: '#475569', // text-slate-600
                      fontWeight: 'bold'
                    }}
                  >
                    {groupTotal}
                  </div>
                </div>

                {/* CONTENEDOR PRINCIPAL: Días/Barras dentro de UNA tarjeta */}
                <div className="flex flex-row space-x-3 items-center">
                  {group.items.map((row, i) => {
                    const parsed = parseContactoKey(row.key)!;
                    const currentPdfKey = row.key;
                    // Mapear el índice local (i) al índice de degradado para alternar colores
                    const barGradient = premiumLightGradients[i % premiumLightGradients.length]; 
                    const isVirtual = parsed.dia.toLowerCase() === 'virtual';

                    return (
                      // Mini-Card o Grupo de 3 elementos (Día, Barra/Valor, Iconos)
                      <div key={row.key} className="flex-1 min-w-0 flex flex-col space-y-1 items-center">
                        
                        {/* Etiqueta del Día (Arriba) */}
                        <span className={`text-xs font-semibold ${isVirtual ? 'text-violet-600' : 'text-slate-600'} truncate uppercase`}>
                          {parsed.dia}
                        </span>
                        
                        {/* Barra de Progreso (Abajo, elemento más grande) */}
                        <div className="relative h-5 w-full bg-slate-200/70 rounded-full overflow-hidden flex items-center shadow-inner shadow-black/10">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full`}
                            style={{ 
                              width: `${widths[row.key] || 0}%`, 
                              background: barGradient, // Aplicar degradado claro
                              transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' 
                            }}
                          />
                          {/* Valor de Contactos */}
                          <span className="absolute right-2 font-extrabold text-white text-sm tabular-nums" style={{ textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)' }}>
                              {row.value}
                          </span>
                        </div>
                        
                        {/* Íconos de Acción */}
                        <div className="flex items-center justify-center space-x-1 w-full mt-1">
                          {/* Icono de Lupa (Consultar detalles) */}
                          <button onClick={() => onRowClick(row.key)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Consultar detalles">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </button>
                          {/* Icono de PDF (Descargar) */}
                          {onPdfClick && (loadingPdfKey === currentPdfKey ? (
                            <div className="w-4 h-4 flex items-center justify-center">
                              <svg className="animate-spin h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                          ) : (
                            <button onClick={() => onPdfClick(row.key)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Descargar PDF">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex justify-end pt-3 pr-2 text-lg font-bold text-slate-800 border-t border-slate-200 mt-4">
        {title}: <span className="tabular-nums ml-2">{total}</span>
      </div>
    </div>
  );
};

// Se mantiene GroupedStyledList (Servidores) para el otro panel.
interface ServerGroup {
  key: string;
  role: string;
  etapa: string;
  items: BarChartData[];
}

// -------------------------------------------------------------
// COMPONENTE 2: GroupedStyledList (Coordinadores/Timoteos)
// Incluye el estilo 'Mac 2025 Premium Light Bars'
// -------------------------------------------------------------
const GroupedStyledList = ({
  data,
  baseTitle, // Ej: "Total de Coordinadores"
  rolePrefix, // Ej: 'Maestros -'
  onRowClick,
  onPdfClick,
  loadingPdfKey
}: {
  data: BarChartData[];
  baseTitle: string;
  rolePrefix: string;
  onRowClick: (key: string) => void;
  onPdfClick: (key: string) => void;
  loadingPdfKey: string | null;
}) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    const newWidths: Record<string, number> = {};
    data.forEach(d => { newWidths[d.key] = (d.value / maxValue) * 100; });
    const id = requestAnimationFrame(() => setWidths(newWidths));
    return () => cancelAnimationFrame(id);
  }, [data, maxValue]);

  if (!data || data.length === 0) {
    return <p className="text-center text-slate-500 py-8">No hay datos para mostrar.</p>;
  }

  // 1. Group data by Etapa (ej: Semillas 1)
  const groups: ServerGroup[] = data.reduce((acc, row) => {
    const keyWithoutRole = normalizeWs(row.key.replace(rolePrefix, ''));
    
    const matchSimple = keyWithoutRole.match(/^(.+?)\s*\(([^)]+)\)\s*$/); 
    const matchModulo = keyWithoutRole.match(/^(.+?)\s+(\d+)\s*\(([^)]+)\)\s*$/); 

    let etapaName = keyWithoutRole; 
    if (matchModulo) {
        etapaName = normalizeWs(`${matchModulo[1]} ${matchModulo[2]}`);
    } else if (matchSimple) {
        const parts = matchSimple[1].split(' ');
        etapaName = parts.length > 1 ? parts.slice(0, 2).join(' ') : matchSimple[1];
    }
    
    const groupKey = etapaName;
    let group = acc.find(g => g.key === groupKey);
    
    if (!group) {
      group = { key: groupKey, role: rolePrefix.replace(' -', ''), etapa: etapaName, items: [] };
      acc.push(group);
    }
    group.items.push(row);
    return acc;
  }, [] as ServerGroup[]).sort((a, b) => {
    const aKey = a.key;
    const bKey = b.key;
    const aParsed = parseSortKey(aKey);
    const bParsed = parseSortKey(bKey);
    const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 };
    const orderA = etapaOrder[aParsed.etapa] || 99;
    const orderB = etapaOrder[bParsed.etapa] || 99;
    if (orderA !== orderB) { return orderA - orderB; }
    if (aParsed.modulo !== bParsed.modulo) { return aParsed.modulo - bParsed.modulo; }
    return aKey.localeCompare(bKey);
  });

  // Degradados de color CLAROS y FRESCOS (Estilo Mac Premium)
  const premiumLightGradients = [
    "linear-gradient(90deg, #93c5fd, #a5b4fc)", // Blue/Lavender
    "linear-gradient(90deg, #a7f3d0, #6ee7b7)", // Mint/Aqua
    "linear-gradient(90deg, #fbcfe8, #f0abfc)", // Pink/Fuchsia
    "linear-gradient(90deg, #fde68a, #fcd34d)", // Yellow/Amber
  ];

  return (
    <div className="flex flex-col gap-4 w-full"> 
      {groups.map((group, groupIndex) => (
        // Contenedor de Grupo: Glassmorphism más claro y premium
        <div key={group.key} className="bg-white/80 backdrop-blur-xl rounded-2xl ring-1 ring-white/70 shadow-2xl shadow-slate-300/60 transition-all duration-300 hover:shadow-slate-400/70 overflow-hidden">
          
          {/* Encabezado del Grupo (Etapa y Módulo) - Estilo limpio y fresco */}
          <div className="px-4 py-3 text-slate-800 font-extrabold text-lg border-b border-slate-200/80 bg-slate-100/50">
            {group.key}
          </div>

          <div className="flex flex-col divide-y divide-slate-200/50 p-3">
            {group.items.map((row, i) => {
              const parsedServidor = parseServidorKey(row.key)!;
              const keyWithoutRole = normalizeWs(row.key.replace(rolePrefix, ''));
              const parsedKey = parseContactoKey(keyWithoutRole) || parseSortKey(keyWithoutRole);
              
              // Usar degradados claros y rotarlos por índice de ítem
              const barGradient = premiumLightGradients[i % premiumLightGradients.length]; 
              const currentPdfKey = row.key;
              
              const diaDisplay = parsedKey.dia ? `${parsedKey.dia}` : '';

              return (
                <div key={row.key} className="grid grid-cols-[3fr_1.5fr_auto] items-center gap-x-3 py-2 text-sm">
                  {/* Día/Rol */}
                  <div className="font-medium text-slate-700 truncate" title={`${parsedServidor.rol} (${diaDisplay})`}>
                    <span className="text-slate-500 font-normal">{diaDisplay}</span>
                  </div>
                  
                  {/* Distribución/Barra - Más alta (h-5) y con shadow-inner para efecto 3D Mac */}
                  <div className="relative h-5 w-full bg-slate-200/70 rounded-full overflow-hidden flex items-center justify-end pr-1 shadow-inner shadow-black/10">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full`}
                      style={{ 
                        width: `${widths[row.key] || 0}%`, 
                        background: barGradient,
                        transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' 
                      }}
                    />
                    {/* Número con sombra de texto para que resalte sobre el degradado claro */}
                    <span className="absolute right-2 font-extrabold text-white text-sm tabular-nums" style={{ textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)' }}>
                      {row.value}
                    </span>
                  </div>
                  
                  {/* Acciones */}
                  <div className="flex items-center justify-end space-x-1 w-[40px]">
                    <button onClick={() => onRowClick(row.key)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-50" title="Consultar detalles">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </button>
                    {onPdfClick && (loadingPdfKey === currentPdfKey ? (
                      <div className="w-5 h-5 flex items-center justify-center">
                        <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      </div>
                    ) : (
                      <button onClick={() => onPdfClick(row.key)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50" title="Descargar PDF">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end pt-3 pr-2 text-lg font-bold text-slate-800 border-t border-slate-200 mt-4">
        {baseTitle}: <span className="tabular-nums ml-2">{total}</span>
      </div>
    </div>
  );
};


/* ========================= Componente principal ========================= */
export default function DetalleSecciones({
  asistEtapas,
  agendados = [],
  asistPorModulo = [],
  contactosPorEtapaDia = [],
  servidoresPorRolEtapaDia = [],
  defaultKey,
  range = 'month',
}: DetalleSeccionesProps) {
  const [view, setView] = useState<string | null>(defaultKey || null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIsLoading, setModalIsLoading] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; data: Persona[]; premium?: boolean }>({ title: '', data: [] });
  const [servidoresModalOpen, setServidoresModalOpen] = useState(false);
  const [servidoresModalIsLoading, setServidoresModalIsLoading] = useState(false);
  const [servidoresModalContent, setServidoresModalContent] = useState<{ title: string; subTitle: string; data: ServidorDetalle[]; premium?: boolean }>({ title: '', subTitle: '', data: [] });
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);

  const handleContactRowClick = async (key: string) => {
    const parsed = parseContactoKey(key);
    if (!parsed) {
      console.error("Invalid contact key format:", key);
      return;
    }

    const { etapa, modulo, dia } = parsed;
    const title = `Contactos de ${normalizeWs(key)}`;

    // Abrir modal y marcar premium para usar el mismo fondo que el modal de servidores
    setModalOpen(true);
    setModalIsLoading(true);
    setModalContent({ title, data: [], premium: true });

    try {
      const personas = await getContactosPorFiltro(etapa, modulo, dia);
      setModalContent({ title, data: personas, premium: true });
    } catch (error) {
      console.error("Error fetching contact details:", error);
      setModalContent(prev => ({ ...prev, title: `Error al cargar ${normalizeWs(key)}`, premium: true }));
    } finally {
      setModalIsLoading(false);
    }
  };
  const handleContactPdfDownload = async (key: string) => { setPdfLoadingKey(key); try { const parsed = parseContactoKey(key); if (!parsed) throw new Error("Invalid contact key"); const { etapa, modulo, dia } = parsed; const personas = await getContactosPorFiltro(etapa, modulo, dia); generateContactosPdf(`Contactos de ${normalizeWs(key)}`, personas); } catch (error) { console.error("Error generating contact PDF:", error); } finally { setPdfLoadingKey(null); } };
  
  // 
  // 2. NUEVOS HANDLERS AÑADIDOS
  //
  const handleActivosRowClick = async (key: string) => {
    const parsed = parseContactoKey(key);
    if (!parsed) {
      console.error("Invalid contact key format:", key);
      return;
    }

    const { etapa, modulo, dia } = parsed;
    const title = `Contactos de ${normalizeWs(key)}`;

    // Abrir modal y marcar premium para usar el mismo fondo que el modal de servidores
    setModalOpen(true);
    setModalIsLoading(true);
    setModalContent({ title, data: [], premium: true });

    try {
      // LLAMADA A LA NUEVA FUNCIÓN
      const personas = await getActivosPorFiltro(etapa, modulo, dia);
      setModalContent({ title, data: personas, premium: true });
    } catch (error) {
      console.error("Error fetching active contact details:", error);
      setModalContent(prev => ({ ...prev, title: `Error al cargar ${normalizeWs(key)}`, premium: true }));
    } finally {
      setModalIsLoading(false);
    }
  };

  const handleActivosPdfDownload = async (key: string) => { 
    setPdfLoadingKey(key); 
    try { 
      const parsed = parseContactoKey(key); 
      if (!parsed) throw new Error("Invalid contact key"); 
      const { etapa, modulo, dia } = parsed; 
      // LLAMADA A LA NUEVA FUNCIÓN
      const personas = await getActivosPorFiltro(etapa, modulo, dia); 
      generateContactosPdf(`Contactos de ${normalizeWs(key)}`, personas); 
    } catch (error) { 
      console.error("Error generating active contact PDF:", error); 
    } finally { 
      setPdfLoadingKey(null); 
    } 
  };
  
  const handleServidorRowClick = async (key: string) => { const parsed = parseServidorKey(key); if (!parsed) { console.error("Invalid server key:", key); return; } const { rol, etapa, dia } = parsed; const titleMapping: { [key: string]: string } = { 'Maestros': 'Coordinadores', 'Contactos': 'Timoteos' }; const modalTitle = titleMapping[rol] || rol; setServidoresModalOpen(true); setServidoresModalIsLoading(true); // marcar premium=true cuando se abre desde el listado de servidores
    setServidoresModalContent({ title: modalTitle, subTitle: `de ${etapa} (${dia})`, data: [], premium: true });
    try { const servidores = await getServidoresPorFiltro(rol, etapa, dia); setServidoresModalContent(prev => ({ ...prev, data: servidores, premium: true })); } catch (error) { console.error("Error fetching server details:", error); setServidoresModalContent(prev => ({ ...prev, subTitle: 'Error al cargar los datos', premium: true })); } finally { setServidoresModalIsLoading(false); } };
  const handleServidorPdfDownload = async (key: string) => { setPdfLoadingKey(key); try { const parsed = parseServidorKey(key); if (!parsed) { throw new Error("Invalid server key"); } const { rol, etapa, dia } = parsed; const titleMapping: { [key: string]: string } = { 'Maestros': 'Coordinadores', 'Contactos': 'Timoteos' }; const pdfTitle = titleMapping[rol] || rol; const pdfSubTitle = `de ${etapa} (${dia})`; const servidores = await getServidoresPorFiltro(rol, etapa, dia); generateServidoresPdf(pdfTitle, pdfSubTitle, servidores); } catch (error) { console.error("Error generating server PDF:", error); } finally { setPdfLoadingKey(null); } };

  const handleAsistenciaDetalleClick = async (item: AsistBarData) => {
    const { etapa, modulo, dia, asistio } = item;
    const title = `${asistio ? 'Asistentes' : 'Inasistentes'} de ${etiquetaEtapaModulo(etapa, modulo, dia)}`;
    setModalOpen(true);
    setModalIsLoading(true);
    // marcar premium true cuando se abre desde el panel de Asistencias
    setModalContent({ title, data: [], premium: true });
    try {
      const personas = await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio);
      setModalContent({ title, data: personas, premium: true });
    } catch (error) {
      console.error("Error fetching attendance details:", error);
      setModalContent(prev => ({ ...prev, title: `Error al cargar ${etapa}`, premium: true }));
    } finally {
      setModalIsLoading(false);
    }
  };

  const handleAsistenciaPdfClick = async (item: AsistBarData) => {
    const { etapa, modulo, dia, asistio } = item;
    const loadingKey = `${etapa}-${modulo}-${dia}-${asistio}`;
    setPdfLoadingKey(loadingKey);
    try {
      const title = `${asistio ? 'Asistentes' : 'Inasistentes'} de ${etiquetaEtapaModulo(etapa, modulo, dia)}`;
  const personas = await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio);
      generateContactosPdf(title, personas);
    } catch (error) {
      console.error(`Error generating PDF for ${etapa}:`, error);
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const totalConfirmados = asistEtapas.reduce((s, r) => s + (r.confirmados || 0), 0);
  const totalNoAsistieron = asistEtapas.reduce((s, r) => s + (r.noAsistieron || 0), 0);
  const totalAsist = totalConfirmados + totalNoAsistieron;
  const dataAsist = [ { name: "Asistieron", value: totalConfirmados, color: "url(#gradOk)" }, { name: "No asistieron", value: totalNoAsistieron, color: "url(#gradNo)" }, ];
  const pct = (v: number, base: number) => (base > 0 ? ((v / base) * 100).toFixed(1) : "0");
  const pctOk = pct(totalConfirmados, totalAsist);
  const pctNo = pct(totalNoAsistieron, totalAsist);
  const totalAgend = agendados.reduce((s, r) => s + (r.agendados_pendientes || 0), 0);
  
  // SEPARACIÓN DE DATOS: Asistencias e Inasistencias
  const asistenciasChartData = asistPorModulo.filter(m => (m.confirmados || 0) > 0).map(m => ({
    label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia),
    value: m.confirmados,
    type: 'asistencia' as const,
    etapa: m.etapa,
    modulo: m.modulo,
    dia: m.dia,
    asistio: true
  }));

  const inasistenciasPorModulo = asistPorModulo.filter(m => (m.noAsistieron || 0) > 0).map(m => ({
    label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia),
    value: m.noAsistieron,
    type: 'inasistencia' as const,
    etapa: m.etapa,
    modulo: m.modulo,
    dia: m.dia,
    asistio: false
  }));

  const totalInasist = asistPorModulo.reduce((s, r) => s + (r.noAsistieron || 0), 0);

  const inasistenciasChartData: AsistBarData[] = [
    ...inasistenciasPorModulo,
    {
      label: 'Inasistencias Total', // Etiqueta clara para el total
      value: totalInasist,
      type: 'inasistencia' as const,
      etapa: 'General',
      modulo: 0,
      dia: '',
      asistio: false
    }
  ].filter(item => item.value > 0);


  const inasistChips = asistPorModulo.filter((m) => (m.noAsistieron || 0) > 0).map((m) => ({ etapa: m.etapa, label: `${etiquetaEtapaModulo(m.etapa, m.modulo, m.dia)}`, value: m.noAsistieron, color: colorPorEtapa(m.etapa), })).sort((a, b) => b.value - a.value);
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }>; }) => { if (active && payload && payload.length) { const { name, value } = payload[0]; const base = view === "agendados" ? totalAgend : totalAsist; return ( <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-[12px] ring-1 ring-black/10"> <p className="font-semibold text-slate-800">{name}</p> <p className="tabular-nums text-slate-700"> {value} <span className="text-slate-500">({pct(value, base)}%)</span> </p> </div> ); } return null; };
  
  useEffect(() => { const handler = (e: MouseEvent) => { const target = (e.target as HTMLElement).closest("[data-key]"); if (target) setView(target.getAttribute("data-key")); }; document.addEventListener("click", handler); return () => document.removeEventListener("click", handler); }, []);
  const [animatedTotal, setAnimatedTotal] = useState(0);
  useEffect(() => { const target = view === "agendados" ? totalAgend : totalAsist; let raf = 0; const start = performance.now(); const dur = 800; const tick = (now: number) => { const t = Math.min((now - start) / dur, 1); setAnimatedTotal(Math.round(target * t)); if (t < 1) raf = requestAnimationFrame(tick); }; requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [view, totalAsist, totalAgend]);

  
  const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 };
  const genericSort = (a: BarChartData, b: BarChartData, keyPrefix: string) => { const aKey = normalizeWs(a.key.replace(keyPrefix, '')); const bKey = normalizeWs(b.key.replace(keyPrefix, '')); const aParsed = parseSortKey(aKey); const bParsed = parseSortKey(bKey); const etapaOrderA = etapaOrder[aParsed.etapa] || 99; const etapaOrderB = etapaOrder[bParsed.etapa] || 99; if (etapaOrderA !== etapaOrderB) { return etapaOrderA - etapaOrderB; } if (aParsed.modulo !== bParsed.modulo) { return aParsed.modulo - bParsed.modulo; } return aKey.localeCompare(bKey); };
  const maestrosData = servidoresPorRolEtapaDia.filter(d => d.key.startsWith('Maestros')).sort((a,b) => genericSort(a,b, 'Maestros -'));
  const timoteosData = servidoresPorRolEtapaDia.filter(d => d.key.startsWith('Contactos')).sort((a,b) => genericSort(a,b, 'Contactos -'));
  const sortedContactosData = [...contactosPorEtapaDia].sort((a,b) => genericSort(a,b, ''));

  return (
    <>
      {/* Ajuste la clase `asistencias-container` a un grid de 2 columnas principales (1fr para resumen, 1fr para detalles) */}
      <style jsx>{`.agendados-container, .asistencias-container, .contactos-container, .servidores-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; align-items: start; } @media (min-width: 1024px) { .servidores-container { grid-template-columns: 1fr 1fr; } .asistencias-container { grid-template-columns: 1fr 1fr; gap: 0.75rem; } }`}</style>
  <ContactosDetalleModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalContent.title} data={modalContent.data} isLoading={modalIsLoading} premium={modalContent.premium} />
  <ServidoresDetalleModal isOpen={servidoresModalOpen} onClose={() => setServidoresModalOpen(false)} title={servidoresModalContent.title} subTitle={servidoresModalContent.subTitle} data={servidoresModalContent.data} isLoading={servidoresModalIsLoading} premium={servidoresModalContent.premium} />
      <div className="overflow-visible mt-6">
        {!view && ( <div className="grid premium-grid"><section className="card span-2 animate-fadeIn premium-glass p-4"><h2 className="card-title">Bienvenido</h2><p className="text-muted">Selecciona una tarjeta KPI para ver detalles.</p></section></div> )}
        
        {view === "asistencias" && (
          // CONTENEDOR PRINCIPAL DE LA VISTA ASISTENCIAS (Grid de 2 columnas)
          <div className="asistencias-container">
            
            {/* COLUMNA IZQUIERDA: GRÁFICO DONUT + TABLA RESUMEN POR ETAPA (Consolidado) */}
            <section className="card premium-glass animate-slideIn flex flex-col overflow-hidden self-stretch">
                <div className="px-4 py-3 border-b border-slate-200/80 flex-shrink-0">
                    <h2 className="text-base font-semibold text-slate-700">Resumen General y Etapas</h2>
                </div>
                
                {/* Contenedor del Donut y Porcentajes */}
                <div className="panel-body px-1 py-2 flex-shrink-0">
                    <div className="relative mx-auto max-w-[150px] aspect-square overflow-hidden flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart><defs><linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN_LIGHT} /><stop offset="100%" stopColor={GREEN} /></linearGradient><linearGradient id="gradNo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RED_LIGHT} /><stop offset="100%" stopColor={RED} /></linearGradient></defs><Pie data={dataAsist} dataKey="value" innerRadius="55%" outerRadius="82%" startAngle={90} endAngle={-270} paddingAngle={0} cornerRadius={12} isAnimationActive animationBegin={100} animationDuration={900} animationEasing="ease-out">{dataAsist.map((d, i) => (<Cell key={i} fill={d.color} stroke="#ffffff" strokeWidth={3} />))}</Pie><Tooltip content={<CustomTooltip />} /></PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-1">
                            <p className="text-xl leading-tight font-extrabold text-gray-900 tabular-nums">{animatedTotal.toLocaleString()}</p>
                            <p className="text-gray-500 text-xs mt-0.5">Total</p>
                        </div>
                    </div>
                    <div className="flex justify-between w-full px-2 mt-2 text-xs">
                        <div className="flex flex-col items-center text-green-600 font-semibold"><span>Asistieron</span><span className="font-bold tabular-nums">{pctOk}%</span></div>
                        <div className="flex flex-col items-center text-red-600 font-semibold"><span>No asistieron</span><span className="font-bold tabular-nums">{pctNo}%</span></div>
                    </div>
                </div>

                {/* Tabla Resumen por Etapa (Debajo del Donut) */}
                <div className="px-4 py-3 border-t border-slate-200/80 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-slate-700 px-1 mb-2">Resumen por Etapa</h3>
                </div>
                <div className="panel-body p-3 flex-grow overflow-y-auto">
                    <div className="premium-table-row premium-table-header">
                        <span>ETAPA</span>
                        <span className="text-center">ASIST.</span>
                        <span className="text-center">INAS.</span>
                        <span className="text-right">TOTAL</span>
                    </div>
                    {asistEtapas.map((row, i) => (
                        <div key={i} className="premium-table-row premium-table-item">
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


            {/* COLUMNA DERECHA: Detalle de Asistencias e Inasistencias (Agrupados Verticalmente) */}
            <section className="flex flex-col space-y-4 self-stretch">
                
                {/* 1. Detalle por Módulo (Asistencias) */}
                <div className="card premium-glass animate-slideIn flex flex-col overflow-hidden flex-grow">
                    <div className="px-4 py-3 border-b border-slate-200/80 flex-shrink-0"><h2 className="text-base font-semibold text-slate-700">Detalle por Módulo (Asist.)</h2></div>
                    <div className="panel-body p-3 flex-grow overflow-y-auto">
                      <AsistenciasHorizontalBars 
                        data={asistenciasChartData}
                        onDetalleClick={handleAsistenciaDetalleClick}
                        onPdfClick={handleAsistenciaPdfClick}
                        loadingPdfKey={pdfLoadingKey}
                      />
                    </div>
                </div>

                {/* 2. Reporte Detallado de Inasistencias */}
                <div className="card premium-glass animate-slideIn flex flex-col overflow-hidden flex-grow">
                    <div className="px-4 py-3 border-b border-rose-200/80 bg-rose-50/50 flex-shrink-0"><h2 className="text-base font-semibold text-rose-700">Reporte Detallado de Inasistencias</h2></div>
                    <div className="panel-body p-3 flex-grow overflow-y-auto">
                      <InasistenciasPanel
                        data={inasistenciasChartData}
                        onDetalleClick={handleAsistenciaDetalleClick}
                        onPdfClick={handleAsistenciaPdfClick}
                        loadingPdfKey={pdfLoadingKey}
                      />
                    </div>
                </div>
            </section>
          </div>
        )}

        {view === "agendados" && (
          <div className="agendados-container">
            <section className="agendados-grafico card premium-glass animate-slideIn p-4"><div className="card-head flex justify-between items-center"><h2 className="card-title">Agendados por semana</h2><div className="text-right chart-meta"><p className="card-meta-label text-lg font-semibold">Total agendados</p><p className="card-meta-value tabular-nums">{totalAgend.toLocaleString()}</p></div></div><div className="panel-body py-2 px-4"><PremiumHorizontalBars data={agendados} onRowClick={handleContactRowClick} onPdfClick={handleContactPdfDownload} loadingPdfKey={pdfLoadingKey} /></div></section>
            <section className="agendados-detalle card premium-glass animate-slideIn p-4"><div className="card-head pb-0"><h2 className="card-title">Detalle por etapa/módulo</h2></div><div className="panel-body px-0 py-0"><div className="premium-table-row premium-table-header two-cols"><span>Etapa · Módulo</span><span className="text-right">Agendados</span></div>{agendados.map((row, i) => (<div key={i} className="premium-table-row premium-table-item two-cols"><span className="font-medium text-slate-700">{row.etapa_modulo}</span><span className="text-right font-semibold text-gray-800 tabular-nums">{row.agendados_pendientes}</span></div>))}<div className="premium-table-row premium-table-total two-cols"><span>Total</span><span className="text-right tabular-nums">{totalAgend}</span></div></div></section>
          </div>
        )}
        
        {view === "contactos" && (
          <div className="contactos-container animate-slideIn justify-center">
            <div className="w-full lg:max-w-4xl xl:max-w-6xl">
              <section className="card premium-glass self-start flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Contactos Activos</h2></div>
                <div className="panel-body p-5">
                  <MinimalistContactCard 
                    data={sortedContactosData} 
                    title="Total de Contactos Activos"
                    //
                    // 3. HANDLERS ACTUALIZADOS
                    //
                    onRowClick={handleActivosRowClick} 
                    onPdfClick={handleActivosPdfDownload} 
                    loadingPdfKey={pdfLoadingKey} 
                  />
                </div>
              </section>
            </div>
          </div>
        )}
        
        {view === "servidores" && (
          <div className="servidores-container animate-slideIn">
            <section className="card premium-glass self-start flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Coordinadores</h2></div>
              <div className="panel-body p-4">
                <GroupedStyledList 
                  data={maestrosData} 
                  baseTitle="Total de Coordinadores" 
                  rolePrefix="Maestros -"
                  onRowClick={handleServidorRowClick} 
                  onPdfClick={handleServidorPdfDownload} 
                  loadingPdfKey={pdfLoadingKey} 
                />
              </div>
            </section>
            <section className="card premium-glass self-start flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Timoteos</h2></div>
              <div className="panel-body p-4">
                <GroupedStyledList 
                  data={timoteosData} 
                  baseTitle="Total de Timoteos" 
                  rolePrefix="Contactos -"
                  onRowClick={handleServidorRowClick} 
                  onPdfClick={handleServidorPdfDownload} 
                  loadingPdfKey={pdfLoadingKey} 
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}