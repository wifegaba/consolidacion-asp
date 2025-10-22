// src/app/panel/DetalleSecciones.tsx
"use client";

import React, { useEffect, useState } from "react";
// 1. Import 'dynamic' from next/dynamic
import dynamic from 'next/dynamic';
import { 
  // PieChart ahora se importará dinámicamente
  // PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip
} from "recharts"; 
import { 
  getContactosPorFiltro, 
  getServidoresPorFiltro, 
  getAsistentesPorEtapaFiltro,
  getActivosPorFiltro
} from "@/app/actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Range } from "@/lib/metrics";

// 2. Importar PieChart dinámicamente SIN SSR
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), {
  ssr: false,
  // Placeholder mejorado: usa aspect-square para reservar espacio visualmente
  loading: () => <div className="w-full aspect-square flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">Cargando gráfico...</div> 
});


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

// Tipo para los datos del gráfico de dona (ahora incluye tipo Asist/Inasist)
type DonutSegmentData = {
  name: string; // Ej: "Semillas 1 Asist."
  baseName: string; // Ej: "Semillas 1" (para hover)
  etapa: string; // Ej: "Semillas" (para hover tabla inferior)
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
};

/* ============================ Constantes y Utils ============================ */

// 1. PALETA DE COLORES PREMIUM ("Mac 2025") - Colores base por Etapa
const ETAPA_BASE_COLORS: Record<string, string> = {
  Semillas: "#34d399",       // Verde Esmeralda
  Devocionales: "#a78bfa",   // Violeta
  Restauracion: "#60a5fa",   // Azul
  Consolidacion: "#14b8a6",  // Teal
  Discipulado: "#a3e635",     // Verde Lima
  Liderazgo: "#06b6d4",     // Cian
  Default: "#9ca3af",        // Gris
};

// Color fijo para Inasistencias
const INASISTENCIA_COLOR = "#ef4444"; // Rojo premium (#dc2626 era muy oscuro, este es más vibrante)

// Función para obtener variaciones de color premium (tipo Mac)
function lightenColor(hex: string, percent: number): string {
    hex = hex.replace(/^#/, '');
    // Asegurarse de que el hex tenga 6 dígitos
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
      console.warn("Invalid hex color for lightenColor:", hex);
      return ETAPA_BASE_COLORS.Default; // Devolver color por defecto si es inválido
    }
    
    try {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
    
        const newR = Math.min(255, Math.floor(r * (1 + percent / 100)));
        const newG = Math.min(255, Math.floor(g * (1 + percent / 100)));
        const newB = Math.min(255, Math.floor(b * (1 + percent / 100)));
    
        const rr = newR.toString(16).padStart(2, '0');
        const gg = newG.toString(16).padStart(2, '0');
        const bb = newB.toString(16).padStart(2, '0');
    
        return `#${rr}${gg}${bb}`;
    } catch (e) {
        console.error("Error processing hex color:", hex, e);
        return ETAPA_BASE_COLORS.Default; // Devolver color por defecto en caso de error
    }
}

// 2. FUNCIÓN PARA ASIGNAR COLORES A MÓDULOS (Asistencia)
function getColorForModulo(etapa: string, modulo: number): string {
  const baseColor = ETAPA_BASE_COLORS[etapa] || ETAPA_BASE_COLORS.Default;
  // Aplicar una ligera variación basada en el número del módulo para diferenciarlos
  // Módulos impares un poco más claros, pares el color base
  const variation = (modulo % 2 !== 0) ? 10 : 0; // Aclarar 10% para impares
  return lightenColor(baseColor, variation);
}


function etiquetaEtapaModulo(etapa: string, modulo: number, dia: string) { if (!etapa) return `Módulo ${modulo}`; const base = etapa.trim().split(/\s+/)[0]; const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase(); return `${nombre} ${modulo} (${dia})`; }

// (Resto de Utils sin cambios)
const normalizeWs = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
const parseContactoKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^(.+?)\s+(\d+)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { etapa: normalizeWs(m[1]), modulo: parseInt(m[2], 10), dia: normalizeWs(m[3]) }; };
const parseServidorKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^([^-\n]+)-\s*(.+?)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { rol: normalizeWs(m[1]), etapa: normalizeWs(m[2]), dia: normalizeWs(m[3]) }; };
const parseSortKey = (key: string) => { const k = normalizeWs(key); const match = k.match(/^(.+?)\s+(\d+)\s*\((.+)\)\s*$/); if (match) { const etapaNameParts = match[1].split(' '); const etapaName = etapaNameParts.length > 1 ? etapaNameParts.slice(0, -1).join(' ') : match[1]; return { etapa: etapaName, modulo: parseInt(match[2], 10), dia: match[3] }; } const simpleMatch = k.match(/(Semillas|Devocionales|Restauracion)\s+(\d+)/); if(simpleMatch) { return { etapa: simpleMatch[1], modulo: parseInt(simpleMatch[2], 10), dia: '' }; } return { etapa: k, modulo: 0, dia: '' }; };


const generateContactosPdf = (title: string, data: Persona[]) => { if (!data.length) return; const doc = new jsPDF(); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor("#ffffff"); doc.setFillColor(44, 62, 80); doc.rect(0, 0, 210, 25, "F"); doc.text(title, 105, 16, { align: "center" }); autoTable(doc, { startY: 35, head: [['Nombre', 'Teléfono']], body: data.map(p => [p.nombre, p.telefono || 'N/A']), theme: 'grid', headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' }, styles: { cellPadding: 3, fontSize: 10, valign: 'middle' }, alternateRowStyles: { fillColor: [245, 245, 245] }, }); const pageCount = (doc as any).internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' }); } const fileName = `${title.replace(/[^\w\s]/gi, '').replace(/ /g, '_')}.pdf`; doc.save(fileName); };
const generateServidoresPdf = (title: string, subTitle: string, data: ServidorDetalle[]) => { const personas: Persona[] = data.map(s => ({ nombre: `${s.nombre}${s.cedula ? ` — ${s.cedula}` : ''}`, telefono: s.telefono })); const fullTitle = subTitle ? `${title} ${subTitle}` : title; generateContactosPdf(fullTitle, personas); };


/* ====================== Componentes Internos ===================== */

// (PremiumHorizontalBars sin cambios)
interface AgendadoGroup { key: string; items: AgendadoRow[]; }
const PremiumHorizontalBars = ({ data, onRowClick, onPdfClick, loadingPdfKey }: { data: AgendadoRow[]; onRowClick: (key: string) => void; onPdfClick: (key: string) => void; loadingPdfKey: string | null; }) => { 
    const [widths, setWidths] = useState<Record<string, number>>({});
    const parsedData: (BarChartData & { etapa_modulo: string; dia: string })[] = data.map(d => { 
        const parts = d.etapa_modulo.split('(');
        const etapaModulo = normalizeWs(parts[0]);
        const dia = parts.length > 1 ? normalizeWs(parts[1].replace(')', '')) : '';
        return { key: d.etapa_modulo, value: d.agendados_pendientes, color: '#a78bfa', etapa_modulo: etapaModulo, dia };
     });
    const maxValue = Math.max(...parsedData.map(d => d.value), 0);
    const groups: AgendadoGroup[] = parsedData.reduce((acc, row) => { 
        const groupKey = row.etapa_modulo;
        let group = acc.find(g => g.key === groupKey);
        if (!group) { group = { key: groupKey, items: [] as AgendadoRow[] }; acc.push(group); }
        const original = data.find(d => d.etapa_modulo === row.key);
        if (original) group.items.push(original); return acc;
     }, [] as AgendadoGroup[]).sort((a, b) => a.key.localeCompare(b.key));
    const gradients = ["linear-gradient(90deg, #6366f1, #818cf8)", "linear-gradient(90deg, #10b981, #34d399)", "linear-gradient(90deg, #06b6d4, #22d3ee)"];
    useEffect(() => { 
        const newWidths: Record<string, number> = {};
        parsedData.forEach(d => { newWidths[d.key] = maxValue > 0 ? (d.value / maxValue) * 100 : 0; });
        const id = requestAnimationFrame(() => setWidths(newWidths)); return () => cancelAnimationFrame(id);
     }, [parsedData, maxValue]);
    if (!parsedData.length) return <p className="text-center text-slate-500 py-4">No hay agendados para mostrar.</p>;
    let gradientIndex = 0;
    return ( <div className="w-full h-full flex flex-col gap-1 py-1"> {groups.map((group) => ( <div key={group.key} className="space-y-2 py-1"> <h4 className="text-lg md:text-sm font-bold text-slate-700 ml-1">{group.key}</h4> {group.items.map((row) => { const parsed = parsedData.find(d => d.key === row.etapa_modulo)!; const barGradient = gradients[gradientIndex++ % gradients.length]; const currentKey = row.etapa_modulo; return ( <div key={row.etapa_modulo} className="flex flex-col sm:grid sm:grid-cols-[1.6fr_2fr_auto_auto] items-start gap-2 sm:gap-x-3 pl-3 py-2"> <div className={`w-full text-sm md:text-base text-left text-slate-600 whitespace-normal`} title={parsed.dia || row.etapa_modulo}>{parsed.dia || 'N/A'}</div> <div className="flex items-center w-full mt-1 sm:mt-0"> <div className="relative flex-1 h-6 w-full bg-slate-200/60 rounded-full overflow-hidden shadow-inner shadow-black/10"> <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: `${widths[currentKey] || 0}%`, background: barGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> </div> <div className="text-base font-semibold text-slate-700 tabular-nums ml-3 w-12 text-left">{row.agendados_pendientes}</div> <div className="flex items-center space-x-2 w-[52px] ml-2"> {row.agendados_pendientes > 0 && ( <> <button onClick={() => onRowClick(currentKey)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Consultar detalles"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {loadingPdfKey === currentKey ? ( <div className="w-5 h-5 flex items-center justify-center"> <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(currentKey)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> )} </> )} </div> </div> </div> ); })} </div> ))} </div> );
};


// (AsistenciasHorizontalBars sin cambios funcionales, solo prop renombrada)
interface AsistenciaGroup { key: string; items: AsistBarData[]; }
const AsistenciasHorizontalBars = ({ data, onDetalleClick, onPdfClick, loadingPdfKey, hoveredModuloKey }: {
  data: AsistBarData[];
  onDetalleClick: (item: AsistBarData) => void;
  onPdfClick: (item: AsistBarData) => void;
  loadingPdfKey: string | null;
  hoveredModuloKey: string | null; // Prop renombrada
}) => {
    const [widths, setWidths] = useState<Record<string, number>>({});
    const asistencias = data.filter(d => d.type === 'asistencia');
    const groups: AsistenciaGroup[] = asistencias.reduce((acc, row) => { 
        const groupKey = `${row.etapa} ${row.modulo}`;
        let group = acc.find(g => g.key === groupKey);
        if (!group) { group = { key: groupKey, items: [] }; acc.push(group); }
        group.items.push(row); return acc;
     }, [] as AsistenciaGroup[]).sort((a, b) => { 
        const aParts = a.key.split(' '); const bParts = b.key.split(' ');
        const aEtapa = aParts[0]; const bEtapa = bParts[0];
        const aModulo = parseInt(aParts[1], 10); const bModulo = parseInt(bParts[1], 10);
        const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 };
        const orderA = etapaOrder[aEtapa] || 99; const orderB = etapaOrder[bEtapa] || 99;
        if (orderA !== orderB) return orderA - orderB; return aModulo - bModulo;
      });
    const maxValue = Math.max(...asistencias.map(d => d.value), 0);
    const asistGradients = ["from-emerald-400 to-teal-500", "from-green-400 to-emerald-500", "from-cyan-400 to-sky-500", "from-teal-400 to-cyan-500", "from-lime-400 to-green-500"];
    
    useEffect(() => { 
        const newWidths: Record<string, number> = {};
        asistencias.forEach(d => { newWidths[d.label] = maxValue > 0 ? (d.value / maxValue) * 100 : 0; });
        const id = requestAnimationFrame(() => setWidths(newWidths)); return () => cancelAnimationFrame(id);
     }, [asistencias, maxValue]);
    
    if (asistencias.length === 0) { return <p className="text-center text-slate-500 py-4">No hay datos de asistencias para mostrar.</p>; }
    
    let asistenciaIndex = 0;
    
    return (
      <div className="w-full h-full flex flex-col gap-1 py-1 px-1">
        <h3 className="text-sm font-semibold text-slate-700 px-1 mb-3">Asistencias por módulo</h3>
        {groups.map((group) => {
            // Lógica de atenuación por MÓDULO
            const isGroupDimmed = hoveredModuloKey && group.key !== hoveredModuloKey;
            return (
            <div key={group.key} className={`space-y-1 py-1 transition-opacity duration-300 ${isGroupDimmed ? 'opacity-30' : 'opacity-100'}`}>
                <h4 className="text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
                {group.items.map((d, i) => {
                    const gradient = asistGradients[asistenciaIndex++ % asistGradients.length];
                    const currentPdfKey = `${d.etapa}-${d.modulo}-${d.dia}-${d.asistio}`;
                    return ( 
                        <div key={d.label} className="grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3"> 
                            <div className={`text-xs sm:text-sm text-left text-slate-500 truncate`}>{d.dia}</div> 
                            <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                                <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradient}`} 
                                    style={{ width: `${widths[d.label] || 0}%`, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} />
                            </div>
                            <div className="text-sm font-semibold text-slate-700 tabular-nums w-8 text-left">{d.value}</div>
                            <div className="flex items-center space-x-2 w-[52px]"> {d.value > 0 && ( <> <button onClick={() => onDetalleClick(d)} className="text-slate-400 hover:text-slate-700 transition-colors" title={`Consultar asistentes de ${d.label}`}> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {loadingPdfKey === currentPdfKey ? ( <div className="w-5 h-5 flex items-center justify-center"> <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(d)} className="text-slate-400 hover:text-red-600 transition-colors" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> )} </> )} </div>
                         </div> 
                    );
                })}
            </div>
        )})}
      </div>
    );
};

// (InasistenciasPanel sin cambios funcionales, solo prop renombrada)
const InasistenciasPanel = ({ data, onDetalleClick, onPdfClick, loadingPdfKey, hoveredModuloKey }: {
  data: AsistBarData[];
  onDetalleClick: (item: AsistBarData) => void;
  onPdfClick: (item: AsistBarData) => void;
  loadingPdfKey: string | null;
  hoveredModuloKey: string | null; // Prop renombrada
}) => {
    const [widths, setWidths] = useState<Record<string, number>>({});
    const inasistencias = data.filter(d => d.type === 'inasistencia');
    const totalInasistencias = inasistencias.reduce((sum, d) => sum + d.value, 0);
    const generalInasistencia = inasistencias.find(d => d.etapa === 'General');
    const inasistenciasDetalle = inasistencias.filter(d => d.etapa !== 'General');
    const groups: AsistenciaGroup[] = inasistenciasDetalle.reduce((acc, row) => { 
        const groupKey = `${row.etapa} ${row.modulo}`;
        let group = acc.find(g => g.key === groupKey);
        if (!group) { group = { key: groupKey, items: [] }; acc.push(group); }
        group.items.push(row); return acc;
     }, [] as AsistenciaGroup[]).sort((a, b) => { 
        const aParts = a.key.split(' '); const bParts = b.key.split(' ');
        const aEtapa = aParts[0]; const bEtapa = bParts[0];
        const aModulo = parseInt(aParts[1], 10); const bModulo = parseInt(bParts[1], 10);
        const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3 };
        const orderA = etapaOrder[aEtapa] || 99; const orderB = etapaOrder[bEtapa] || 99;
        if (orderA !== orderB) return orderA - orderB; return aModulo - bModulo;
      });
    const maxValue = Math.max(...inasistencias.map(d => d.value), 1);
    const inasistGradient = "from-rose-500 to-red-600";

    useEffect(() => { 
        const newWidths: Record<string, number> = {};
        inasistencias.forEach(d => { newWidths[d.label] = maxValue > 0 ? (d.value / maxValue) * 100 : 0; });
        const id = requestAnimationFrame(() => setWidths(newWidths)); return () => cancelAnimationFrame(id);
     }, [inasistencias, maxValue]);

    if (inasistencias.length === 0 || totalInasistencias === 0) { return <p className="text-center text-slate-500 py-4">No hay inasistencias registradas.</p>; }
    
    return (
        <div className="w-full h-full flex flex-col gap-2 py-1 px-1">
            <h3 className="text-sm font-semibold text-rose-600 px-1 mb-3">Detalle por Módulo</h3>
            {groups.map((group) => {
                // Lógica de atenuación por MÓDULO
                const isGroupDimmed = hoveredModuloKey && group.key !== hoveredModuloKey;
                return (
                <div key={group.key} className={`space-y-1 py-1 transition-opacity duration-300 ${isGroupDimmed ? 'opacity-30' : 'opacity-100'}`}>
                    <h4 className="text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
                    {group.items.map((d, i) => {
                        const currentPdfKey = `${d.etapa}-${d.modulo}-${d.dia}-${d.asistio}`;
                        return ( 
                            <div key={d.label} className={`grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3`}> 
                                <div className={`text-xs sm:text-sm text-left text-slate-600 truncate`}>{d.dia}</div> 
                                <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                                    <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${inasistGradient}`} 
                                        style={{ width: `${widths[d.label] || 0}%`, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }}/>
                                </div>
                                <div className="text-sm tabular-nums w-8 text-left font-bold text-rose-700">{d.value}</div>
                                <div className="flex items-center space-x-2 w-[52px]"> {d.value > 0 && ( <> <button onClick={() => onDetalleClick(d)} className="text-slate-400 hover:text-rose-700 transition-colors" title={`Consultar inasistentes de ${d.label}`}> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {loadingPdfKey === currentPdfKey ? ( <div className="w-5 h-5 flex items-center justify-center"> <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(d)} className="text-slate-400 hover:text-rose-600 transition-colors" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> )} </> )} </div>
                             </div> 
                        );
                    })}
                </div>
            )})}
            {generalInasistencia && ( <div key={generalInasistencia.label} className={`grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3 pt-3 mt-2 border-t border-slate-300`}> <div className={`text-sm sm:text-base font-extrabold text-rose-700 text-left truncate`}>{generalInasistencia.label}</div> <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden"> <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${inasistGradient}`} style={{ width: '100%', opacity: 0.5, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> </div> <div className="text-sm tabular-nums w-8 text-left font-extrabold text-rose-700">{generalInasistencia.value}</div> <div className="w-[52px]"></div> </div> )}
        </div>
    );
};


// (Modales y Componentes de Contactos/Servidores sin cambios)
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
  
  return ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out" onClick={onClose} /> <div className={"relative z-10 w-full max-w-md rounded-2xl shadow-2xl text-white transition-all duration-300 ease-out " + (premium ? 'bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-black/60 border border-white/10 backdrop-blur-2xl' : 'bg-black/80 backdrop-blur-xl border border-white/10')} style={{ transform: 'scale(0.95)', opacity: 0, animation: 'enter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}> <div className={"px-5 py-3 rounded-t-2xl border-b flex justify-between items-center " + (premium ? 'bg-white/70 backdrop-blur-md border border-white/30 shadow-sm' : 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300')}> <h3 className={"text-base font-semibold truncate pr-4 " + (premium ? 'text-slate-900' : 'text-slate-900')}>{title}</h3> <button onClick={() => generateContactosPdf(title, data)} disabled={isLoading || data.length === 0} className={premium ? "p-1.5 rounded-full text-slate-800 hover:text-slate-900 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" : "p-1.5 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"} title="Descargar en PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> </button> </div> <div className="p-5 max-h-[60vh] overflow-y-auto"> {isLoading ? ( <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div> ) : ( <div className="flex flex-col"> <div className="flex flex-col gap-3 mt-0"> {paginatedData.map((persona, index) => ( <div key={index} className="grid grid-cols-[1fr_140px] items-center gap-x-4 text-sm px-3 py-2 border-b border-white/10"> <span className="text-slate-200 truncate">{persona.nombre}</span> <span className="text-slate-400 font-mono text-right">{persona.telefono || 'N/A'}</span> </div> ))} </div> </div> )} </div> <div className="px-5 py-3 border-t border-white/20 flex justify-between items-center"> <button onClick={handlePrev} disabled={currentPage === 0} className="text-sm text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors">Anterior</button> <span className="text-xs text-slate-400">Página {currentPage + 1} de {totalPages > 0 ? totalPages : 1}</span> <button onClick={handleNext} disabled={currentPage >= totalPages - 1} className="text-sm text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors">Siguiente</button> </div> </div> <style jsx global>{` @keyframes enter { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } `}</style> </div> );
};

const ServidoresDetalleModal = ({ isOpen, onClose, title, subTitle, data, isLoading, premium }: { isOpen: boolean; onClose: () => void; title: string; subTitle: string; data: ServidorDetalle[]; isLoading: boolean; premium?: boolean; }) => { 
  if (!isOpen) return null; 
  const containerClasses = premium ? 'relative z-10 w-full max-w-lg rounded-2xl text-white shadow-2xl bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-black/60 border border-white/10 backdrop-blur-2xl' : 'relative z-10 w-full max-w-lg bg-black rounded-2xl shadow-2xl text-white border border-slate-700/80';
  const headerClasses = premium ? 'px-5 py-3 rounded-t-2xl border-b border-white/10 bg-white/95 shadow-sm sticky top-0 z-20' : 'px-5 py-3 bg-gradient-to-b from-slate-200 to-slate-300 rounded-t-2xl border-b border-slate-400';
  return ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out animate-fadeIn" onClick={onClose} /> <div className={containerClasses} style={{ transform: 'scale(0.95)', opacity: 0, animation: 'enter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}> <div className={headerClasses}> <h2 className={premium ? 'text-lg font-bold text-slate-900' : 'text-lg font-bold text-slate-800'}>{title}</h2> <p className={premium ? 'text-sm text-slate-700 font-medium' : 'text-sm text-slate-600 font-medium'}>{subTitle}</p> </div> <div className="p-1 sm:p-3 max-h-[60vh] overflow-y-auto"> {isLoading ? ( <div className="flex items-center justify-center h-[300px] text-slate-400">Cargando servidores...</div> ) : ( <div className="flex flex-col"> <div className="grid grid-cols-[1fr_120px] md:grid-cols-[1fr_120px_140px] gap-x-4 px-3 py-2 border-b border-white/20 sticky top-0 z-10" style={{ background: premium ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' : undefined }}> <span className="font-semibold text-slate-400 uppercase tracking-wider text-[0.65rem]">Nombre</span> <span className="font-semibold text-slate-400 uppercase tracking-wider text-[0.65rem] text-center">Cédula</span> <span className="hidden md:block font-semibold text-slate-400 uppercase tracking-wider text-[0.65rem] text-right">Teléfono</span> </div> {data.map((servidor, index) => ( <div key={index} className="grid grid-cols-[1fr_120px] md:grid-cols-[1fr_120px_140px] items-center gap-x-4 text-sm px-3 py-3 border-b border-white/10"> <span className="text-slate-200 truncate font-medium">{servidor.nombre}</span> <span className="text-slate-400 font-mono text-center">{servidor.cedula}</span> <span className="hidden md:block text-slate-400 font-mono text-right">{servidor.telefono || 'N/A'}</span> </div> ))} </div> )} </div> </div> <style jsx global>{` @keyframes enter { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-fadeIn { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } `}</style> </div> );
};

interface ContactGroup { key: string; etapa: string; modulo: number; items: BarChartData[]; role: string; dia: string; }
const MinimalistContactCard = ({ data, title, onRowClick, onPdfClick, loadingPdfKey }: { data: BarChartData[]; title: string; onRowClick: (key: string) => void; onPdfClick: (key: string) => void; loadingPdfKey: string | null; }) => { 
    const [widths, setWidths] = useState<Record<string, number>>({});
    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    useEffect(() => { 
        const newWidths: Record<string, number> = {}; data.forEach(d => { newWidths[d.key] = (d.value / maxValue) * 100; });
        const id = requestAnimationFrame(() => setWidths(newWidths)); return () => cancelAnimationFrame(id);
    }, [data, maxValue]);
    if (!data || data.length === 0) { return <p className="text-center text-slate-500 py-8">No hay datos para mostrar.</p>; }
    const groups: ContactGroup[] = data.reduce((acc, row) => { 
        const parsed = parseContactoKey(row.key); if (!parsed) return acc; const groupKey = `${parsed.etapa} ${parsed.modulo}`;
        let group = acc.find(g => g.key === groupKey);
        if (!group) { group = { key: groupKey, etapa: parsed.etapa, modulo: parsed.modulo, items: [], role: 'Contacto', dia: '' }; acc.push(group); }
        group.items.push(row); return acc;
    }, [] as ContactGroup[]).sort((a, b) => { 
        const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3 };
        const orderA = etapaOrder[a.etapa] || 99; const orderB = etapaOrder[b.etapa] || 99;
        if (orderA !== orderB) return orderA - orderB; return a.modulo - b.modulo;
    });
    const chunkedGroups: ContactGroup[][] = []; for (let i = 0; i < groups.length; i += 2) { chunkedGroups.push(groups.slice(i, i + 2)); }
    const premiumLightGradients = ["linear-gradient(90deg, #93c5fd, #a5b4fc)", "linear-gradient(90deg, #a7f3d0, #6ee7b7)", "linear-gradient(90deg, #fbcfe8, #f0abfc)", "linear-gradient(90deg, #fde68a, #fcd34d)"];
    return ( <div className="flex flex-col gap-4 w-full"> {chunkedGroups.map((rowOfGroups, rowIndex) => ( <div key={rowIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {rowOfGroups.map((group) => { const groupTotal = group.items.reduce((sum, item) => sum + item.value, 0); return ( <div key={group.key} className="p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 ring-1 ring-white/8 shadow-lg shadow-black/20 transition-all duration-300 hover:shadow-black/25"> <div className="flex justify-between items-center border-b border-white/6 pb-2 mb-3"> <h3 className="text-lg font-bold text-slate-800">{group.key}</h3> <div className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-extrabold text-slate-700 tabular-nums" style={{ background: 'linear-gradient(145deg, #e6e6e6, #ffffff)', boxShadow: '4px 4px 8px #cccccc, -4px -4px 8px #ffffff', color: '#475569', fontWeight: 'bold' }}>{groupTotal}</div> </div> <div className="flex flex-row space-x-3 items-center"> {group.items.map((row, i) => { const parsed = parseContactoKey(row.key)!; const currentPdfKey = row.key; const barGradient = premiumLightGradients[i % premiumLightGradients.length]; const isVirtual = parsed.dia.toLowerCase() === 'virtual'; return ( <div key={row.key} className="flex-1 min-w-0 flex flex-col space-y-1 items-center"> <span className={`text-xs font-semibold ${isVirtual ? 'text-violet-600' : 'text-slate-600'} truncate uppercase`}>{parsed.dia}</span> <div className="relative h-5 w-full bg-slate-200/70 rounded-full overflow-hidden flex items-center shadow-inner shadow-black/10"> <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: `${widths[row.key] || 0}%`, background: barGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> <span className="absolute right-2 font-extrabold text-white text-sm tabular-nums" style={{ textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)' }}>{row.value}</span> </div> <div className="flex items-center justify-center space-x-1 w-full mt-1"> <button onClick={() => onRowClick(row.key)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Consultar detalles"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {onPdfClick && (loadingPdfKey === currentPdfKey ? ( <div className="w-4 h-4 flex items-center justify-center"> <svg className="animate-spin h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(row.key)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> ))} </div> </div> ); })} </div> </div> ); })} </div> ))} <div className="flex justify-end pt-3 pr-2 text-lg font-bold text-slate-800 border-t border-slate-200 mt-4"> {title}: <span className="tabular-nums ml-2">{total}</span> </div> </div> );
};

interface ServerGroup { key: string; role: string; etapa: string; items: BarChartData[]; }
const GroupedStyledList = ({ data, baseTitle, rolePrefix, onRowClick, onPdfClick, loadingPdfKey }: { data: BarChartData[]; baseTitle: string; rolePrefix: string; onRowClick: (key: string) => void; onPdfClick: (key: string) => void; loadingPdfKey: string | null; }) => { 
    const [widths, setWidths] = useState<Record<string, number>>({});
    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    useEffect(() => { 
        const newWidths: Record<string, number> = {}; data.forEach(d => { newWidths[d.key] = (d.value / maxValue) * 100; });
        const id = requestAnimationFrame(() => setWidths(newWidths)); return () => cancelAnimationFrame(id);
    }, [data, maxValue]);
    if (!data || data.length === 0) { return <p className="text-center text-slate-500 py-8">No hay datos para mostrar.</p>; }
    const groups: ServerGroup[] = data.reduce((acc, row) => { 
        const keyWithoutRole = normalizeWs(row.key.replace(rolePrefix, '')); const matchSimple = keyWithoutRole.match(/^(.+?)\s*\(([^)]+)\)\s*$/); const matchModulo = keyWithoutRole.match(/^(.+?)\s+(\d+)\s*\(([^)]+)\)\s*$/); let etapaName = keyWithoutRole; if (matchModulo) { etapaName = normalizeWs(`${matchModulo[1]} ${matchModulo[2]}`); } else if (matchSimple) { const parts = matchSimple[1].split(' '); etapaName = parts.length > 1 ? parts.slice(0, 2).join(' ') : matchSimple[1]; } const groupKey = etapaName; let group = acc.find(g => g.key === groupKey); if (!group) { group = { key: groupKey, role: rolePrefix.replace(' -', ''), etapa: etapaName, items: [] }; acc.push(group); } group.items.push(row); return acc;
    }, [] as ServerGroup[]).sort((a, b) => { 
        const aKey = a.key; const bKey = b.key; const aParsed = parseSortKey(aKey); const bParsed = parseSortKey(bKey); const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 }; const orderA = etapaOrder[aParsed.etapa] || 99; const orderB = etapaOrder[bParsed.etapa] || 99; if (orderA !== orderB) { return orderA - orderB; } if (aParsed.modulo !== bParsed.modulo) { return aParsed.modulo - bParsed.modulo; } return aKey.localeCompare(bKey);
    });
    const premiumLightGradients = ["linear-gradient(90deg, #93c5fd, #a5b4fc)", "linear-gradient(90deg, #a7f3d0, #6ee7b7)", "linear-gradient(90deg, #fbcfe8, #f0abfc)", "linear-gradient(90deg, #fde68a, #fcd34d)"];
    return ( <div className="flex flex-col gap-4 w-full"> {groups.map((group, groupIndex) => ( <div key={group.key} className="bg-white/80 backdrop-blur-xl rounded-2xl ring-1 ring-white/70 shadow-2xl shadow-slate-300/60 transition-all duration-300 hover:shadow-slate-400/70 overflow-hidden"> <div className="px-4 py-3 text-slate-800 font-extrabold text-lg border-b border-slate-200/80 bg-slate-100/50">{group.key}</div> <div className="flex flex-col divide-y divide-slate-200/50 p-3"> {group.items.map((row, i) => { const parsedServidor = parseServidorKey(row.key)!; const keyWithoutRole = normalizeWs(row.key.replace(rolePrefix, '')); const parsedKey = parseContactoKey(keyWithoutRole) || parseSortKey(keyWithoutRole); const barGradient = premiumLightGradients[i % premiumLightGradients.length]; const currentPdfKey = row.key; const diaDisplay = parsedKey.dia ? `${parsedKey.dia}` : ''; return ( <div key={row.key} className="grid grid-cols-[3fr_1.5fr_auto] items-center gap-x-3 py-2 text-sm"> <div className="font-medium text-slate-700 truncate" title={`${parsedServidor.rol} (${diaDisplay})`}> <span className="text-slate-500 font-normal">{diaDisplay}</span> </div> <div className="relative h-5 w-full bg-slate-200/70 rounded-full overflow-hidden flex items-center justify-end pr-1 shadow-inner shadow-black/10"> <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: `${widths[row.key] || 0}%`, background: barGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> <span className="absolute right-2 font-extrabold text-white text-sm tabular-nums" style={{ textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)' }}>{row.value}</span> </div> <div className="flex items-center justify-end space-x-1 w-[40px]"> <button onClick={() => onRowClick(row.key)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-50" title="Consultar detalles"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {onPdfClick && (loadingPdfKey === currentPdfKey ? ( <div className="w-5 h-5 flex items-center justify-center"> <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(row.key)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> ))} </div> </div> ); })} </div> </div> ))} <div className="flex justify-end pt-3 pr-2 text-lg font-bold text-slate-800 border-t border-slate-200 mt-4"> {baseTitle}: <span className="tabular-nums ml-2">{total}</span> </div> </div> );
};


/* ========================= Componente principal ========================= */
export default function DetalleSecciones({
  asistEtapas,
  agendados = [],
  asistPorModulo = [], // Esta es la fuente principal para el gráfico ahora
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

  // ESTADOS DE INTERACTIVIDAD SEPARADOS
  const [hoveredModuloKey, setHoveredModuloKey] = useState<string | null>(null); // Ej: "Semillas 1"
  const [hoveredEtapaKey, setHoveredEtapaKey] = useState<string | null>(null);   // Ej: "Semillas"


  // (Handlers sin cambios)
  const handleContactRowClick = async (key: string) => {
    const parsed = parseContactoKey(key);
    if (!parsed) { console.error("Invalid contact key format:", key); return; }
    const { etapa, modulo, dia } = parsed;
    const title = `Contactos de ${normalizeWs(key)}`;
    setModalOpen(true); setModalIsLoading(true); setModalContent({ title, data: [], premium: true });
    try { const personas = await getContactosPorFiltro(etapa, modulo, dia); setModalContent({ title, data: personas, premium: true }); } 
    catch (error) { console.error("Error fetching contact details:", error); setModalContent(prev => ({ ...prev, title: `Error al cargar ${normalizeWs(key)}`, premium: true })); } 
    finally { setModalIsLoading(false); }
  };
  const handleContactPdfDownload = async (key: string) => { setPdfLoadingKey(key); try { const parsed = parseContactoKey(key); if (!parsed) throw new Error("Invalid contact key"); const { etapa, modulo, dia } = parsed; const personas = await getContactosPorFiltro(etapa, modulo, dia); generateContactosPdf(`Contactos de ${normalizeWs(key)}`, personas); } catch (error) { console.error("Error generating contact PDF:", error); } finally { setPdfLoadingKey(null); } };
  const handleActivosRowClick = async (key: string) => {
    const parsed = parseContactoKey(key);
    if (!parsed) { console.error("Invalid contact key format:", key); return; }
    const { etapa, modulo, dia } = parsed;
    const title = `Contactos de ${normalizeWs(key)}`;
    setModalOpen(true); setModalIsLoading(true); setModalContent({ title, data: [], premium: true });
    try { const personas = await getActivosPorFiltro(etapa, modulo, dia); setModalContent({ title, data: personas, premium: true }); } 
    catch (error) { console.error("Error fetching active contact details:", error); setModalContent(prev => ({ ...prev, title: `Error al cargar ${normalizeWs(key)}`, premium: true })); } 
    finally { setModalIsLoading(false); }
  };
  const handleActivosPdfDownload = async (key: string) => { 
    setPdfLoadingKey(key); 
    try { const parsed = parseContactoKey(key); if (!parsed) throw new Error("Invalid contact key"); const { etapa, modulo, dia } = parsed; const personas = await getActivosPorFiltro(etapa, modulo, dia); generateContactosPdf(`Contactos de ${normalizeWs(key)}`, personas); } 
    catch (error) { console.error("Error generating active contact PDF:", error); } 
    finally { setPdfLoadingKey(null); } 
  };
  const handleServidorRowClick = async (key: string) => { const parsed = parseServidorKey(key); if (!parsed) { console.error("Invalid server key:", key); return; } const { rol, etapa, dia } = parsed; const titleMapping: { [key: string]: string } = { 'Maestros': 'Coordinadores', 'Contactos': 'Timoteos' }; const modalTitle = titleMapping[rol] || rol; setServidoresModalOpen(true); setServidoresModalIsLoading(true); setServidoresModalContent({ title: modalTitle, subTitle: `de ${etapa} (${dia})`, data: [], premium: true }); try { const servidores = await getServidoresPorFiltro(rol, etapa, dia); setServidoresModalContent(prev => ({ ...prev, data: servidores, premium: true })); } catch (error) { console.error("Error fetching server details:", error); setServidoresModalContent(prev => ({ ...prev, subTitle: 'Error al cargar los datos', premium: true })); } finally { setServidoresModalIsLoading(false); } };
  const handleServidorPdfDownload = async (key: string) => { setPdfLoadingKey(key); try { const parsed = parseServidorKey(key); if (!parsed) { throw new Error("Invalid server key"); } const { rol, etapa, dia } = parsed; const titleMapping: { [key: string]: string } = { 'Maestros': 'Coordinadores', 'Contactos': 'Timoteos' }; const pdfTitle = titleMapping[rol] || rol; const pdfSubTitle = `de ${etapa} (${dia})`; const servidores = await getServidoresPorFiltro(rol, etapa, dia); generateServidoresPdf(pdfTitle, pdfSubTitle, servidores); } catch (error) { console.error("Error generating server PDF:", error); } finally { setPdfLoadingKey(null); } };
  const handleAsistenciaDetalleClick = async (item: AsistBarData) => {
    const { etapa, modulo, dia, asistio } = item;
    const title = `${asistio ? 'Asistentes' : 'Inasistentes'} de ${etiquetaEtapaModulo(etapa, modulo, dia)}`;
    setModalOpen(true); setModalIsLoading(true); setModalContent({ title, data: [], premium: true });
    try { const personas = await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio); setModalContent({ title, data: personas, premium: true }); } 
    catch (error) { console.error("Error fetching attendance details:", error); setModalContent(prev => ({ ...prev, title: `Error al cargar ${etapa}`, premium: true })); } 
    finally { setModalIsLoading(false); }
  };
  const handleAsistenciaPdfClick = async (item: AsistBarData) => {
    const { etapa, modulo, dia, asistio } = item;
    const loadingKey = `${etapa}-${modulo}-${dia}-${asistio}`;
    setPdfLoadingKey(loadingKey);
    try { const title = `${asistio ? 'Asistentes' : 'Inasistentes'} de ${etiquetaEtapaModulo(etapa, modulo, dia)}`; const personas = await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio); generateContactosPdf(title, personas); } 
    catch (error) { console.error(`Error generating PDF for ${etapa}:`, error); } 
    finally { setPdfLoadingKey(null); }
  };


  // --- 6. LÓGICA DE DATOS CORREGIDA Y REESTRUCTURADA ---

  // Total general (para el centro del gráfico - usa asistEtapas para precisión total)
  const totalAsist = asistEtapas.reduce((s, r) => s + (r.total || 0), 0);
  
  // 6.1. NUEVOS DATOS PARA EL GRÁFICO (Asistencias + Inasistencias por Módulo)
  // Usamos useMemo para evitar recálculos innecesarios si `asistPorModulo` no cambia
  const donutChartData: DonutSegmentData[] = React.useMemo(() => {
    // Primero, agregamos los totales por módulo (sumando días si es necesario)
    const modulosMap = asistPorModulo.reduce((acc, m) => {
        // Asegurarse de que etapa y modulo sean válidos
        if (!m.etapa || typeof m.modulo !== 'number') {
            console.warn("Skipping invalid data in asistPorModulo:", m);
            return acc;
        }
        const key = `${m.etapa} ${m.modulo}`; // Clave única para el módulo
        if (!acc[key]) {
            acc[key] = {
                name: key, // Nombre base del módulo
                etapa: m.etapa, // Etapa base para color y hover
                confirmados: 0,
                noAsistieron: 0,
            };
        }
        // Acumular los valores de confirmados y noAsistieron
        acc[key].confirmados += m.confirmados || 0; 
        acc[key].noAsistieron += m.noAsistieron || 0; 
        return acc;
    }, {} as Record<string, { name: string, etapa: string, confirmados: number, noAsistieron: number }>);

    // Luego, creamos los segmentos (hasta dos por módulo) para el gráfico
    return Object.values(modulosMap).flatMap(moduloData => {
        const segments: DonutSegmentData[] = [];
        // Añadir segmento de asistencia si hay valor > 0
        if (moduloData.confirmados > 0) {
            segments.push({
                name: `${moduloData.name} Asist.`, // Nombre único para el segmento (tooltip/label)
                baseName: moduloData.name,       // Nombre base para hover
                etapa: moduloData.etapa,           // Etapa base para hover
                value: moduloData.confirmados,
                type: 'asistencia',
            });
        }
        // Añadir segmento de inasistencia si hay valor > 0
        if (moduloData.noAsistieron > 0) {
            segments.push({
                name: `${moduloData.name} Inas.`, // Nombre único para el segmento
                baseName: moduloData.name,       // Nombre base para hover
                etapa: moduloData.etapa,           // Etapa base para hover
                value: moduloData.noAsistieron,
                type: 'inasistencia',
            });
        }
        return segments; // Retorna array con 0, 1 o 2 segmentos para este módulo
    }).filter(segment => segment.value > 0); // Filtro final por si acaso
  }, [asistPorModulo]); // Dependencia: recalcular solo si asistPorModulo cambia


  // Datos para los paneles derechos (sin cambios estructurales)
  const totalAgend = agendados.reduce((s, r) => s + (r.agendados_pendientes || 0), 0);
  
  const asistenciasChartData = asistPorModulo.filter(m => (m.confirmados || 0) > 0).map(m => ({
      label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia), value: m.confirmados, type: 'asistencia' as const, etapa: m.etapa, modulo: m.modulo, dia: m.dia, asistio: true
  }));

  const inasistenciasPorModulo = asistPorModulo.filter(m => (m.noAsistieron || 0) > 0).map(m => ({
      label: etiquetaEtapaModulo(m.etapa, m.modulo, m.dia), value: m.noAsistieron, type: 'inasistencia' as const, etapa: m.etapa, modulo: m.modulo, dia: m.dia, asistio: false
  }));

  const totalInasist = asistPorModulo.reduce((s, r) => s + (r.noAsistieron || 0), 0);

  const inasistenciasChartData: AsistBarData[] = [
      ...inasistenciasPorModulo,
      { label: 'Inasistencias Total', value: totalInasist, type: 'inasistencia' as const, etapa: 'General', modulo: 0, dia: '', asistio: false }
  ].filter(item => item.value > 0);

  // Tooltip Personalizado (adaptado a DonutSegmentData)
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

  // Etiqueta Radial Personalizada (Adaptada para nombres más cortos y tipo)
  const RADIAN = Math.PI / 180;
  const RadialLabel = ({ cx, cy, midAngle, outerRadius, percent, payload }: any) => {
    // Mostrar etiquetas: reducir umbral para inasistencias y hacer el parseo más robusto
    if (!payload) return null;
    const isInas = payload.type === 'inasistencia';
    const threshold = isInas ? 0.005 : 0.03; // permitir inasistencias muy pequeñas
    if (percent < threshold) {
      // Para inasistencias forzamos mostrar incluso si son muy pequeñas
      if (!isInas) return null;
    }

    try {
        // Intentar extraer etapa y módulo con regex más tolerante
        const baseName: string = String(payload.baseName || payload.name || '');
        const match = baseName.match(/^(\s*([^\d]+?)\s+)?(\d+)/); // captura etapa (no-dígitos) y número de módulo
        let etapaShort = '';
        let moduloNum = '';
        if (match) {
            etapaShort = (match[2] || '').trim().substring(0,1).toUpperCase();
            moduloNum = match[3] || '';
        } else {
            // Fallback: tomar primeras dos partes
            const parts = baseName.split(/\s+/).filter(Boolean);
            etapaShort = parts[0] ? parts[0].substring(0,1).toUpperCase() : 'M';
            moduloNum = parts[1] || '';
        }
        const shortType = isInas ? 'Inas.' : 'Asist.';
        const shortLabel = moduloNum ? `${etapaShort}${moduloNum} ${shortType}` : `${baseName} ${shortType}`;

        // Posiciones
        const radiusLineStart = outerRadius + 10;
        const radiusLineEnd = outerRadius + 25;
        const radiusText = outerRadius + 28;
        const sx = cx + radiusLineStart * Math.cos(-midAngle * RADIAN);
        const sy = cy + radiusLineStart * Math.sin(-midAngle * RADIAN);
        const mx = cx + radiusLineEnd * Math.cos(-midAngle * RADIAN);
        const my = cy + radiusLineEnd * Math.sin(-midAngle * RADIAN);
        const tx = cx + radiusText * Math.cos(-midAngle * RADIAN);
        const ty = cy + radiusText * Math.sin(-midAngle * RADIAN);
        const textAnchor = tx > cx ? 'start' : 'end';

        // Color de la línea y texto basado en asistencia/inasistencia
        const color = isInas ? '#b91c1c' : '#666';

        return (
          <g>
            <path d={`M${sx},${sy}L${mx},${my}L${tx},${my}`} stroke={color} fill="none" strokeWidth={1}/>
            <text
              x={tx + (tx > cx ? 3 : -3)}
              y={ty}
              fill={color}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              style={{ fontSize: '11px', fontWeight: 500, pointerEvents: 'none' }}
            >
              {shortLabel}
            </text>
          </g>
        );
    } catch (e) {
        console.error("Error rendering radial label for payload:", payload, e);
        return null;
    }
  };
  
  // (useEffect para 'view' sin cambios)
  useEffect(() => { const handler = (e: MouseEvent) => { const target = (e.target as HTMLElement).closest("[data-key]"); if (target) setView(target.getAttribute("data-key")); }; document.addEventListener("click", handler); return () => document.removeEventListener("click", handler); }, []);
  
  // Animación para el número central (sin cambios)
  const [animatedTotal, setAnimatedTotal] = useState(0);
  useEffect(() => { 
      const target = totalAsist;
      let raf = 0; const start = performance.now(); const dur = 800;
      const tick = (now: number) => { const t = Math.min((now - start) / dur, 1); setAnimatedTotal(Math.round(target * t)); if (t < 1) raf = requestAnimationFrame(tick); };
      requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [totalAsist]); 

  
  // (Lógica de ordenamiento sin cambios)
  const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 };
  const genericSort = (a: BarChartData, b: BarChartData, keyPrefix: string) => { const aKey = normalizeWs(a.key.replace(keyPrefix, '')); const bKey = normalizeWs(b.key.replace(keyPrefix, '')); const aParsed = parseSortKey(aKey); const bParsed = parseSortKey(bKey); const etapaOrderA = etapaOrder[aParsed.etapa] || 99; const etapaOrderB = etapaOrder[bParsed.etapa] || 99; if (etapaOrderA !== etapaOrderB) { return etapaOrderA - etapaOrderB; } if (aParsed.modulo !== bParsed.modulo) { return aParsed.modulo - bParsed.modulo; } return aKey.localeCompare(bKey); };
  const maestrosData = servidoresPorRolEtapaDia.filter(d => d.key.startsWith('Maestros')).sort((a,b) => genericSort(a,b, 'Maestros -'));
  const timoteosData = servidoresPorRolEtapaDia.filter(d => d.key.startsWith('Contactos')).sort((a,b) => genericSort(a,b, 'Contactos -'));
  const sortedContactosData = [...contactosPorEtapaDia].sort((a,b) => genericSort(a,b, ''));

  return (
    <>
      {/* (Estilos y Modales sin cambios) */}
      <style jsx>{`.agendados-container, .asistencias-container, .contactos-container, .servidores-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; align-items: start; } @media (min-width: 1024px) { .servidores-container { grid-template-columns: 1fr 1fr; } .asistencias-container { grid-template-columns: 1fr 1fr; gap: 0.75rem; } }`}</style>
      <ContactosDetalleModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalContent.title} data={modalContent.data} isLoading={modalIsLoading} premium={modalContent.premium} />
      <ServidoresDetalleModal isOpen={servidoresModalOpen} onClose={() => setServidoresModalOpen(false)} title={servidoresModalContent.title} subTitle={servidoresModalContent.subTitle} data={servidoresModalContent.data} isLoading={servidoresModalIsLoading} premium={servidoresModalContent.premium} />
      
  <div className="overflow-x-hidden overflow-y-visible mt-6">
        {!view && ( <div className="grid premium-grid"><section className="card span-2 animate-fadeIn premium-glass p-4"><h2 className="card-title">Bienvenido</h2><p className="text-muted">Selecciona una tarjeta KPI para ver detalles.</p></section></div> )}
        
        {view === "asistencias" && (
          // CONTENEDOR PRINCIPAL DE LA VISTA ASISTENCIAS (Grid de 2 columnas)
          <div className="asistencias-container">
            
            {/* COLUMNA IZQUIERDA: GRÁFICO DONUT + TABLA RESUMEN POR ETAPA */}
            <section className="card premium-glass animate-slideIn flex flex-col overflow-hidden self-stretch">
                <div className="px-4 py-3 border-b border-slate-200/80 flex-shrink-0">
                    <h2 className="text-base font-semibold text-slate-700">Resumen General por Módulo</h2>
                </div>
                
                {/* 7. CONTENEDOR DEL GRÁFICO REESTRUCTURADO */}
                <div className="panel-body px-1 py-4 flex-shrink-0">
                    {/* Contenedor con aspect ratio para evitar layout shift */}
                    <div className="relative mx-auto w-full aspect-square max-h-[320px] overflow-x-hidden overflow-y-visible flex items-center justify-center"> 
                        <ResponsiveContainer width="100%" height="100%">
                          
                          {/* PieChart ahora es importado dinámicamente */}
                          <PieChart 
                            onMouseLeave={() => { setHoveredModuloKey(null); setHoveredEtapaKey(null); }}
                            // Márgenes para dar espacio a las etiquetas
                            margin={{ top: 40, right: 40, bottom: 40, left: 40 }} // Márgenes consistentes
                          >
                            <Tooltip content={<CustomTooltip />} />
                            <Pie
                              data={donutChartData} // <-- USANDO LOS NUEVOS DATOS (Asist/Inasist por Módulo)
                              dataKey="value"
                              nameKey="name" // Usará "Semillas 1 Asist.", "Semillas 1 Inas.", etc. para tooltip
                              cx="50%"
                              cy="50%"
                              innerRadius={60} 
                              outerRadius={90}
                              startAngle={90}
                              endAngle={-270}
                              paddingAngle={2} // Reducido padding para más segmentos
                              cornerRadius={5}  // Reducido cornerRadius
                              isAnimationActive // Mantenemos la animación
                              animationBegin={100}
                              animationDuration={900}
                              animationEasing="ease-out"
                              labelLine={false} 
                              label={<RadialLabel />} // Usa payload.name y payload.baseName internamente
                            >
                              {donutChartData.map((entry, index) => {
                                // Determinar color basado en Asistencia/Inasistencia y Módulo
                                const [etapa, moduloStr] = entry.baseName.split(' ');
                                const moduloNum = parseInt(moduloStr, 10);
                                // Asegurar que etapa y moduloNum sean válidos antes de asignar color
                                const segmentColor = entry.type === 'asistencia' && etapa && !isNaN(moduloNum)
                                  ? getColorForModulo(etapa, moduloNum) // Color variado para asistencia
                                  : entry.type === 'inasistencia'
                                    ? INASISTENCIA_COLOR // Rojo para inasistencia
                                    : ETAPA_BASE_COLORS.Default; // Color por defecto si algo falla

                                return (
                                  <Cell 
                                    key={`cell-${index}-${entry.name}`} // Clave más única
                                    fill={segmentColor} 
                                    stroke={"#fff"} // Borde blanco delgado
                                    strokeWidth={1}
                                    style={{
                                      transition: 'opacity 0.2s ease, filter 0.2s ease',
                                      // Lógica de atenuación por MÓDULO BASE (entry.baseName)
                                      opacity: hoveredModuloKey ? (hoveredModuloKey === entry.baseName ? 1 : 0.3) : 1, // Atenuación más fuerte
                                      filter: hoveredModuloKey === entry.baseName ? 'brightness(1.10)' : 'brightness(1)' // Brillo más sutil
                                    }}
                                    // Eventos de hover actualizados
                                    onMouseEnter={() => { 
                                      setHoveredModuloKey(entry.baseName); // ej. "Semillas 1"
                                      setHoveredEtapaKey(entry.etapa);      // ej. "Semillas"
                                    }}
                                  />
                                );
                              })}
                            </Pie>
                          </PieChart>

                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-1">
                            {/* El total animado sigue siendo el gran total */}
                            <p className="text-3xl leading-tight font-extrabold text-gray-900 tabular-nums">{animatedTotal.toLocaleString()}</p>
                            <p className="text-gray-500 text-sm mt-0.5">Total</p>
                        </div>
                    </div>
                </div>

                {/* Tabla Resumen por Etapa (Interactiva con la Etapa base) */}
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
                    {/* Usa la prop original 'asistEtapas' para esta tabla resumen */}
                    {asistEtapas.map((row, i) => (
                        <div 
                          key={i} 
                          className={`premium-table-row premium-table-item transition-opacity duration-300 ${
                            // Lógica de atenuación por ETAPA (hoveredEtapaKey)
                            hoveredEtapaKey ? (hoveredEtapaKey === row.etapa ? 'opacity-100' : 'opacity-30') : 'opacity-100'
                          }`}
                          style={hoveredEtapaKey === row.etapa ? {
                            backgroundColor: 'rgba(230, 245, 255, 0.7)' 
                          } : {}}
                          // Eventos de hover para la tabla (establecen hoveredEtapaKey)
                          onMouseEnter={() => {
                            setHoveredEtapaKey(row.etapa);
                            setHoveredModuloKey(null); // Limpiamos el hover del módulo para no confundir
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


            {/* COLUMNA DERECHA: Detalle de Asistencias e Inasistencias (Agrupados Verticalmente) */}
            <section className="flex flex-col space-y-4 self-stretch">
                
                {/* 8. PASANDO EL ESTADO `hoveredModuloKey` AL HIJO */}
                <div className="card premium-glass animate-slideIn flex flex-col overflow-hidden flex-grow">
                    <div className="px-4 py-3 border-b border-slate-200/80 flex-shrink-0"><h2 className="text-base font-semibold text-slate-700">Detalle por Módulo (Asist.)</h2></div>
                    <div className="panel-body p-3 flex-grow overflow-y-auto">
                      <AsistenciasHorizontalBars 
                        data={asistenciasChartData}
                        onDetalleClick={handleAsistenciaDetalleClick}
                        onPdfClick={handleAsistenciaPdfClick}
                        loadingPdfKey={pdfLoadingKey}
                        hoveredModuloKey={hoveredModuloKey} // <-- Prop correcta
                      />
                    </div>
                </div>

                {/* 9. PASANDO EL ESTADO `hoveredModuloKey` AL HIJO */}
                <div className="card premium-glass animate-slideIn flex flex-col overflow-hidden flex-grow">
                    <div className="px-4 py-3 border-b border-rose-200/80 bg-rose-50/50 flex-shrink-0"><h2 className="text-base font-semibold text-rose-700">Reporte Detallado de Inasistencias</h2></div>
                    <div className="panel-body p-3 flex-grow overflow-y-auto">
                      <InasistenciasPanel
                        data={inasistenciasChartData}
                        onDetalleClick={handleAsistenciaDetalleClick}
                        onPdfClick={handleAsistenciaPdfClick}
                        loadingPdfKey={pdfLoadingKey}
                        hoveredModuloKey={hoveredModuloKey} // <-- Prop correcta
                      />
                    </div>
                </div>
            </section>
          </div>
        )}

        {/* (Vistas 'agendados', 'contactos', 'servidores' sin cambios) */}
        {view === "agendados" && ( <div className="agendados-container"> <section className="agendados-grafico card premium-glass animate-slideIn p-4"> <div className="card-head flex justify-between items-center"><h2 className="card-title">Agendados por semana</h2><div className="text-right chart-meta"><p className="card-meta-label text-lg font-semibold">Total agendados</p><p className="card-meta-value tabular-nums">{totalAgend.toLocaleString()}</p></div></div><div className="panel-body py-2 px-4"><PremiumHorizontalBars data={agendados} onRowClick={handleContactRowClick} onPdfClick={handleContactPdfDownload} loadingPdfKey={pdfLoadingKey} /></div> </section> <section className="agendados-detalle card premium-glass animate-slideIn p-4"> <div className="card-head pb-0"><h2 className="card-title">Detalle por etapa/módulo</h2></div><div className="panel-body px-0 py-0"><div className="premium-table-row premium-table-header two-cols"><span>Etapa · Módulo</span><span className="text-right">Agendados</span></div>{agendados.map((row, i) => (<div key={i} className="premium-table-row premium-table-item two-cols"><span className="font-medium text-slate-700">{row.etapa_modulo}</span><span className="text-right font-semibold text-gray-800 tabular-nums">{row.agendados_pendientes}</span></div>))}<div className="premium-table-row premium-table-total two-cols"><span>Total</span><span className="text-right tabular-nums">{totalAgend}</span></div></div> </section> </div> )}
        {view === "contactos" && ( <div className="contactos-container animate-slideIn justify-center"> <div className="w-full lg:max-w-4xl xl:max-w-6xl"> <section className="card premium-glass self-start flex flex-col overflow-hidden"> <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Contactos Activos</h2></div> <div className="panel-body p-5"> <MinimalistContactCard data={sortedContactosData} title="Total de Contactos Activos" onRowClick={handleActivosRowClick} onPdfClick={handleActivosPdfDownload} loadingPdfKey={pdfLoadingKey} /> </div> </section> </div> </div> )}
        {view === "servidores" && ( <div className="servidores-container animate-slideIn"> <section className="card premium-glass self-start flex flex-col overflow-hidden"> <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Coordinadores</h2></div> <div className="panel-body p-4"> <GroupedStyledList data={maestrosData} baseTitle="Total de Coordinadores" rolePrefix="Maestros -" onRowClick={handleServidorRowClick} onPdfClick={handleServidorPdfDownload} loadingPdfKey={pdfLoadingKey} /> </div> </section> <section className="card premium-glass self-start flex flex-col overflow-hidden"> <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Timoteos</h2></div> <div className="panel-body p-4"> <GroupedStyledList data={timoteosData} baseTitle="Total de Timoteos" rolePrefix="Contactos -" onRowClick={handleServidorRowClick} onPdfClick={handleServidorPdfDownload} loadingPdfKey={pdfLoadingKey} /> </div> </section> </div> )}
      </div>
    </>
  );
}