// src/app/panel/DetalleSecciones.tsx
"use client";

import React, { useEffect, useState, useMemo, startTransition } from "react";
import dynamic from 'next/dynamic';
// MEJORA 1: Eliminamos imports estáticos de Recharts y jsPDF para reducir el bundle inicial
import { getContactosPorFiltro, getServidoresPorFiltro, getAsistentesPorEtapaFiltro, getActivosPorFiltro } from "@/app/actions";
import type { Range } from "@/app/actions";

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
            etapaShort = (match[2] || '').trim().substring(0,1).toUpperCase();
            moduloNum = match[3] || '';
        } else {
            const parts = baseName.split(/\s+/).filter(Boolean);
            etapaShort = parts[0] ? parts[0].substring(0,1).toUpperCase() : 'M';
            moduloNum = parts[1] || '';
        }
        const shortType = isInas ? 'Inas.' : 'Asist.';
        const shortLabel = moduloNum ? `${etapaShort}${moduloNum} ${shortType}` : `${baseName} ${shortType}`;

        const RADIAN = Math.PI / 180;
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
        const color = isInas ? '#b91c1c' : '#666';

        return (
          <g>
            <path d={`M${sx},${sy}L${mx},${my}L${tx},${my}`} stroke={color} fill="none" strokeWidth={1}/>
            <text x={tx + (tx > cx ? 3 : -3)} y={ty} fill={color} textAnchor={textAnchor} dominantBaseline="middle" style={{ fontSize: '11px', fontWeight: 500, pointerEvents: 'none' }}>
              {shortLabel}
            </text>
          </g>
        );
    } catch (e) { return null; }
  };

  // Componente Retornado
  return ({ data, onHover, hoveredModuloKey, colors }: any) => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart onMouseLeave={() => onHover(null, null)} margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
        <Tooltip content={<CustomTooltip />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60} 
          outerRadius={90}
          startAngle={90}
          endAngle={-270}
          paddingAngle={2}
          cornerRadius={5}
          isAnimationActive={true}
          animationBegin={100}
          animationDuration={900}
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
  );
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

// Gradientes compartidos para barras (misma paleta que usa el detalle de Contactos Activos)
const SHARED_BAR_GRADIENTS = [
  "linear-gradient(90deg, #93c5fd, #a5b4fc)",
  "linear-gradient(90deg, #a7f3d0, #6ee7b7)",
  "linear-gradient(90deg, #fbcfe8, #f0abfc)",
  "linear-gradient(90deg, #fde68a, #fcd34d)",
];

// Gradientes estandarizados por día (suaves)
const DAY_GRADIENTS: Record<string, string> = {
  // Tonos suaves / gradientes igual que en el panel de contactos (coinciden con la imagen)
  domingo: 'linear-gradient(90deg, #93c5fd, #a5b4fc)',
  martes: 'linear-gradient(90deg, #a7f3d0, #6ee7b7)',
  virtual: 'linear-gradient(90deg, #fbcfe8, #f0abfc)',
};

const normalizeDayKey = (day?: string) => (day ? String(day).trim().toLowerCase() : '');
// Las etiquetas no deben cambiar de color: siempre usar texto neutral
const getDayTextClass = (_day?: string) => 'text-slate-600';
const getDayGradient = (day?: string) => DAY_GRADIENTS[normalizeDayKey(day)];
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

const generateServidoresPdf = async (title: string, subTitle: string, data: ServidorDetalle[]) => { 
  const personas: Persona[] = data.map(s => ({ nombre: `${s.nombre}${s.cedula ? ` — ${s.cedula}` : ''}`, telefono: s.telefono })); 
  const fullTitle = subTitle ? `${title} ${subTitle}` : title; 
  await generateContactosPdf(fullTitle, personas); 
};

function etiquetaEtapaModulo(etapa: string, modulo: number, dia: string) { if (!etapa) return `Módulo ${modulo}`; const base = etapa.trim().split(/\s+/)[0]; const nombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase(); return `${nombre} ${modulo} (${dia})`; }
const normalizeWs = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
const parseContactoKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^(.+?)\s+(\d+)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { etapa: normalizeWs(m[1]), modulo: parseInt(m[2], 10), dia: normalizeWs(m[3]) }; };
const parseServidorKey = (key: string) => { const k = normalizeWs(key); const m = k.match(/^([^-\n]+)-\s*(.+?)\s*\(([^)]+)\)\s*$/); if (!m) return null; return { rol: normalizeWs(m[1]), etapa: normalizeWs(m[2]), dia: normalizeWs(m[3]) }; };
const parseSortKey = (key: string) => { const k = normalizeWs(key); const match = k.match(/^(.+?)\s+(\d+)\s*\((.+)\)\s*$/); if (match) { const etapaNameParts = match[1].split(' '); const etapaName = etapaNameParts.length > 1 ? etapaNameParts.slice(0, -1).join(' ') : match[1]; return { etapa: etapaName, modulo: parseInt(match[2], 10), dia: match[3] }; } const simpleMatch = k.match(/(Semillas|Devocionales|Restauracion)\s+(\d+)/); if(simpleMatch) { return { etapa: simpleMatch[1], modulo: parseInt(simpleMatch[2], 10), dia: '' }; } return { etapa: k, modulo: 0, dia: '' }; };

/* ====================== Componentes Internos ===================== */
interface AgendadoGroup { key: string; items: AgendadoRow[]; }
const PremiumHorizontalBars = ({ data, onRowClick, onPdfClick, loadingPdfKey }: { data: AgendadoRow[]; onRowClick: (key: string) => void; onPdfClick: (key: string) => void; loadingPdfKey: string | null; }) => { 
    const [widths, setWidths] = useState<Record<string, number>>({});
    const parsedData = useMemo(() => data.map(d => { 
        const parts = d.etapa_modulo.split('(');
        const etapaModulo = normalizeWs(parts[0]);
        const dia = parts.length > 1 ? normalizeWs(parts[1].replace(')', '')) : '';
        return { key: d.etapa_modulo, value: d.agendados_pendientes, color: '#a78bfa', etapa_modulo: etapaModulo, dia };
     }), [data]);
    const maxValue = Math.max(...parsedData.map(d => d.value), 0);
    const groups = useMemo(() => parsedData.reduce((acc, row) => { 
        const groupKey = row.etapa_modulo;
        let group = acc.find(g => g.key === groupKey);
        if (!group) { group = { key: groupKey, items: [] as AgendadoRow[] }; acc.push(group); }
        const original = data.find(d => d.etapa_modulo === row.key);
        if (original) group.items.push(original); return acc;
     }, [] as AgendadoGroup[]).sort((a, b) => a.key.localeCompare(b.key)), [parsedData, data]);
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

interface AsistenciaGroup { key: string; items: AsistBarData[]; }
const AsistenciasHorizontalBars = ({ data, onDetalleClick, onPdfClick, loadingPdfKey, hoveredModuloKey }: { data: AsistBarData[]; onDetalleClick: (item: AsistBarData) => void; onPdfClick: (item: AsistBarData) => void; loadingPdfKey: string | null; hoveredModuloKey: string | null; }) => {
    const [widths, setWidths] = useState<Record<string, number>>({});
    const asistencias = useMemo(() => data.filter(d => d.type === 'asistencia'), [data]);
    const groups = useMemo(() => {
        return asistencias.reduce((acc, row) => { 
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
    }, [asistencias]);
    
    const maxValue = Math.max(...asistencias.map(d => d.value), 0);
    const asistGradients = SHARED_BAR_GRADIENTS;
    
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
            const isGroupDimmed = hoveredModuloKey && group.key !== hoveredModuloKey;
            return (
            <div key={group.key} className={`space-y-1 py-1 transition-opacity duration-300 ${isGroupDimmed ? 'opacity-30' : 'opacity-100'}`}>
                <h4 className="text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
                {group.items.map((d, i) => {
                    const defaultGradient = asistGradients[asistenciaIndex++ % asistGradients.length];
                    const dayGradient = getDayGradient(d.dia) || defaultGradient;
                    const currentPdfKey = `${d.etapa}-${d.modulo}-${d.dia}-${d.asistio}`;
                  return ( 
                    <div key={d.label} className="grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3"> 
                      <div className={`text-xs sm:text-sm text-left ${getDayTextClass(d.dia)} truncate`}>{d.dia}</div> 
                      <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 rounded-full`} 
                          style={{ width: `${widths[d.label] || 0}%`, background: dayGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} />
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

const InasistenciasPanel = ({ data, onDetalleClick, onPdfClick, loadingPdfKey, hoveredModuloKey }: { data: AsistBarData[]; onDetalleClick: (item: AsistBarData) => void; onPdfClick: (item: AsistBarData) => void; loadingPdfKey: string | null; hoveredModuloKey: string | null; }) => {
    const [widths, setWidths] = useState<Record<string, number>>({});
    const inasistencias = useMemo(() => data.filter(d => d.type === 'inasistencia'), [data]);
    const totalInasistencias = inasistencias.reduce((sum, d) => sum + d.value, 0);
    const generalInasistencia = inasistencias.find(d => d.etapa === 'General');
    const inasistenciasDetalle = inasistencias.filter(d => d.etapa !== 'General');
    const groups = useMemo(() => inasistenciasDetalle.reduce((acc, row) => { 
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
      }), [inasistenciasDetalle]);
    const maxValue = Math.max(...inasistencias.map(d => d.value), 1);
    const inasistGradient = "linear-gradient(90deg, #fb7185, #ef4444)";
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
                const isGroupDimmed = hoveredModuloKey && group.key !== hoveredModuloKey;
                return (
                <div key={group.key} className={`space-y-1 py-1 transition-opacity duration-300 ${isGroupDimmed ? 'opacity-30' : 'opacity-100'}`}>
                    <h4 className="text-sm font-bold text-slate-700 ml-1">{group.key}</h4>
                    {group.items.map((d, i) => {
                      const currentPdfKey = `${d.etapa}-${d.modulo}-${d.dia}-${d.asistio}`;
                      const defaultGradient = inasistGradient;
                      const dayGradient = getDayGradient(d.dia) || defaultGradient;
                      return ( 
                            <div key={d.label} className={`grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3`}> 
                                <div className={`text-xs sm:text-sm text-left ${getDayTextClass(d.dia)} truncate`}>{d.dia}</div>
                                <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden">
                                  <div className={`absolute inset-y-0 left-0 rounded-full`} 
                                    style={{ width: `${widths[d.label] || 0}%`, background: dayGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} />
                                </div>
                                <div className="flex items-center space-x-2 w-[52px]"> {d.value > 0 && ( <> <button onClick={() => onDetalleClick(d)} className="text-slate-400 hover:text-rose-700 transition-colors" title={`Consultar inasistentes de ${d.label}`}> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {loadingPdfKey === currentPdfKey ? ( <div className="w-5 h-5 flex items-center justify-center"> <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(d)} className="text-slate-400 hover:text-rose-600 transition-colors" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> )} </> )} </div>
                             </div> 
                        );
                    })}
                </div>
            )})}
            {generalInasistencia && ( <div key={generalInasistencia.label} className={`grid grid-cols-[1.5fr_1.5fr_auto_auto] items-center gap-x-2 pl-3 pt-3 mt-2 border-t border-slate-300`}> <div className={`text-sm sm:text-base font-extrabold text-rose-700 text-left truncate`}>{generalInasistencia.label}</div> <div className="relative h-4 w-full bg-slate-200/60 rounded-full overflow-hidden"> <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: '100%', opacity: 0.5, background: inasistGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> </div> <div className="text-sm tabular-nums w-8 text-left font-extrabold text-rose-700">{generalInasistencia.value}</div> <div className="w-[52px]"></div> </div> )}
        </div>
    );
};

// (Modales y Componentes de Contactos/Servidores sin cambios significativos)
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
    return ( <div className="flex flex-col gap-4 w-full"> {chunkedGroups.map((rowOfGroups, rowIndex) => ( <div key={rowIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {rowOfGroups.map((group) => { const groupTotal = group.items.reduce((sum, item) => sum + item.value, 0); return ( <div key={group.key} className="p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 ring-1 ring-white/8 shadow-lg shadow-black/20 transition-all duration-300 hover:shadow-black/25"> <div className="flex justify-between items-center border-b border-white/6 pb-2 mb-3"> <h3 className="text-lg font-bold text-slate-800">{group.key}</h3> <div className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-extrabold text-slate-700 tabular-nums" style={{ background: 'linear-gradient(145deg, #e6e6e6, #ffffff)', boxShadow: '4px 4px 8px #cccccc, -4px -4px 8px #ffffff', color: '#475569', fontWeight: 'bold' }}>{groupTotal}</div> </div> <div className="flex flex-row space-x-3 items-center"> {group.items.map((row, i) => { const parsed = parseContactoKey(row.key)!; const currentPdfKey = row.key; const defaultGradient = premiumLightGradients[i % premiumLightGradients.length]; const dayGradient = getDayGradient(parsed.dia) || defaultGradient; const dayTextClass = getDayTextClass(parsed.dia); return ( <div key={row.key} className="flex-1 min-w-0 flex flex-col space-y-1 items-center"> <span className={`text-xs font-semibold ${dayTextClass} truncate uppercase`}>{parsed.dia}</span> <div className="relative h-5 w-full bg-slate-200/70 rounded-full overflow-hidden flex items-center shadow-inner shadow-black/10"> <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: `${widths[row.key] || 0}%`, background: dayGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> <span className="absolute right-2 font-extrabold text-white text-sm tabular-nums" style={{ textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)' }}>{row.value}</span> </div> <div className="flex items-center justify-center space-x-1 w-full mt-1"> <button onClick={() => onRowClick(row.key)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Consultar detalles"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {onPdfClick && (loadingPdfKey === currentPdfKey ? ( <div className="w-4 h-4 flex items-center justify-center"> <svg className="animate-spin h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(row.key)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> ))} </div> </div> ); })} </div> </div> ); })} </div> ))} <div className="flex justify-end pt-3 pr-2 text-lg font-bold text-slate-800 border-t border-slate-200 mt-4"> {title}: <span className="tabular-nums ml-2">{total}</span> </div> </div> );
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
    return ( <div className="flex flex-col gap-4 w-full"> {groups.map((group, groupIndex) => ( <div key={group.key} className="bg-white/80 backdrop-blur-xl rounded-2xl ring-1 ring-white/70 shadow-2xl shadow-slate-300/60 transition-all duration-300 hover:shadow-slate-400/70 overflow-hidden"> <div className="px-4 py-3 text-slate-800 font-extrabold text-lg border-b border-slate-200/80 bg-slate-100/50">{group.key}</div> <div className="flex flex-col divide-y divide-slate-200/50 p-3"> {group.items.map((row, i) => { const parsedServidor = parseServidorKey(row.key)!; const keyWithoutRole = normalizeWs(row.key.replace(rolePrefix, '')); const parsedKey = parseContactoKey(keyWithoutRole) || parseSortKey(keyWithoutRole); const defaultGradient = premiumLightGradients[i % premiumLightGradients.length]; const dayGradient = getDayGradient(parsedKey.dia) || defaultGradient; const dayTextClass = getDayTextClass(parsedKey.dia); const currentPdfKey = row.key; const diaDisplay = parsedKey.dia ? `${parsedKey.dia}` : ''; return ( <div key={row.key} className="grid grid-cols-[3fr_1.5fr_auto] items-center gap-x-3 py-2 text-sm"> <div className="font-medium text-slate-700 truncate" title={`${parsedServidor.rol} (${diaDisplay})`}> <span className={`${dayTextClass} font-normal`}>{diaDisplay}</span> </div> <div className="relative h-5 w-full bg-slate-200/70 rounded-full overflow-hidden flex items-center justify-end pr-1 shadow-inner shadow-black/10"> <div className={`absolute inset-y-0 left-0 rounded-full`} style={{ width: `${widths[row.key] || 0}%`, background: dayGradient, transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)' }} /> <span className="absolute right-2 font-extrabold text-white text-sm tabular-nums" style={{ textShadow: '0 0 4px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)' }}>{row.value}</span> </div> <div className="flex items-center justify-end space-x-1 w-[40px]"> <button onClick={() => onRowClick(row.key)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-50" title="Consultar detalles"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> </button> {onPdfClick && (loadingPdfKey === currentPdfKey ? ( <div className="w-5 h-5 flex items-center justify-center"> <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> </div> ) : ( <button onClick={() => onPdfClick(row.key)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50" title="Descargar PDF"> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> </button> ))} </div> </div> ); })} </div> </div> ))} <div className="flex justify-end pt-3 pr-2 text-lg font-bold text-slate-800 border-t border-slate-200 mt-4"> {baseTitle}: <span className="tabular-nums ml-2">{total}</span> </div> </div> );
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
  valor,
}: DetalleSeccionesProps) {
  const [view, setView] = useState<string | null>(defaultKey || null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIsLoading, setModalIsLoading] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; data: Persona[]; premium?: boolean }>({ title: '', data: [] });
  const [servidoresModalOpen, setServidoresModalOpen] = useState(false);
  const [servidoresModalIsLoading, setServidoresModalIsLoading] = useState(false);
  const [servidoresModalContent, setServidoresModalContent] = useState<{ title: string; subTitle: string; data: ServidorDetalle[]; premium?: boolean }>({ title: '', subTitle: '', data: [] });
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);

  const [hoveredModuloKey, setHoveredModuloKey] = useState<string | null>(null); 
  const [hoveredEtapaKey, setHoveredEtapaKey] = useState<string | null>(null);   

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

  // MEJORA 4: Lógica asíncrona real para PDF
  const handleContactPdfDownload = async (key: string) => { 
      setPdfLoadingKey(key); 
      try { 
          const parsed = parseContactoKey(key); 
          if (!parsed) throw new Error("Invalid contact key"); 
          const { etapa, modulo, dia } = parsed; 
          const personas = await getContactosPorFiltro(etapa, modulo, dia); 
          await generateContactosPdf(`Contactos de ${normalizeWs(key)}`, personas); 
      } catch (error) { console.error("Error generating contact PDF:", error); } 
      finally { setPdfLoadingKey(null); } 
  };

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
    try { 
        const parsed = parseContactoKey(key); 
        if (!parsed) throw new Error("Invalid contact key"); 
        const { etapa, modulo, dia } = parsed; 
        const personas = await getActivosPorFiltro(etapa, modulo, dia); 
        await generateContactosPdf(`Contactos de ${normalizeWs(key)}`, personas); 
    } 
    catch (error) { console.error("Error generating active contact PDF:", error); } 
    finally { setPdfLoadingKey(null); } 
  };

  const handleServidorRowClick = async (key: string) => { const parsed = parseServidorKey(key); if (!parsed) { console.error("Invalid server key:", key); return; } const { rol, etapa, dia } = parsed; const titleMapping: { [key: string]: string } = { 'Maestros': 'Coordinadores', 'Contactos': 'Timoteos' }; const modalTitle = titleMapping[rol] || rol; setServidoresModalOpen(true); setServidoresModalIsLoading(true); setServidoresModalContent({ title: modalTitle, subTitle: `de ${etapa} (${dia})`, data: [], premium: true }); try { const servidores = await getServidoresPorFiltro(rol, etapa, dia); setServidoresModalContent(prev => ({ ...prev, data: servidores, premium: true })); } catch (error) { console.error("Error fetching server details:", error); setServidoresModalContent(prev => ({ ...prev, subTitle: 'Error al cargar los datos', premium: true })); } finally { setServidoresModalIsLoading(false); } };
  
  const handleServidorPdfDownload = async (key: string) => { setPdfLoadingKey(key); try { const parsed = parseServidorKey(key); if (!parsed) { throw new Error("Invalid server key"); } const { rol, etapa, dia } = parsed; const titleMapping: { [key: string]: string } = { 'Maestros': 'Coordinadores', 'Contactos': 'Timoteos' }; const pdfTitle = titleMapping[rol] || rol; const pdfSubTitle = `de ${etapa} (${dia})`; const servidores = await getServidoresPorFiltro(rol, etapa, dia); await generateServidoresPdf(pdfTitle, pdfSubTitle, servidores); } catch (error) { console.error("Error generating server PDF:", error); } finally { setPdfLoadingKey(null); } };
  
  const handleAsistenciaDetalleClick = async (item: AsistBarData) => {
    const { etapa, modulo, dia, asistio } = item;
    const title = `${asistio ? 'Asistentes' : 'Inasistentes'} de ${etiquetaEtapaModulo(etapa, modulo, dia)}`;
    setModalOpen(true); setModalIsLoading(true); setModalContent({ title, data: [], premium: true });
    try { 
      const personas = await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio, range, valor); 
      setModalContent({ title, data: personas, premium: true }); 
    } 
    catch (error) { console.error("Error fetching attendance details:", error); setModalContent(prev => ({ ...prev, title: `Error al cargar ${etapa}`, premium: true })); } 
    finally { setModalIsLoading(false); }
  };

  const handleAsistenciaPdfClick = async (item: AsistBarData) => {
    const { etapa, modulo, dia, asistio } = item;
    const loadingKey = `${etapa}-${modulo}-${dia}-${asistio}`;
    setPdfLoadingKey(loadingKey);
    try { 
      const title = `${asistio ? 'Asistentes' : 'Inasistentes'} de ${etiquetaEtapaModulo(etapa, modulo, dia)}`; 
      const personas = await getAsistentesPorEtapaFiltro(etapa, modulo, dia, asistio, range, valor); 
      await generateContactosPdf(title, personas); 
    } 
    catch (error) { console.error(`Error generating PDF for ${etapa}:`, error); } 
    finally { setPdfLoadingKey(null); }
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

  const totalAgend = agendados.reduce((s, r) => s + (r.agendados_pendientes || 0), 0);
  
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
  useEffect(() => { const handler = (e: MouseEvent) => { const target = (e.target as HTMLElement).closest("[data-key]"); if (target) startTransition(() => setView(target.getAttribute("data-key"))); }; document.addEventListener("click", handler); return () => document.removeEventListener("click", handler); }, []);
  
  const [animatedTotal, setAnimatedTotal] = useState(0);
  useEffect(() => { 
      const target = totalAsist;
      let raf = 0; const start = performance.now(); const dur = 800;
      const tick = (now: number) => { const t = Math.min((now - start) / dur, 1); setAnimatedTotal(Math.round(target * t)); if (t < 1) raf = requestAnimationFrame(tick); };
      requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [totalAsist]); 

  const etapaOrder: { [key: string]: number } = { 'Semillas': 1, 'Devocionales': 2, 'Restauracion': 3, 'Consolidacion': 4, 'Discipulado': 5, 'Liderazgo': 6 };
  const genericSort = (a: BarChartData, b: BarChartData, keyPrefix: string) => { const aKey = normalizeWs(a.key.replace(keyPrefix, '')); const bKey = normalizeWs(b.key.replace(keyPrefix, '')); const aParsed = parseSortKey(aKey); const bParsed = parseSortKey(bKey); const etapaOrderA = etapaOrder[aParsed.etapa] || 99; const etapaOrderB = etapaOrder[bParsed.etapa] || 99; if (etapaOrderA !== etapaOrderB) { return etapaOrderA - etapaOrderB; } if (aParsed.modulo !== bParsed.modulo) { return aParsed.modulo - bParsed.modulo; } return aKey.localeCompare(bKey); };
  
  const maestrosData = useMemo(() => servidoresPorRolEtapaDia.filter(d => d.key.startsWith('Maestros')).sort((a,b) => genericSort(a,b, 'Maestros -')), [servidoresPorRolEtapaDia]);
  const timoteosData = useMemo(() => servidoresPorRolEtapaDia.filter(d => d.key.startsWith('Contactos')).sort((a,b) => genericSort(a,b, 'Contactos -')), [servidoresPorRolEtapaDia]);
  const sortedContactosData = useMemo(() => [...contactosPorEtapaDia].sort((a,b) => genericSort(a,b, '')), [contactosPorEtapaDia]);

  return (
    <>
      <style jsx>{`.agendados-container, .asistencias-container, .contactos-container, .servidores-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; align-items: start; } @media (min-width: 1024px) { .servidores-container { grid-template-columns: 1fr 1fr; } .asistencias-container { grid-template-columns: 1fr 1fr; gap: 0.75rem; } }`}</style>
      <ContactosDetalleModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalContent.title} data={modalContent.data} isLoading={modalIsLoading} premium={modalContent.premium} />
      <ServidoresDetalleModal isOpen={servidoresModalOpen} onClose={() => setServidoresModalOpen(false)} title={servidoresModalContent.title} subTitle={servidoresModalContent.subTitle} data={servidoresModalContent.data} isLoading={servidoresModalIsLoading} premium={servidoresModalContent.premium} />
      
      <div className="overflow-x-hidden overflow-y-visible mt-6">
        {!view && ( <div className="grid premium-grid"><section className="card span-2 animate-fadeIn premium-glass p-4"><h2 className="card-title">Bienvenido</h2><p className="text-muted">Selecciona una tarjeta KPI para ver detalles.</p></section></div> )}
        
        {view === "asistencias" && (
          <div className="asistencias-container">
            <section className="card premium-glass animate-slideIn flex flex-col overflow-hidden self-stretch">
                <div className="px-4 py-3 border-b border-slate-200/80 flex-shrink-0">
                    <h2 className="text-base font-semibold text-slate-700">Resumen General por Módulo</h2>
                </div>
                
                <div className="panel-body px-1 py-4 flex-shrink-0">
                    <div className="relative mx-auto w-full aspect-square max-h-[320px] overflow-x-hidden overflow-y-visible flex items-center justify-center"> 
                        {/* DonutChartModule se carga dinámicamente */}
                        <DonutChartModule 
                          data={donutChartData}
                          onHover={(baseName: string | null, etapa: string | null) => {
                            setHoveredModuloKey(baseName);
                            setHoveredEtapaKey(etapa);
                          }}
                          hoveredModuloKey={hoveredModuloKey}
                          colors={ETAPA_BASE_COLORS}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none donut-center px-1">
                            <p className="text-3xl leading-tight font-extrabold text-gray-900 tabular-nums">{animatedTotal.toLocaleString()}</p>
                            <p className="text-gray-500 text-sm mt-0.5">Total</p>
                        </div>
                    </div>
                </div>

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
                        <div 
                          key={i} 
                          className={`premium-table-row premium-table-item transition-opacity duration-300 ${
                            hoveredEtapaKey ? (hoveredEtapaKey === row.etapa ? 'opacity-100' : 'opacity-30') : 'opacity-100'
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

            <section className="flex flex-col space-y-4 self-stretch">
                <div className="card premium-glass animate-slideIn flex flex-col overflow-hidden flex-grow">
                    <div className="px-4 py-3 border-b border-slate-200/80 flex-shrink-0"><h2 className="text-base font-semibold text-slate-700">Detalle por Módulo (Asist.)</h2></div>
                    <div className="panel-body p-3 flex-grow overflow-y-auto">
                      <AsistenciasHorizontalBars 
                        data={asistenciasChartData}
                        onDetalleClick={handleAsistenciaDetalleClick}
                        onPdfClick={handleAsistenciaPdfClick}
                        loadingPdfKey={pdfLoadingKey}
                        hoveredModuloKey={hoveredModuloKey} 
                      />
                    </div>
                </div>

                <div className="card premium-glass animate-slideIn flex flex-col overflow-hidden flex-grow">
                    <div className="px-4 py-3 border-b border-rose-200/80 bg-rose-50/50 flex-shrink-0"><h2 className="text-base font-semibold text-rose-700">Reporte Detallado de Inasistencias</h2></div>
                    <div className="panel-body p-3 flex-grow overflow-y-auto">
                      <InasistenciasPanel
                        data={inasistenciasChartData}
                        onDetalleClick={handleAsistenciaDetalleClick}
                        onPdfClick={handleAsistenciaPdfClick}
                        loadingPdfKey={pdfLoadingKey}
                        hoveredModuloKey={hoveredModuloKey} 
                      />
                    </div>
                </div>
            </section>
          </div>
        )}

        {view === "agendados" && ( <div className="agendados-container"> <section className="agendados-grafico card premium-glass animate-slideIn p-4"> <div className="card-head flex justify-between items-center"><h2 className="card-title">Agendados por semana</h2><div className="text-right chart-meta"><p className="card-meta-label text-lg font-semibold">Total agendados</p><p className="card-meta-value tabular-nums">{totalAgend.toLocaleString()}</p></div></div><div className="panel-body py-2 px-4"><PremiumHorizontalBars data={agendados} onRowClick={handleContactRowClick} onPdfClick={handleContactPdfDownload} loadingPdfKey={pdfLoadingKey} /></div> </section> <section className="agendados-detalle card premium-glass animate-slideIn p-4"> <div className="card-head pb-0"><h2 className="card-title">Detalle por etapa/módulo</h2></div><div className="panel-body px-0 py-0"><div className="premium-table-row premium-table-header two-cols"><span>Etapa · Módulo</span><span className="text-right">Agendados</span></div>{agendados.map((row, i) => (<div key={i} className="premium-table-row premium-table-item two-cols"><span className="font-medium text-slate-700">{row.etapa_modulo}</span><span className="text-right font-semibold text-gray-800 tabular-nums">{row.agendados_pendientes}</span></div>))}<div className="premium-table-row premium-table-total two-cols"><span>Total</span><span className="text-right tabular-nums">{totalAgend}</span></div></div> </section> </div> )}
        {view === "contactos" && ( <div className="contactos-container animate-slideIn justify-center"> <div className="w-full lg:max-w-4xl xl:max-w-6xl"> <section className="card premium-glass self-start flex flex-col overflow-hidden"> <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Contactos Activos</h2></div> <div className="panel-body p-5"> <MinimalistContactCard data={sortedContactosData} title="Total de Contactos Activos" onRowClick={handleActivosRowClick} onPdfClick={handleActivosPdfDownload} loadingPdfKey={pdfLoadingKey} /> </div> </section> </div> </div> )}
        {view === "servidores" && ( <div className="servidores-container animate-slideIn"> <section className="card premium-glass self-start flex flex-col overflow-hidden"> <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Coordinadores</h2></div> <div className="panel-body p-4"> <GroupedStyledList data={maestrosData} baseTitle="Total de Coordinadores" rolePrefix="Maestros -" onRowClick={handleServidorRowClick} onPdfClick={handleServidorPdfDownload} loadingPdfKey={pdfLoadingKey} /> </div> </section> <section className="card premium-glass self-start flex flex-col overflow-hidden"> <div className="px-4 py-3 border-b border-slate-200/80"><h2 className="text-base font-semibold text-slate-700">Detalle de Timoteos</h2></div> <div className="panel-body p-4"> <GroupedStyledList data={timoteosData} baseTitle="Total de Timoteos" rolePrefix="Contactos -" onRowClick={handleServidorRowClick} onPdfClick={handleServidorPdfDownload} loadingPdfKey={pdfLoadingKey} /> </div> </section> </div> )}
      </div>
    </>
  );
}