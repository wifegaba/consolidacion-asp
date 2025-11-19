'use client';

import { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
// import { getPersonaIdDesdeProgreso, getObservacionesPersona } from '@/lib/api'; // (No usado en el código original, lo dejo comentado igual)
import dynamic from 'next/dynamic';
// MEJORA 1: Eliminados imports estáticos pesados para Lazy Loading
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import * as XLSX from 'xlsx';
import { useToast } from '@/components/ToastProvider';

const PersonaNueva = dynamic(() => import('@/app/panel/contactos/FormularioPersonaNueva'), { ssr: false });
const Servidores = dynamic(() => import('@/app/panel/servidores/page'), { ssr: false });
import { motion, AnimatePresence } from "framer-motion";

/* ================= Tipos ================= */
type Dia = 'Domingo' | 'Martes' | 'Virtual';
type Semana = 1 | 2 | 3;

type Resultado =
  | 'no_contesta'
  | 'no_por_ahora'
  | 'llamar_de_nuevo'
  | 'confirmo_asistencia'
  | 'salio_de_viaje'
  | 'ya_esta_en_ptmd'
  | 'no_tiene_transporte'
  | 'vive_fuera'
  | 'murio'
  | 'rechazado'
  | 'buzon_de_voz'
  | 'otro';

type AsigMaestro = {
  etapa: string;
  dia: Dia;
  vigente: boolean;
};
      
type MaestroAsignacion = {
  etapaDet: string;
  etapaBase: 'Semillas' | 'Devocionales' | 'Restauracion';
  modulo: 1 | 2 | 3 | 4;
  dia: Dia;
};

type PendienteRow = {
  progreso_id: string;
  nombre: string;
  telefono: string | null;
  llamada1?: Resultado | null;
  llamada2?: Resultado | null;
  llamada3?: Resultado | null;
   habilitado_desde?: string | null;
};
type PendRowUI = PendienteRow & { _ui?: 'new' | 'changed' };

type AgendadoRow = {
  progreso_id: string;
  nombre: string;
  telefono: string | null;
  semana: number;
};
   
// === Transición estilo Dribbble (Shared Axis X) ===
// const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]; // No usado explícitamente, comentado.
// const DUR_IN = 0.24;
// const DUR_OUT = 0.18;

// Hook para dirección (→ abrir, ← volver)
function useDirection<T>(value: T | null | undefined) {
  const prev = useRef<T | null | undefined>(value);
  const dir = useRef<1 | -1>(1);
  useEffect(() => {
    if (prev.current == null && value != null) dir.current = 1;       
    else if (prev.current != null && value == null) dir.current = -1; 
    else if (prev.current !== value) dir.current = 1;                 
    prev.current = value;
  }, [value]);
  return dir.current;
}

const MAC2025_PANEL_VARIANTS = {
  initial: {
    opacity: 0,
    y: 48,
    scale: 0.98,
    filter: 'blur(10px)',
    boxShadow: '0 12px 36px -12px rgba(30,41,59,0.10)'
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    boxShadow: '0 24px 80px -24px rgba(30,41,59,0.18)',
    transition: {
      duration: 0.32
    }
  },
  exit: {
    opacity: 0,
    y: -32,
    scale: 0.97,
    filter: 'blur(8px)',
    boxShadow: '0 12px 36px -12px rgba(30,41,59,0.08)',
    transition: { duration: 0.22 }
  }
};
           
/** ======== Banco Archivo ======== */
type BancoRow = {
  progreso_id: string;
  persona_id: string;
  nombre: string;
  telefono: string | null;
  modulo: 1 | 2 | 3 | 4 | null;
  semana: number | null;
  dia: Dia;
  creado_en: string;
  etapa: 'Semillas' | 'Devocionales' | 'Restauracion';
};

/* ================= Constantes ================= */
const V_PEND_HIST   = 'v_llamadas_pendientes_hist';
const V_PEND_BASE   = 'v_llamadas_pendientes';
const V_AGENDADOS   = 'v_agendados';
const RPC_GUARDAR_LLAMADA = 'fn_guardar_llamada';
const RPC_ASIST     = 'fn_marcar_asistencia';

/** ======== Banco Archivo (constantes) ======== */
const V_BANCO = 'v_banco_archivo';
const RPC_REACTIVAR = 'fn_reactivar_desde_archivo';

// Duraciones UI centralizadas
const NEW_UI_MS = 5000;
const CHANGED_UI_MS = 3000;

const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;
const EASE_EXIT = [0.7, 0, 0.84, 0] as const;

const resultadoLabels: Record<Resultado, string> = {
  confirmo_asistencia: 'CONFIRMÓ ASISTENCIA',
  no_contesta: 'NO CONTESTA',
  no_por_ahora: 'NO POR AHORA',
  llamar_de_nuevo: 'LLAMAR DE NUEVO',
  salio_de_viaje: 'SALIO DE VIAJE',
  ya_esta_en_ptmd: 'YA ESTÁ EN PTMD',
  no_tiene_transporte: 'NO TIENE $ TRANSPORTE',
  vive_fuera: 'VIVE FUERA DE LA CIUDAD',
  murio: 'MURIÓ',
  rechazado: 'NO ME INTERESA',
  buzon_de_voz: 'BUZÓN DE VOZ',
  otro: 'OTRO',
};

const LEFT_PANEL_VARIANTS = {
  initial: { opacity: 0, x: 160, scale: 0.96, filter: 'blur(14px)' },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: EASE_SMOOTH }
  },
  exit: {
    opacity: 0,
    x: -110,
    scale: 0.97,
    filter: 'blur(10px)',
    transition: { duration: 0.45, ease: EASE_EXIT }
  }
};

const MODAL_BACKDROP_VARIANTS = {
  initial: { opacity: 0, backdropFilter: 'blur(0px)' },
  animate: {
    opacity: 1,
    backdropFilter: 'blur(18px)',
    transition: { duration: 0.6, ease: EASE_SMOOTH }
  },
  exit: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
    transition: { duration: 0.45, ease: EASE_EXIT }
  }
};

const MODAL_PANEL_VARIANTS = {
  initial: {
    opacity: 0,
    y: 56,
    scale: 0.9,
    rotateX: 8,
    filter: 'blur(26px)',
    transformPerspective: 1400
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transformPerspective: 1400,
    transition: { duration: 0.65, ease: EASE_SMOOTH }
  },
  exit: {
    opacity: 0,
    y: -40,
    scale: 0.94,
    rotateX: -6,
    filter: 'blur(22px)',
    transformPerspective: 1400,
    transition: { duration: 0.5, ease: EASE_EXIT }
  }
};

const LIST_WRAPPER_VARIANTS = {
  initial: {
    transition: { staggerChildren: 0.035, staggerDirection: -1 }
  },
  animate: {
    transition: { delayChildren: 0.12, staggerChildren: 0.055 }
  }
};

const LIST_ITEM_VARIANTS = {
  initial: { opacity: 0, x: 28, y: 14, scale: 0.97 },
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_SMOOTH }
  }
};

// MEJORA 2: Componente Memoizado para la Lista (Evita re-renders masivos)
const PendienteItem = memo(({ 
  c, 
  selectedId, 
  disabled, 
  onSelect 
}: { 
  c: PendRowUI, 
  selectedId: string | null, 
  disabled: boolean, 
  onSelect: (e: React.MouseEvent<HTMLLIElement>, c: PendRowUI) => void 
}) => {
  return (
    <motion.li
      variants={LIST_ITEM_VARIANTS}
      layout
      className={`px-4 md:px-5 py-3 transition
        ${selectedId === c.progreso_id ? 'bg-white/50' : ''}
        rounded-lg m-2 ring-2 ${c._ui === 'new' ? 'ring-emerald-300/60 animate-fadeInScale' : 'ring-transparent'}
        ${c._ui === 'changed' ? 'animate-flashBg' : ''}
        ${disabled ? 'opacity-55 cursor-not-allowed' : 'hover:bg-white/40 cursor-pointer'}
        transition-[box-shadow] duration-500`}
      onClick={(e) => onSelect(e, c)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
            c._ui === 'new'
              ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.25)] animate-newUiFade-5s'
              : (disabled
                  ? 'bg-neutral-300 shadow-[0_0_0_3px_rgba(156,163,175,.25)]'
                  : 'bg-gradient-to-r from-green-400 to-green-600 shadow-[0_0_0_3px_rgba(34,197,94,.25)]')
          }`} />
          <div className="min-w-0">
            <div className={`font-semibold leading-tight truncate ${
              disabled ? 'text-neutral-500' : 'text-neutral-900'
            }`}>
              {c.nombre}
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-neutral-700 text-xs md:text-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="opacity-80">
                <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
              </svg>
              <span className="truncate">{c.telefono ?? '—'}</span>
            </div>
            {c._ui === 'new' && (
              <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-emerald-800 bg-emerald-50 rounded-full px-2 py-0.5 ring-1 ring-emerald-200 animate-newUiFade-5s">
                Nuevo
              </span>
            )}
            {disabled && (
              <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-neutral-700 bg-neutral-100 rounded-full px-2 py-0.5 ring-1 ring-neutral-200">
                Disponible la próxima semana
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right text-[11px] md:text-xs text-neutral-700 leading-5">
          {[c.llamada1 ?? null, c.llamada2 ?? null, c.llamada3 ?? null].map((r, idx) => (
            <div key={idx}>
              <span className="mr-1">Llamada {idx + 1}:</span>
              {r ? (
                <span className="font-medium text-neutral-900">{resultadoLabels[r as Resultado]}</span>
              ) : (
                <span className="italic">sin registro</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.li>
  );
});
PendienteItem.displayName = 'PendienteItem';

/* ================= Helpers ================= */
const normalizeCedula = (s: string) => (s || '').trim();
const norm = (t: string) =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function mapEtapaDetToBase(etapaDet: string): {
  etapaBase: 'Semillas' | 'Devocionales' | 'Restauracion';
  modulo: 1 | 2 | 3 | 4;
  hasModulo: boolean;
} {
  const t = norm(etapaDet);

  if (t.startsWith('semilla')) {
    const num = Number((t.match(/\d+/)?.[0] ?? '1'));
    return { etapaBase: 'Semillas', modulo: Math.min(4, Math.max(1, num)) as 1 | 2 | 3 | 4, hasModulo: true };
  }

  if (t.startsWith('devocional')) {
    const num = Number((t.match(/\d+/)?.[0] ?? '1'));
    return { etapaBase: 'Devocionales', modulo: Math.min(4, Math.max(1, num)) as 1 | 2 | 3 | 4, hasModulo: true };
  }

  return { etapaBase: 'Restauracion', modulo: 1, hasModulo: false };
}

function matchAsigRow(
  row: any,
  asig: MaestroAsignacion,
  d: Dia | null,
  s: Semana | null
) {
  return (
    row &&
    d &&
    s &&
    row.dia === d &&
    row.semana === s &&
    row.etapa === asig.etapaBase &&
    (asig.etapaBase === 'Restauracion' || row.modulo === asig.modulo) &&
    row.activo !== false
  );
}

/* ================= Página ================= */
export default function MaestrosClient({ cedula: cedulaProp }: { cedula?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const cedula = normalizeCedula(cedulaProp ?? params?.get('cedula') ?? '');
  const rtDebug = (params?.get('rtlog') === '1') || (params?.get('debug') === '1');
  const rtLog = useCallback((...args: any[]) => { if (rtDebug) console.log('[RT maestros]', ...args); }, [rtDebug]);

  const [nombre, setNombre] = useState('');
  const [asig, setAsig] = useState<MaestroAsignacion | null>(null);

  const [semana, setSemana] = useState<Semana>(1);
  const [dia, setDia] = useState<Dia | null>(null);

  // llamadas
  const [loadingPend, setLoadingPend] = useState(false);
  const [pendientes, setPendientes] = useState<PendRowUI[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // asistencias
  const [loadingAg, setLoadingAg] = useState(false);
  const [agendados, setAgendados] = useState<AgendadoRow[]>([]);
  const [marks, setMarks] = useState<Record<string, 'A' | 'N' | undefined>>({});
  const [savingAg, setSavingAg] = useState(false);

  // Modal para registros inhabilitados
  const [showNextWeekModal, setShowNextWeekModal] = useState(false);
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number } | null>(null);

  /** ======== Banco Archivo (estado) ======== */
  const [bancoOpen, setBancoOpen] = useState(false);
  const [bancoLoading, setBancoLoading] = useState(false);
  const [bancoRows, setBancoRows] = useState<BancoRow[]>([]);
  const [reactivating, setReactivating] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [servidorId, setServidorId] = useState<string | null>(null);
  const [showReactivationConfirm, setShowReactivationConfirm] = useState(false);
  const [reactivationCandidate, setReactivationCandidate] = useState<BancoRow | null>(null);
  const [bancoPagina, setBancoPagina] = useState(0);
  const REGS_POR_PAGINA = 8;
  
  // Modales adicionales
  const [nuevaAlmaOpen, setNuevaAlmaOpen] = useState(false);
  const [servidoresOpen, setServidoresOpen] = useState(false);

  // Estado para desbloqueo temporal
  const [tempUnlocked, setTempUnlocked] = useState<Record<string, number>>({});

  // MEJORA 3: Estado 'now' global actualizado cada minuto para evitar new Date() en cada render de la lista
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // Actualiza cada min
    return () => clearInterval(interval);
  }, []);

  /**
   * Comprueba si un registro está inhabilitado.
   * Optimizado para usar timestamps numéricos y el estado 'now'.
   */
  const estaInhabilitado = useCallback((id: string, h?: string | null) => {
    const unlockExpiresAt = tempUnlocked[id];
    if (unlockExpiresAt) {
      if (now < unlockExpiresAt) { // Comparación numérica rápida
        return false; 
      } else {
        setTempUnlocked(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }
    }

    if (!h) return false;
    
    try {
      // Comparación numérica más eficiente
      const habilitadoTime = new Date(h).getTime();
      return now < habilitadoTime;
    } catch (e) {
      console.error("Error al parsear la fecha habilitado_desde:", h, e);
      return false;
    }
  }, [tempUnlocked, now]); 

  const semanaRef = useRef(semana);
  const diaRef = useRef<Dia | null>(dia);
  const asigRef = useRef<MaestroAsignacion | null>(asig);
  const pendRef = useRef<PendRowUI[]>(pendientes);
  const rightPanelRef = useRef<HTMLElement | null>(null);
  // const dir = useDirection(selectedId); // Comentado si no se usa

  useEffect(() => { semanaRef.current = semana; }, [semana]);
  useEffect(() => { diaRef.current = dia; }, [dia]);
  useEffect(() => { asigRef.current = asig; }, [asig]);
  useEffect(() => { pendRef.current = pendientes; }, [pendientes]);

  useEffect(() => {
    if (nuevaAlmaOpen || servidoresOpen) {
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
    }
  }, [nuevaAlmaOpen, servidoresOpen]);

  useEffect(() => {
    if (!selectedId) return;
    const isLgUp = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (isLgUp) return;
    try {
      rightPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  }, [selectedId]);

  const clearTimersRef = useRef<Record<string, number>>({});
  const scheduleClearUI = (id: string, ms = NEW_UI_MS) => {
    if (clearTimersRef.current[id]) window.clearTimeout(clearTimersRef.current[id]);
    clearTimersRef.current[id] = window.setTimeout(() => {
      setPendientes(prev => prev.map(p => p.progreso_id === id ? ({ ...p, _ui: undefined }) : p));
      delete clearTimersRef.current[id];
    }, ms);
  };

  const rtNewRef = useRef<Set<string>>(new Set());
  const toast = useToast();

  // MEJORA 1: Lazy Loading para funciones de descarga
  const downloadPDF = async () => {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(40, 58, 90);
    doc.text(`Contactos Pendientes por llamar Semana ${semana}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Nombre', 'Teléfono', 'Observaciones']],
      body: pendientes.map(p => [
        p.nombre, 
        p.telefono ?? '-', 
        [p.llamada1, p.llamada2, p.llamada3].filter(Boolean).map((r, i) => `Llamada ${i+1}: ${resultadoLabels[r as Resultado]}`).join('\n') || '-'
      ]),
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`contactos_pendientes_semana_${semana}.pdf`);
    toast.success('Archivo descargado exitosamente');
  };

  const downloadExcel = async () => {
    const XLSX = await import('xlsx');
    const ws_name = "Contactos Pendientes";
    const wb = XLSX.utils.book_new();
    
    const header = ["Nombre", "Teléfono", "Observaciones"];
    const data = pendientes.map((p: PendRowUI) => [
      p.nombre,
      p.telefono ?? '-',
      [p.llamada1, p.llamada2, p.llamada3].filter(Boolean).map((r, i) => `Llamada ${i+1}: ${resultadoLabels[r as Resultado]}`).join('\n') || '-'
    ]);

    toast.success('Archivo descargado exitosamente');

    const finalData = [
      [`Contactos Pendientes por llamar Semana ${semana}`],
      [],
      header,
      ...data
    ];

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

    if(ws['A1']) {
      ws['A1'].s = {
        font: {
          name: 'Arial',
          sz: 16,
          bold: true,
          color: { rgb: "FFFFFF" }
        },
        fill: {
          fgColor: { rgb: "2980b9" }
        },
        alignment: {
          horizontal: "center"
        }
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, ws_name);
    XLSX.writeFile(wb, `contactos_pendientes_semana_${semana}.xlsx`);
  };

  const downloadBancoPDF = async () => {
    if (!asig) return;
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(40, 58, 90);
    doc.text(`Banco Archivo - ${asig.etapaDet}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Nombre', 'Teléfono', 'Módulo', 'Semana', 'Día', 'Archivado']],
      body: bancoRows.map(r => [
        r.nombre,
        r.telefono ?? '-',
        r.modulo?.toString() ?? '-',
        r.semana?.toString() ?? '-',
        r.dia,
        new Date(r.creado_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      ]),
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`banco_archivo_${asig.etapaBase}_${asig.dia}.pdf`);
    toast.success('Archivo PDF del Banco Archivo descargado exitosamente');
  };

  const downloadBancoExcel = async () => {
    if (!asig) return;
    const XLSX = await import('xlsx');

    const ws_name = "Banco Archivo";
    const wb = XLSX.utils.book_new();
    
    const header = ["Nombre", "Teléfono", "Módulo", "Semana", "Día", "Archivado"];
    const data = bancoRows.map(r => [
        r.nombre,
        r.telefono ?? '-',
        r.modulo?.toString() ?? '-',
        r.semana?.toString() ?? '-',
        r.dia,
        new Date(r.creado_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
    ]);

    const finalData = [
      [`Banco Archivo - ${asig.etapaDet}`],
      [],
      header,
      ...data
    ];

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    if(ws['A1']) {
      ws['A1'].s = {
        font: { name: 'Arial', sz: 16, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2980b9" } },
        alignment: { horizontal: "center" }
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, ws_name);
    XLSX.writeFile(wb, `banco_archivo_${asig.etapaBase}_${asig.dia}.xlsx`);
    toast.success('Archivo Excel del Banco Archivo descargado exitosamente');
  };

  const downloadAsistenciasPDF = async () => {
    if (!asig) return;
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(40, 58, 90);
    doc.text(`Listado de Asistencias - ${asig.etapaDet}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Nombre', 'Teléfono', 'Semana']],
      body: agendados.map(a => [
        a.nombre,
        a.telefono ?? '-',
        a.semana.toString()
      ]),
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`asistencias_${asig.etapaBase}_${asig.dia}.pdf`);
    toast.success('Archivo PDF de Asistencias descargado exitosamente');
  };

  // Cargar asignación
  useEffect(() => {
    (async () => {
      if (!cedula) return;
      const { data, error } = await supabase
        .from('servidores')
        .select('id,nombre,asignaciones_maestro:asignaciones_maestro(etapa,dia,vigente)')
        .eq('cedula', cedula)
        .maybeSingle();

      if (error || !data) {
        router.replace('/login');
        return;
      }

      setNombre((data as any).nombre ?? '');
      setServidorId((data as any).id ?? null);

      const a = (data as any).asignaciones_maestro?.find((x: AsigMaestro) => x.vigente) as AsigMaestro | undefined;
      if (!a) {
        router.replace(`/bienvenida?cedula=${cedula}`);
        return;
      }
      const base = mapEtapaDetToBase(a.etapa);
      const asign: MaestroAsignacion = {
        etapaDet: a.etapa,
        etapaBase: base.etapaBase,
        modulo: base.modulo,
        dia: a.dia,
      };
      setAsig(asign);
      setDia(asign.dia);
    })();
  }, [cedula, router]);

  const titulo = useMemo(() => asig?.etapaDet ?? '', [asig]);

  /* ====== Fetchers ====== */
  const fetchPendientes = useCallback(
  async (s: Semana, d: Dia, opts?: { quiet?: boolean }) => {
    if (!asig) return;
    if (!opts?.quiet) setLoadingPend(true);

    const [{ data: hist, error: e1 }, { data: base, error: e2 }] = await Promise.all([
      supabase
        .from(V_PEND_HIST)
        .select('progreso_id,nombre,telefono,llamada1,llamada2,llamada3')
        .eq('semana', s)
        .eq('dia', d)
        .order('nombre', { ascending: true }),
      (async () => {
        let q = supabase
          .from(V_PEND_BASE)
          .select('progreso_id')
          .eq('etapa', asig.etapaBase)
          .eq('semana', s)
          .eq('dia', d);
        if (asig.etapaBase !== 'Restauracion') q = (q as any).eq('modulo', asig.modulo);
        const { data, error } = await q;
        return { data, error };
      })(),
    ]);

    if (e1) console.error('[pend-hist]', e1.message);
    if (e2) console.error('[pend-base]', e2.message);

    const allowed = new Set((base ?? []).map((r: any) => r.progreso_id));
    const draft = ((hist ?? []) as PendienteRow[]).filter((r) => allowed.has(r.progreso_id));

   let byId = new Map<string, string | null>();
    try {
      const ids = draft.map((r) => r.progreso_id);
      if (ids.length) {
        const { data: fechas, error: e3 } = await supabase.rpc('fn_progreso_hab_desde', { ids });
        if (e3) {
          console.error('[progreso fechas] ERROR', e3.message);
        } else {
          byId = new Map((fechas ?? []).map((f: any) => [f.id, f.habilitado_desde ?? null]));
        }
      }
    } catch (err: any) {}

    const prev = pendRef.current;
    const prevById = new Map(prev.map((p) => [p.progreso_id, p]));
    const next: PendRowUI[] = draft.map((r) => {
      const old = prevById.get(r.progreso_id);
      let _ui: 'new' | 'changed' | undefined;

      if (rtNewRef.current.has(r.progreso_id)) {
        _ui = 'new';
        rtNewRef.current.delete(r.progreso_id);
      } else if (!old) _ui = 'new';
      else if (
        old.llamada1 !== r.llamada1 ||
        old.llamada2 !== r.llamada2 ||
        old.llamada3 !== r.llamada3 ||
        old.nombre !== r.nombre ||
        old.telefono !== r.telefono
      ) {
        _ui = 'changed';
      }

      if (old?._ui === 'new' && clearTimersRef.current[r.progreso_id]) {
        _ui = 'new';
      }

      const mergedHabDesde = byId.get(r.progreso_id) ?? old?.habilitado_desde ?? null;
      return { ...r, habilitado_desde: mergedHabDesde, _ui };
    });
         
    setPendientes(next);
    next.forEach((r) => {
      if (!r._ui) return;
      if (!clearTimersRef.current[r.progreso_id]) {
        scheduleClearUI(r.progreso_id, r._ui === 'new' ? NEW_UI_MS : CHANGED_UI_MS);
      }
    });

    if (!opts?.quiet) setLoadingPend(false);
  },
  [asig]
);

  const fetchAgendados = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!asig || !asig.dia) return;
    if (!opts?.quiet) setLoadingAg(true);

    let q = supabase
      .from(V_AGENDADOS)
      .select('progreso_id,nombre,telefono,semana')
      .eq('etapa', asig.etapaBase)
      .eq('dia', asig.dia);
    if (asig.etapaBase !== 'Restauracion') q = (q as any).eq('modulo', asig.modulo);

    const { data } = await q.order('nombre', { ascending: true });
    setAgendados(((data ?? []) as AgendadoRow[]));
    if (!opts?.quiet) setLoadingAg(false);
  }, [asig]);

  useEffect(() => { if (dia) void fetchPendientes(semana, dia, { quiet: false }); }, [semana, dia, fetchPendientes]);
  useEffect(() => { void fetchAgendados({ quiet: false }); }, [fetchAgendados]);

  /* ====== Acciones ====== */
  const handleCloseModal = () => {
    setShowNextWeekModal(false);
    setModalTargetId(null);
    setModalPosition(null);
  };

  const handleTempUnlock = () => {
    if (!modalTargetId) return;
    const expirationTime = Date.now() + (60 * 60 * 1000); 
    setTempUnlocked(prev => ({ ...prev, [modalTargetId]: expirationTime }));
    handleCloseModal();
    setSelectedId(modalTargetId);
    toast.success('Registro desbloqueado por 1 hora.');
  };

  const enviarResultado = async (payload: { resultado: Resultado; notas?: string }) => {
    const row = pendRef.current.find((p) => p.progreso_id === selectedId);
    if (!row || !semana || !dia) return;

    const esConfirmado = payload.resultado === 'confirmo_asistencia';

    setAgendados((prev) => {
      const yaEsta = prev.some((a) => a.progreso_id === row.progreso_id);
      if (esConfirmado) {
        return yaEsta
          ? prev
          : [...prev, { progreso_id: row.progreso_id, nombre: row.nombre, telefono: row.telefono, semana }];
      } else {
        return prev.filter((a) => a.progreso_id !== row.progreso_id);
      }
    });

  setSaving(true);
      try {
        const { error } = await supabase.rpc(RPC_GUARDAR_LLAMADA, {
          p_progreso: row.progreso_id,
          p_semana: semana,
          p_dia: dia,
          p_resultado: payload.resultado,
          p_notas: payload.notas ?? null,
          p_hecho_por: servidorId,                                                                  
        });
      if (error) throw error;

      await Promise.all([
        fetchPendientes(semana, dia, { quiet: true }),
        fetchAgendados({ quiet: true }),
      ]);
      setSelectedId(null);
    } catch (e: any) {
      setAgendados((prev) => prev.filter((a) => a.progreso_id !== row.progreso_id));
      alert(e?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleMark = (id: string, tipo: 'A' | 'N') =>
    setMarks((m) => ({ ...m, [id]: m[id] === tipo ? undefined : tipo }));

  const handleRestauracionAsistencia = async (student: AgendadoRow) => {
    if (!student?.nombre) {
      console.error("Error: Se intentó registrar asistencia sin nombre de estudiante.", student);
      toast.error('Error: El estudiante no tiene nombre, no se puede procesar.');
      return false; 
    }

    const placeholderCedula = `TEMP_${crypto.randomUUID()}`;
    const payload = {
      nombre: student.nombre,
      telefono: student.telefono ?? null,
      cedula: placeholderCedula,
      created_by: servidorId, 
      notas: `Registro automático creado desde "Asistencia" (Restauración) el ${new Date().toISOString()}. Cédula pendiente de actualizar.`
    };
    try {
      const { error } = await supabase.from('entrevistas').insert(payload);
      if (error) {
        console.error("Error al crear entrevista desde Restauración:", error);
        toast.error(`Error al enviar a ${student.nombre} a Entrevistas.`);
        return false;
      }
      toast.success(`${student.nombre} enviado(a) al panel de Entrevistas.`);
      return true;
    } catch (e: any) {
      console.error(e?.message ?? 'Error inesperado en handleRestauracionAsistencia');
      toast.error('Error inesperado al guardar la entrevista.');
      return false;
    }
  };

  const enviarAsistencias = async () => {
    const entradas = Object.entries(marks).filter(([, v]) => v);
    if (entradas.length === 0) return;
    setSavingAg(true);
    
    try {
      for (const [progId, v] of entradas) {
        if (asig?.etapaBase === 'Restauracion' && v === 'A') {
          const student = agendados.find(a => a.progreso_id === progId);
          if (!student) continue;
          const exito = await handleRestauracionAsistencia(student);
          if (exito) {
            const { error: rpcError } = await supabase.rpc(RPC_ASIST, {
              p_progreso: progId,
              p_asistio: true,
            });
            if (rpcError) throw rpcError;
          }
        } else {
          const { error } = await supabase.rpc(RPC_ASIST, {
            p_progreso: progId,
            p_asistio: v === 'A',
          });
          if (error) throw error;
        }
      }
      setMarks({});
      await fetchAgendados({ quiet: true });
    } catch (e: any) {
      console.error("Error en enviarAsistencias:", e?.message);
      toast.error(`Error al procesar asistencias: ${e?.message}`);
    } finally {
      setSavingAg(false);
    }
  };

  /* ====== Realtime ====== */
  useEffect(() => {
    if (!asig) return;

    // ---- parches finos ----
    const tryPatchProgresoInsert = async (row: any) => {
      const a = asigRef.current;
      const d = diaRef.current;
      const s = semanaRef.current;
      if (!a) return;

      if (!matchAsigRow(row, a, d, s)) return;

      if (pendRef.current.some(p => p.progreso_id === row.id)) return;

      const { data: per } = await supabase
        .from('persona')
        .select('id,nombre,telefono')
        .eq('id', row.persona_id)
        .maybeSingle();

      const nuevo: PendRowUI = {
        progreso_id: row.id,
        nombre: per?.nombre ?? '—',
        telefono: per?.telefono ?? null,
        llamada1: null,
        llamada2: null,
        llamada3: null,
        habilitado_desde: row.habilitado_desde ?? null,
        _ui: 'new',
      };

      setPendientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      scheduleClearUI(row.id, NEW_UI_MS);
    };

    const tryPatchProgresoUpdate = async (oldRow: any, newRow: any) => {
      const a = asigRef.current;
      const d = diaRef.current;
      const s = semanaRef.current;
      if (!a) return;

      const oldMatch = matchAsigRow(oldRow, a, d, s);
      const newMatch = matchAsigRow(newRow, a, d, s);

      if (!oldMatch && newMatch) {
        if (!pendRef.current.some(p => p.progreso_id === newRow.id)) {
          const { data: per } = await supabase
            .from('persona')
            .select('id,nombre,telefono')
            .eq('id', newRow.persona_id)
            .maybeSingle();

          const nuevo: PendRowUI = {
            progreso_id: newRow.id,
            nombre: per?.nombre ?? '—',
            telefono: per?.telefono ?? null,
            llamada1: null,
            llamada2: null,
            llamada3: null,
            habilitado_desde: newRow.habilitado_desde ?? null,
            _ui: 'new',
          };
          setPendientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          scheduleClearUI(newRow.id, NEW_UI_MS);
        }
        return;
      }

      if (oldMatch && !newMatch) {
        setPendientes(prev => prev.filter(p => p.progreso_id !== newRow.id));
        if (selectedId === newRow.id) setSelectedId(null);
        return;
      }

      if (newMatch) refreshQuiet();
    };
                                                                                   
    let t: number | null = null;
    const refreshQuiet = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(async () => {
        const d = diaRef.current as Dia | null;
        const s = semanaRef.current as Semana;
        if (d) {
          await fetchPendientes(s, d, { quiet: true });
          await fetchAgendados({ quiet: true });
        }
      }, 150);
    };

    const channelName = `rt-maestros-${cedula}`;
    const ch = supabase.channel(channelName);

    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'progreso' }, (p: any) => {
      if (rtDebug) rtLog('ev:progreso', p?.eventType, { old: p?.old?.id, new: p?.new?.id });
    });

    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'progreso' }, async (payload) => {
      const id = payload.new?.id;
      if (!id) return;
      let row = payload.new as any;

      const needsFetch =
        row?.etapa == null ||
        row?.dia == null ||
        row?.semana == null ||
        (asigRef.current?.etapaBase !== 'Restauracion' && row?.modulo == null);

      if (needsFetch) {
        const { data } = await supabase.from('progreso').select('*').eq('id', id).maybeSingle();
        if (data) row = data;
      }
      await tryPatchProgresoInsert(row);
    });

    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'progreso' }, async (payload) => {
      if (payload.old && payload.new) {
        void tryPatchProgresoUpdate(payload.old, payload.new);
      } else {
        const id = (payload.new as any)?.id ?? (payload.old as any)?.id;
        if (!id) return refreshQuiet();
        const { data: row } = await supabase.from('progreso').select('*').eq('id', id).maybeSingle();
        if (row) void tryPatchProgresoUpdate(payload.old ?? {}, row);
        else refreshQuiet();
      }
    });

    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transition_log' }, async (payload) => {
      const progId = payload.new?.progreso_id;
      if (!progId) return;
      const { data: row } = await supabase.from('progreso').select('*').eq('id', progId).maybeSingle();
      if (row) await tryPatchProgresoUpdate({}, row);
      refreshQuiet();
    });

    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'llamada_intento' }, () => refreshQuiet());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => refreshQuiet());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'persona' }, () => refreshQuiet());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones_maestro' }, () => refreshQuiet());

    ch.subscribe((status) => {
      if (rtDebug) rtLog('channel:status', status);
      if (status === 'SUBSCRIBED') refreshQuiet();
    });

    return () => {
      ch.unsubscribe();
      if (t) window.clearTimeout(t);
      Object.values(clearTimersRef.current).forEach(id => window.clearTimeout(id));
      clearTimersRef.current = {};
    };
  }, [asig, cedula, fetchPendientes, fetchAgendados, rtDebug, rtLog, selectedId]);

  /* ========================= UI ========================= */
  if (!cedula) {
    return (
      <main className="min-h-[100dvh] grid place-items-center bg-[linear-gradient(135deg,#e0e7ff,#f5f3ff)]">
        <div className="rounded-2xl bg-white/60 backdrop-blur-xl px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/50 text-neutral-900">
          Error en las Credenciales
        </div>
      </main>
    );
  }

  if (!asig || !dia) {
    return (
      <main className="min-h-[100dvh] grid place-items-center bg-[linear-gradient(135deg,#e0e7ff,#f5f3ff)]">
        <div className="rounded-2xl bg-white/60 backdrop-blur-xl px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/50 text-neutral-900">
          Cargando asignación…
        </div>
      </main>
    );
  }

  return (
<main className="min-h-[100dvh] px-5 md:px-8 py-6 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(120,180,255,0.25),transparent),radial-gradient(900px_500px_at_110%_20%,rgba(96,165,250,0.20),transparent),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent),linear-gradient(120deg,#f7f8ff_0%,#eef0ff_35%,#f7f8ff_100%)] supports-[backdrop-filter]:backdrop-blur-2xl">

      <div className="mx-auto w-full max-w-[1260px]">
        {/* ===== Título ===== */}
        <section className="mb-6 md:mb-8">
          <div className="text-[32px] md:text-[44px] font-black leading-none tracking-tight bg-gradient-to-r from-sky-500 via-indigo-600 to-cyan-500 text-transparent bg-clip-text drop-shadow-sm">
            Panel de Coordinadores
          </div>
        </section>

        {/* ===== Encabezado ===== */}
        <header className="mb-3 md:mb-4 flex items-baseline gap-3 rounded-2xl px-4 py-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] ring-1 ring-white/60 backdrop-blur-xl bg-[radial-gradient(900px_220px_at_0%_-20%,rgba(125,211,252,0.12),transparent),radial-gradient(900px_240px_at_120%_-30%,rgba(165,180,252,0.1),transparent),linear-gradient(135deg,rgba(255,255,255,.90),rgba(255,255,255,.70))] supports-[backdrop-filter]:bg-[radial-gradient(900px_220px_at_0%_-20%,rgba(125,211,252,0.12),transparent),radial-gradient(900px_240px_at_120%_-30%,rgba(165,180,252,0.1),transparent),linear-gradient(135deg,rgba(255,255,255,.80),rgba(255,255,255,.60))]">
          <h1 className="text-[22px] md:text-[28px] font-semibold text-neutral-900">
            {nombre || 'Servidor'}
          </h1>
          <span className="text-neutral-700 text-sm">Coordinador - {titulo || '-'}
          </span>

          <button
            onClick={() => openBanco()}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-300 to-cyan-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(20,150,220,0.35)] px-3 py-1.5 text-sm font-semibold hover:scale-[1.02] active:scale-95 transition"
            title="Ver estudiantes archivados y reactivar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm5 1h8v10H8Z" fill="currentColor"/>
            </svg>
            Banco Archivo
          </button>
        </header>

        {/* Menú: semanas (1..3) y día bloqueado */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl px-3 py-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] ring-1 ring-white/60">
         <div className="inline-flex items-center gap-2">
  <span className="text-sm text-neutral-700">Semana:</span>
  {[1, 2, 3].map((n) => {
    const active = semana === (n as 1 | 2 | 3);
    return (
      <button
        key={n}
        onClick={() => setSemana(n as 1 | 2 | 3)}
        aria-pressed={active}
        className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition
          ring-1 focus:outline-none focus-visible:ring-2
          ${active
            ? 'bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-400 text-white ring-1 ring-white/60 shadow-[0_6px_18px_rgba(56,189,248,.35)] scale-[1.03]'
            : 'bg-white/40 text-slate-900 ring-white/60 hover:bg-white/60 hover:ring-white/70'
          }`}
        title={`Semana ${n}`}
      >
        {n}
      </button>
    );
  })}
</div>


          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-neutral-700">Día:</span>
            {(['Domingo', 'Martes', 'Virtual'] as Dia[]).map((d) => {
              const disabled = d !== asig.dia;
              return (
                <button
                  key={d}
                  disabled={disabled}
                  onClick={() => !disabled && setDia(d)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ring-1 ${
                    dia === d
                      ? 'bg-white/90 text-slate-900 ring-white/70 shadow'
                      : 'bg-white/40 text-slate-900 ring-white/60 hover:bg-white/60'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={disabled ? 'Solo puedes ver tu día asignado' : 'Cambiar día'}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setNuevaAlmaOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-300 to-cyan-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(20,150,220,0.35)] px-4 py-2 text-sm font-semibold hover:scale-[1.02] active:scale-95 transition"
              title="Registrar nueva alma"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" fill="currentColor"/>
              </svg>
              Nueva Alma
            </button>
            <button
              type="button"
              onClick={() => setServidoresOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-300 to-cyan-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(20,150,220,0.35)] px-4 py-2 text-sm font-semibold hover:scale-[1.02] active:scale-95 transition"
              title="Abrir formulario de Servidores"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6a2 2 0 0 1 2-2h5v2H6v12h5v2H6a2 2 0 0 1-2-2V6Zm10-2h4a2 2 0 0 1 2 2v3h-2V6h-4V4Zm4 9h2v3a2 2 0 0 1-2 2h-4v-2h4v-3Z" fill="currentColor"/>
              </svg>
              Servidores
            </button>
          </div>
        </div>

        {/* ===== Lista izquierda / Panel derecho ===== */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {/* Lista */}
<section className={`rounded-[20px] bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl shadow-[0_18px_44px_-18px_rgba(0,0,0,.35)] ring-1 ring-white/60 overflow-hidden ${selectedId ? 'hidden lg:block' : ''}`}>
  <header className="px-4 md:px-5 py-3 border-b border-white/50 backdrop-blur-xl bg-[radial-gradient(900px_200px_at_0%_-30%,rgba(125,211,252,0.1),transparent),radial-gradient(900px_240px_at_110%_-40%,rgba(165,180,252,0.1),transparent),linear-gradient(135deg,rgba(255,255,255,.85),rgba(255,255,255,.65))] supports-[backdrop-filter]:bg-[radial-gradient(900px_200px_at_0%_-30%,rgba(125,211,252,0.1),transparent),radial-gradient(900px_240px_at_110%_-40%,rgba(165,180,252,0.1),transparent),linear-gradient(135deg,rgba(255,255,255,.80),rgba(255,255,255,.55))] flex justify-between items-center">
    <div>
      <h3 className="text-base md:text-lg font-semibold text-neutral-900">Llamadas pendientes</h3>
      <p className="text-neutral-700 text-xs md:text-sm">
        {loadingPend ? 'Cargando…' : 'Selecciona un contacto para registrar la llamada.'}
      </p>
    </div>
<div className="flex items-center gap-2">
    <button
      onClick={downloadPDF}
  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-400 via-red-500 to-red-600 text-white ring-1 ring-white/50 shadow-[0_6px_20px_rgba(220,38,38,0.35)] px-2 py-1 text-xs font-medium hover:scale-[1.02] active:scale-95 transition"
      title="Descargar PDF de pendientes"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: '0.85em' }}>
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
      PDF
    </button>
    <button
      onClick={downloadExcel}
  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-green-400 via-green-500 to-green-600 text-white ring-1 ring-white/50 shadow-[0_6px_20px_rgba(34,197,94,0.35)] px-2 py-1 text-xs font-medium hover:scale-[1.02] active:scale-95 transition"
      title="Descargar Excel de pendientes"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: '0.85em' }}>
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
      Excel
    </button>
</div>
  </header>

  
       
  {/* Contenedor animado premium (solo izquierda) */}
  <div className="relative overflow-hidden grid">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${dia}-${semana}-${pendientes.length}`}
        variants={LEFT_PANEL_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        className="col-start-1 row-start-1"
      >
        {pendientes.length === 0 ? (
          <div className="p-6 text-neutral-600">No hay llamadas con los filtros actuales.</div>
        ) : (
          <motion.ul
            variants={LIST_WRAPPER_VARIANTS}
            initial="initial"
            animate="animate"
            className="divide-y divide-white/50"
          >
           {pendientes.map((c) => {
            const disabled = estaInhabilitado(c.progreso_id, c.habilitado_desde);
            return (
              <PendienteItem
                key={c.progreso_id}
                c={c}
                selectedId={selectedId}
                disabled={disabled}
                onSelect={(e, item) => {
                  if (disabled) {
                    setModalTargetId(item.progreso_id);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setModalPosition({
                      top: rect.bottom + window.scrollY + 8,
                      left: rect.left + window.scrollX,
                    });
                    setShowNextWeekModal(true);
                  } else {
                    setSelectedId(item.progreso_id);
                    setModalTargetId(null);
                    setModalPosition(null);
                  }
                }}
              />
            );
          })}
          </motion.ul>
        )}
      </motion.div>
    </AnimatePresence>
  </div>
</section>

{/* Panel derecho de llamada – Animación premium Mac 2025 */}
<section
  ref={rightPanelRef}
  className={`relative overflow-hidden transform-gpu rounded-[20px] bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl shadow-[0_18px_44px_-18px_rgba(0,0,0,.35)] ring-1 ring-white/60 p-4 md:p-5 ${!selectedId ? 'hidden lg:block' : ''}`}
  style={{ isolation: 'isolate', minHeight: 340, contain: 'layout paint', transform: 'translateZ(0)' }}
>
  <AnimatePresence initial={false} mode="wait">
    <motion.div
      key={selectedId ?? 'empty'}
      variants={MAC2025_PANEL_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
      // MEJORA 4: willChange para aceleración de hardware en animación pesada
      className="relative transform-gpu will-change-transform will-change-opacity"
      style={{ 
        transformOrigin: '50% 50%', 
        willChange: 'transform, opacity, filter' 
      }}
    >
      {!selectedId ? (
        <div className="grid place-items-center text-neutral-700 h-full min-h-[300px]">
          Selecciona un nombre de la lista para llamar / registrar.
        </div>
      ) : (
        <>
          {/* Botón volver: solo móvil */}
          <div className="mb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-white/60 bg-white/70 hover:bg-white/90"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.7 5.3a1 1 0 0 1 0 1.4L11.4 11l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" fill="currentColor"/>
              </svg>
              Volver
            </button>
          </div>
          {(() => {
            const sel = pendRef.current.find((p) => p.progreso_id === selectedId);
            return sel ? (
              <FollowUp
                semana={semana}
                dia={dia}
                row={sel}
                saving={saving}
                onSave={enviarResultado}
              />
            ) : (
              <div className="p-6 text-neutral-700">Selecciona un registro válido para continuar.</div>
            );
          })()}
        </>
      )}
    </motion.div>
  </AnimatePresence>
</section>

        </div>

        {/* ===== Asistencias ===== */}
        <section className="mt-6 animate-cardIn rounded-[20px] ring-1 ring-white/60 shadow-[0_18px_44px_-18px_rgba(0,0,0,.35)] overflow-hidden bg-white/55 supports-[backdrop-filter]:bg-white/35 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 backdrop-blur-xl bg-[radial-gradient(900px_200px_at_0%_-30%,rgba(125,211,252,0.1),transparent),radial-gradient(900px_240px_at_110%_-40%,rgba(165,180,252,0.1),transparent),linear-gradient(135deg,rgba(255,255,255,.85),rgba(255,255,255,.65))] supports-[backdrop-filter]:bg-[radial-gradient(900px_200px_at_0%_-30%,rgba(125,211,252,0.1),transparent),radial-gradient(900px_240px_at_110%_-40%,rgba(165,180,252,0.1),transparent),linear-gradient(135deg,rgba(255,255,255,.80),rgba(255,255,255,.55))] ">
            <div>
              <h3 className="text-[15px] md:text-base font-semibold text-neutral-900">
                Día {asig.dia} — {asig.etapaBase === 'Semillas' ? 'Semillas' : asig.etapaBase} {asig.modulo}
              </h3>
              <p className="text-neutral-700 text-xs">Agendados que confirmaron asistencia.</p>
            </div>
            <div className="flex items-center gap-2">
                <button
                  onClick={downloadAsistenciasPDF}
                  disabled={agendados.length === 0}
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-400 via-red-500 to-red-600 text-white ring-1 ring-white/50 shadow-[0_6px_20px_rgba(220,38,38,0.35)] px-2 py-1 text-xs font-medium hover:scale-[1.02] active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Descargar PDF de asistencias"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: '0.85em' }}>
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                  PDF
                </button>
            </div>
          </div>

          {loadingAg ? (
            <div className="px-4 md:px-6 py-10 text-center text-neutral-700">Cargando…</div>
          ) : agendados.length === 0 ? (
            <div className="px-4 md:px-6 py-10 text-center text-neutral-700">No hay agendados para tu día asignado.</div>
          ) : (
            <>
              <ul className="divide-y divide-white/50">
                {agendados.map((e) => (
                  <li key={e.progreso_id} className="px-4 md:px-6 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-900 truncate">{e.nombre}</div>
                      <div className="text-neutral-700 text-xs md:text-sm">{e.telefono ?? '—'}</div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm mr-3">
                      <input
                        type="checkbox"
                        checked={marks[e.progreso_id] === 'A'}
                        onChange={() => toggleMark(e.progreso_id, 'A')}
                        className="accent-emerald-600"
                      />
                      Asistió
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={marks[e.progreso_id] === 'N'}
                        onChange={() => toggleMark(e.progreso_id, 'N')}
                        className="accent-sky-600"
                      />
                      No asistió
                    </label>
                  </li>
                ))}
              </ul>

              <div className="px-4 md:px-6 py-3 bg-white/40">
                <button
                  disabled={savingAg}
                  onClick={enviarAsistencias}
                  className="rounded-xl bg-gradient-to-r from-sky-300 via-indigo-300 to-cyan-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(20,150,220,0.35)] px-4 py-2 hover:scale-[1.02] active:scale-95 transition disabled:opacity-60"
                >
                  {savingAg ? 'Enviando…' : 'Enviar Reporte'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ===== Modal Banco Archivo (Mac 2025 / glass) ===== */}
      <AnimatePresence>
        {bancoOpen && (
          <motion.div
            key="banco-backdrop"
            variants={MODAL_BACKDROP_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-[60] flex justify-center items-start pt-8 md:pt-12"
            onClick={() => setBancoOpen(false)}
          >
            <motion.div
              key="banco-panel"
              variants={MODAL_PANEL_VARIANTS}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md sm:max-w-lg md:max-w-4xl max-h-[90vh] md:max-h-[96vh] flex flex-col overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,35)] ring-1 ring-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,.70),rgba(255,255,255,.45))] backdrop-blur-xl"
            >
              {/* Header */}
              <div className="px-5 md:px-7 py-4 flex items-center justify-between border-b border-white/50 shrink-0">
                <div>
                  <div className="text-xl md:text-2xl font-semibold text-neutral-900">Banco Archivo</div>
                  <div className="text-[12px] text-neutral-700">
                    {asig.etapaBase} {asig.etapaBase !== 'Restauracion' ? asig.modulo : ''} • Día {asig.dia}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadBancoPDF}
                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-400 via-red-500 to-red-600 text-white ring-1 ring-white/50 shadow-[0_6px_20px_rgba(220,38,38,0.35)] px-2 py-1 text-xs font-medium hover:scale-[1.02] active:scale-95 transition"
                    title="Descargar PDF de Banco Archivo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: '0.85em' }}>
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                    PDF
                  </button>
                  <button
                    onClick={downloadBancoExcel}
                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-green-400 via-green-500 to-green-600 text-white ring-1 ring-white/50 shadow-[0_6px_20px_rgba(34,197,94,0.35)] px-2 py-1 text-xs font-medium hover:scale-[1.02] active:scale-95 transition"
                    title="Descargar Excel de Banco Archivo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: '0.85em' }}>
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                    Excel
                  </button>
                  <button
                    onClick={() => setBancoOpen(false)}
                    className="rounded-full bg-white/85 hover:bg-white/95 px-4 py-2 text-sm font-semibold ring-1 ring-white/60 text-neutral-900"
                  >
                    Atrás
                  </button>
                </div>
              </div>                                 

              {/* Contenido (scrollable) */}
              <div className="flex-1 overflow-y-auto">
                {/* Tabla */}
                <div className="px-4 md:px-6 py-3">
                  <div className="overflow-x-auto">
                    {(() => {
                      const totalPaginas = Math.ceil(bancoRows.length / REGS_POR_PAGINA);
                      const registrosMostrados = bancoRows.slice(
                        bancoPagina * REGS_POR_PAGINA,
                        (bancoPagina + 1) * REGS_POR_PAGINA
                      );
                      
                      return (
                        <>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-neutral-800">
                                <th className="sticky left-0 z-10 py-2 pr-3 bg-white/90 supports-[backdrop-filter]:bg-white/70 backdrop-blur-sm">Nombre</th>
                                <th className="py-2 pr-3">Teléfono</th>
                                <th className="py-2 pr-3">Módulo</th>
                                <th className="py-2 pr-3">Semana</th>
                                <th className="py-2 pr-3">Día</th>
                                <th className="py-2 pr-3">Archivado</th>
                                <th className="py-2 pr-0 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="align-top">
                              {bancoLoading ? (
                                <tr><td colSpan={7} className="py-6 text-center text-neutral-700">Cargando…</td></tr>
                              ) : bancoRows.length === 0 ? (
                                <tr><td colSpan={7} className="py-6 text-center text-neutral-700">Sin registros archivados.</td></tr>
                              ) : registrosMostrados.map((r) => (
                                <tr key={r.progreso_id} className="border-t border-white/50">
                                  <td className="sticky left-0 z-10 py-2 pr-3 font-medium text-neutral-900 bg-white/90 supports-[backdrop-filter]:bg-white/70 backdrop-blur-sm">{r.nombre}</td>
                                  <td className="py-2 pr-3 text-neutral-800">{r.telefono ?? '—'}</td>
                                  <td className="py-2 pr-3">{r.modulo ?? '—'}</td>
                                  <td className="py-2 pr-3">{r.semana ?? '—'}</td>
                                  <td className="py-2 pr-3">{r.dia}</td>
                                  <td className="py-2 pr-3">{new Date(r.creado_en).toLocaleString()}</td>
                                  <td className="py-2 pr-0 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        disabled={!!reactivating[r.progreso_id] || !!deleting[r.progreso_id]}
                                        onClick={() => {
                                          setReactivationCandidate(r);
                                          setShowReactivationConfirm(true);
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-300 to-cyan-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(20,150,220,0.35)] px-3 py-1.5 text-sm transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                                        title="Reactivar al panel actual"
                                      >
                                        {reactivating[r.progreso_id] ? 'Reactivando…' : 'Reactivar'}
                                      </button>
                                      <button
                                        disabled={!!deleting[r.progreso_id] || !!reactivating[r.progreso_id]}
                                        onClick={() => eliminarDeBanco(r)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-red-400 to-red-500 text-white ring-1 ring-white/50 shadow-[0_4px_12px_rgba(239,68,68,0.35)] transition hover:scale-[1.05] active:scale-95 disabled:opacity-60"
                                        title="Eliminar permanentemente"
                                      >
                                        {deleting[r.progreso_id] ? (
                                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        ) : (
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM5 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1zM9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z"></path>
                                          </svg>
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          
                          {totalPaginas > 1 && (
                            <div className="sticky bottom-0 px-1 py-3 flex items-center justify-between border-t border-white/50 bg-white/50 backdrop-blur-sm mt-2">
                              <button
                                onClick={() => setBancoPagina(p => Math.max(0, p - 1))}
                                disabled={bancoPagina === 0}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-white/60 bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:ring-white/80 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                                  <path d="M15.7 5.3a1 1 0 0 1 0 1.4L11.4 11l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"/>
                                </svg>
                                Atrás
                              </button>
                              
                              <span className="text-sm font-medium text-neutral-700">
                                Página {bancoPagina + 1} de {totalPaginas}
                              </span>
                              
                              <button
                                onClick={() => setBancoPagina(p => Math.min(totalPaginas - 1, p + 1))}
                                disabled={bancoPagina >= totalPaginas - 1}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-white/60 bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:ring-white/80 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Siguiente
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                                  <path d="M8.3 5.3a1 1 0 0 0 0 1.4L12.6 11l-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0Z"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación para reactivar */}
      <AnimatePresence>
        {showReactivationConfirm && reactivationCandidate && (
          <motion.div
            key="reactivar-backdrop"
            variants={MODAL_BACKDROP_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-[70] flex justify-center items-center"
            onClick={() => setShowReactivationConfirm(false)}
          >
            <motion.div
              key="reactivar-panel"
              variants={MODAL_PANEL_VARIANTS}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm flex flex-col overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,35)] ring-1 ring-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.65))] backdrop-blur-xl p-6"
            >
              <h3 className="text-lg font-semibold text-neutral-900 text-center">Reactivar Registro</h3>
              <p className="mt-2 text-center text-neutral-700">
                ¿Deseas reactivar a <span className="font-bold">{reactivationCandidate.nombre}</span>?
              </p>
              <div className="mt-6 flex justify-center gap-4">
                <button
                  onClick={() => setShowReactivationConfirm(false)}
                  className="px-4 py-2 text-sm font-semibold text-neutral-800 bg-white/80 rounded-lg ring-1 ring-black/10 hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    reactivar(reactivationCandidate);
                    setShowReactivationConfirm(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm"
                >
                  Aceptar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal premium para registros inhabilitados */}
      <AnimatePresence>
        {showNextWeekModal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={handleCloseModal}
            />
            
            <motion.div
              key="card"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 0, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute z-[61]"
              style={{
                top: modalPosition ? `${modalPosition.top}px` : 0,
                left: modalPosition ? `${modalPosition.left}px` : 0,
                visibility: modalPosition ? 'visible' : 'hidden',
              }}
            >
              <div className="w-full max-w-md rounded-2xl bg-white/80 shadow-2xl ring-1 ring-white/40">
                <div className="p-6 md:p-7">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                        <path d="M12 2l9 4v6c0 5-3.8 9.3-9 10-5.2-.7-9-5-9-10V6l9-4z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-neutral-900">
                        Registro inhabilitado
                      </h3>
                      <p className="mt-1 text-sm text-neutral-700">
                         Este registro fue gestionado por el servidor de la semana anterior.
  Por ese motivo estará disponible nuevamente el próximo domingo a las 10:00 AM.
                      </p>
                      {(() => {
                        const selected = modalTargetId && pendientes.find(p => p.progreso_id === modalTargetId);
                        if (selected && selected.habilitado_desde) {
                          return (
                            <p className="mt-2 text-xs text-neutral-600">
                              Disponible desde: {new Date(selected.habilitado_desde).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleTempUnlock}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-sky-700 bg-sky-100 ring-1 ring-sky-200 hover:bg-sky-200 active:bg-sky-300 transition"
                    >
                      Desbloquear Temporalmente
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow hover:brightness-105 active:brightness-95 transition"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Nueva Alma */}
      <AnimatePresence mode="sync" initial={false}>
        {nuevaAlmaOpen && (
          <div
            key="modal-nueva-alma"
            className="fixed inset-0 z-[1000] flex min-h-[100dvh] items-start justify-center overflow-y-auto px-1.5 pt-0 pb-6 md:px-4 md:pt-4 md:pb-10 bg-[radial-gradient(1200px_850px_at_50%_-10%,rgba(191,219,254,0.24),transparent),radial-gradient(900px_620px_at_90%_0%,rgba(165,180,252,0.28),rgba(15,23,42,0.78))] supports-[backdrop-filter]:backdrop-blur-[22px]"
            onClick={(event) => { if (event.target === event.currentTarget) { setNuevaAlmaOpen(false); } }}
          >
            <div
              className="relative w-[min(1100px,96vw)] max-h-[96vh] overflow-hidden rounded-[32px] border border-white/35 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(240,244,255,0.74))] supports-[backdrop-filter]:bg-white/65 supports-[backdrop-filter]:backdrop-blur-[32px] shadow-[0_48px_140px_-50px_rgba(15,23,42,0.7)] ring-1 ring-white/50"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-end px-3 md:px-5 py-2 border-b border-white/60 bg-white/70 supports-[backdrop-filter]:bg-white/55 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setNuevaAlmaOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/60 bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:ring-white/80 hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 md:px-3.5"
                >
                  Cerrar
                </button>
              </div>
              <div className="max-h-[calc(96vh-48px)] overflow-y-auto px-3 md:px-6 pb-4 pt-0">
                <PersonaNueva  servidorId={servidorId} />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Servidores */}
      <AnimatePresence mode="sync" initial={false}>
        {servidoresOpen && (
          <div
            key="modal-servidores"
            className="fixed inset-0 z-[1000] flex min-h-[100dvh] items-start justify-center overflow-y-auto px-1.5 pt-0 pb-6 md:px-4 md:pt-4 md:pb-10 bg-[radial-gradient(1200px_850px_at_20%_-20%,rgba(125,211,252,0.22),transparent),radial-gradient(900px_620px_at_80%_0%,rgba(196,181,253,0.26),rgba(15,23,42,0.78))] supports-[backdrop-filter]:backdrop-blur-[22px]"
            onClick={(event) => { if (event.target === event.currentTarget) { setServidoresOpen(false); } }}
          >
            <div
              className="relative w-[min(1200px,96vw)] max-h-[96vh] overflow-hidden rounded-[32px] border border-white/35 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(236,241,255,0.72))] supports-[backdrop-filter]:bg-white/65 supports-[backdrop-filter]:backdrop-blur-[32px] shadow-[0_48px_140px_-50px_rgba(15,23,42,0.7)] ring-1 ring-white/50"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-end px-3 md:px-5 py-2 border-b border-white/60 bg-white/70 supports-[backdrop-filter]:bg-white/55 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setServidoresOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/60 bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:ring-white/80 hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 md:px-3.5"
                >
                  Cerrar
                </button>
              </div>
              <div className="max-h-[calc(96vh-48px)] overflow-y-auto px-3 md:px-6 pb-4 pt-0">
                <Servidores />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes cardIn {
          0% { opacity: 0; transform: translateY(14px) scale(0.98); filter: blur(3px); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-cardIn { animation: cardIn .48s cubic-bezier(.22,1,.36,1) both; }

        @keyframes fadeInScale {
          0% { opacity: 0; transform: translateY(6px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeInScale { animation: fadeInScale .28s ease-out both; }

        @keyframes flashBg {
          0% { background-color: #fff6d4; }
          100% { background-color: transparent; }
        }
        .animate-flashBg { animation: flashBg 1.2s ease-out 1; }
      `}</style>
    </main>
  );

  /** ====== Banco Archivo: handlers ====== */
async function openBanco() {
  if (!asig) return;
  setBancoOpen(true);
  setBancoLoading(true);
  setBancoPagina(0); 
  
  try {
    let q = supabase
      .from(V_BANCO)
      .select('progreso_id,persona_id,nombre,telefono,modulo,semana,dia,creado_en,etapa')
      .eq('dia', asig.dia);

    q = (q as any).eq('etapa', asig.etapaBase);
    if (asig.etapaBase !== 'Restauracion') {
      q = (q as any).eq('modulo', asig.modulo);
    }

    const { data, error } = await q.order('creado_en', { ascending: false });
    if (error) throw error;

    setBancoRows((data ?? []) as BancoRow[]);
  } catch (e: any) {
    console.error(e?.message ?? 'Error cargando Banco Archivo');
    setBancoRows([]);
  } finally {
    setBancoLoading(false);
  }
}

  async function reactivar(row: BancoRow) {
    if (!asig || !servidorId) return;
    setReactivating((m) => ({ ...m, [row.progreso_id]: true }));
    try {
      const { error } = await supabase.rpc(RPC_REACTIVAR, {
        p_progreso: row.progreso_id,
        p_persona: row.persona_id,
        p_nombre: row.nombre,
        p_telefono: row.telefono ?? null,
        p_estudio: asig.dia,
        p_notas: null,
        p_servidor: servidorId,
      });
      if (error) throw error;

      setBancoRows((prev) => prev.filter((r) => r.progreso_id !== row.progreso_id));
      if (dia) await fetchPendientes(semana, dia, { quiet: true });
      await fetchAgendados({ quiet: true });

      rtNewRef.current.add(row.progreso_id);
    } catch (e: any) {
      console.error(e?.message ?? 'No se pudo reactivar');
    } finally {
      setReactivating((m) => ({ ...m, [row.progreso_id]: false }));
    }
  }

  async function eliminarDeBanco(row: BancoRow) {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar a ${row.nombre} permanentemente? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeleting((m) => ({ ...m, [row.progreso_id]: true }));
    try {
      const { error } = await supabase.from('progreso').delete().eq('id', row.progreso_id);
      if (error) throw error;

      toast.success(`${row.nombre} ha sido eliminado(a) permanentemente.`);
      setBancoRows((prev) => prev.filter((r) => r.progreso_id !== row.progreso_id));

    } catch (e: any) {
      console.error('Error al eliminar del banco de archivo:', e?.message);
      toast.error(`No se pudo eliminar a ${row.nombre}.`);
    } finally {
      setDeleting((m) => ({ ...m, [row.progreso_id]: false }));
    }
  }
}

/* ================= Panel derecho (detalle y envío) ================= */
function FollowUp({
  semana,
  dia,
  row,
  saving,
  onSave,
}: {
  semana: Semana;
  dia: Dia | null;
  row: PendienteRow;
  saving: boolean;
  onSave: (p: { resultado: Resultado; notas?: string }) => Promise<void>;
}) {
  const opciones: { label: string; value: Resultado }[] = [
    { label: 'CONFIRMÓ ASISTENCIA', value: 'confirmo_asistencia' },
    { label: 'NO CONTESTA', value: 'no_contesta' },
    { label: 'NO POR AHORA', value: 'no_por_ahora' },
    { label: 'LLAMAR DE NUEVO', value: 'llamar_de_nuevo' },
    { label: 'SALIO DE VIAJE', value: 'salio_de_viaje' },
    { label: 'YA ESTÁ EN PTMD', value: 'ya_esta_en_ptmd' },
    { label: 'NO TIENE $ TRANSPORTE', value: 'no_tiene_transporte' },
    { label: 'VIVE FUERA DE LA CIUDAD', value: 'vive_fuera' },
    { label: 'MURIÓ', value: 'murio' },
    { label: 'NO ME INTERESA', value: 'rechazado' },
    { label: 'BUZÓN DE VOZ', value: 'buzon_de_voz' },
    { label: 'OTRO', value: 'otro' },
  ];

  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [obs, setObs] = useState('');
  const [obsCount, setObsCount] = useState<number | null>(null);

  useEffect(() => {
    setResultado(null);
    setObs('');
  }, [row?.progreso_id]);


  type ObsItem = { 
    fecha: string; 
    notas: string; 
    resultado?: Resultado | null;
    fuente: 'registro' | 'llamada'; 
  autor?: string; 
  };

  const [obsOpen, setObsOpen] = useState(false);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsItems, setObsItems] = useState<ObsItem[]>([]);
  const refreshObsCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('fn_observaciones_por_progreso_ext', {
        p_progreso: row.progreso_id,
      });
      if (error) throw error;
      setObsCount(Array.isArray(data) ? data.length : 0);
    } catch (e) {
      setObsCount(0);
    }
  }, [row.progreso_id]);

const openObsModal = async () => {
  setObsOpen(true);
  setObsLoading(true);
  try {
    const { data, error } = await supabase.rpc('fn_observaciones_por_progreso_ext', {
      p_progreso: row.progreso_id,
    });
    if (error) throw error;
    const items = (data ?? []).map((r: any) => ({
      fecha: r.creado_en,
      notas: r.notas,
      resultado: r.resultado,
      fuente: 'llamada' as const,
       autor: r.autor ?? null,
    }));
    setObsItems(items);
    setObsCount(items.length);
  } catch (e) {
    console.error('No se pudieron cargar observaciones', e);
    setObsItems([]);
    setObsCount(0);
  } finally {
    setObsLoading(false);
  }
};
                                         
  const initials =
    row.nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'U';

  const telHref = row.telefono ? `tel:${row.telefono.replace(/[^\d+]/g, '')}` : null;
  const normalizeWa = (raw?: string | null): string | null => {
    const d = (raw ?? '').replace(/\D+/g, '');
    if (!d) return null; let n = d;
    if (n.startsWith('00')) n = n.slice(2);
    if (!n.startsWith('57')) { n = n.replace(/^0+/, ''); if (n.length === 10 && n.startsWith('3')) n = '57'+n; else if (n.length >=7 && n.length <=10) n = '57'+n; }
    return n;
  };
  const waNumber = normalizeWa(row.telefono);
  const waText = `Hola ${row.nombre}, te escribimos de la iglesia ASP Amamos la presencia de Dios, `;
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : null;


  useEffect(() => {
    setObsCount(null);
    void refreshObsCount();
  }, [row.progreso_id, refreshObsCount]);

  return (
    <>
      <div className="animate-cardIn">
        <div className="mb-4 rounded-2xl ring-1 ring-white/60 bg-white/60 supports-[backdrop-filter]:bg-white/40 backdrop-blur-xl shadow-[0_18px_40px_-22px_rgba(0,0,0,.45)] px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row items-stretch md:items-center md:justify-between gap-3 md:gap-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-xl text-white font-bold bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
              {initials}
            </div>
            <div>
              <div className="text-lg md:text-lg font-semibold text-neutral-900 leading-tight">
                {row.nombre}
              </div>
              <div className="text-[12px] text-neutral-700 leading-none">
                Semana {semana} • {dia}
              </div>
             
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-stretch gap-2 w-full md:w-auto min-w-0">
            {telHref ? (
              <a
                href={telHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/85 text-neutral-900 px-3.5 py-2 text-sm font-semibold ring-1 ring-white/60 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:bg-white w-full sm:w-auto max-w-full"
                title={`Llamar a ${row.telefono}`}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M6.6 10.8c1.3 2.5 3.1 4.4 5.6 5.6l2.1-2.1a1 1 0 0 1 1.1-.22c1.2.48 2.6.74 4 .74a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1C12.1 20.3 3.7 11.9 3.7 2.7a1 1 0 0 1 1-1H8.2a1 1 0 0 1 1 1c0 1.4.26 2.8.74 4a1 1 0 0 1-.22 1.1l-2.1 2.1Z" fill="currentColor" />
                </svg>
                <span className="truncate max-w-full">{row.telefono}</span>
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 text-neutral-700 px-3.5 py-2 text-sm font-semibold ring-1 ring-white/60 shadow-sm">
                -
              </div>
            )}

            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3.5 py-2 text-sm font-semibold shadow-sm transition-all duration-200 hover:bg-emerald-100 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 w-full sm:w-auto max-w-full"
                title={`Enviar WhatsApp a ${row.telefono}`}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M16.9 13.7c-.2-.1-1.2-.6-1.4-.7-.3-.1-.4-.1-.6.1l-.6.7c-.2.2-.4.3-.7.2-.3-.1-1.1-.4-2-1.2-.7-.6-1.2-1.3-1.4-1.6-.2-.3 0-.5.1-.7l.5-.6c.2-.3.1-.4 0-.7-.1-.2-.5-1.2-.7-1.7-.2-.5-.4-.4-.6-.4h-.9c-.3 0-.7.2-.9.5-.3.3-.9 1-.9 2.3 0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 .9.4 1.5.5 2 .6.8.1 1.4 0 1.8-.1.6-.2 1.3-.7 1.5-1.3.2-.6.2-1.1.1-1.3 0-.2-.2-.3-.5-.4Z" fill="currentColor"/>
                  <path d="M20.5 3.5A11 11 0 1 0 4 19l-1 3.6 3.7-1A11 11 0 0 0 21 12a10.9 10.9 0 0 0-3.2-8.5ZM12 20.8c-1.7 0-3.3-.4-4.7-1.3l-.3-.2-3 .8.8-2.9-.2-.3A9 9 0 1 1 12 20.8Z" fill="currentColor"/>
                </svg>
                WhatsApp
              </a>
            )}

            <button
              type="button"
              onClick={openObsModal}
              disabled={obsCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/85 text-neutral-900 px-3.5 py-2 text-sm font-semibold ring-1 ring-white/60 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto max-w-full"
              title="Ver observaciones del registro"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3C7 3 2.73 6.11 1 10.5 2.73 14.89 7 18 12 18s9.27-3.11 11-7.5C21.27 6.11 17 3 12 3zm0 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v4h-2zm0 6h2v2h-2z" fill="currentColor"/>
              </svg>
              Observaciones
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700">
                {obsCount ?? 0}
              </span>
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-700">Resultado de la llamada</label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {opciones.map((o) => (
              <label key={o.value} className="flex items-center gap-2 rounded-lg ring-1 ring-white/60 bg-white/60 supports-[backdrop-filter]:bg-white/40 px-3 py-2 cursor-pointer">
                <input
                  type="radio"
                  name="resultado"
                  className="accent-blue-600"
                  onChange={() => setResultado(o.value)}
                  checked={resultado === o.value}
                />
                <span className="text-sm text-neutral-900">{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-neutral-700">Observaciones</label>
          <textarea
            className="mt-1 w-full min-h-[100px] rounded-lg ring-1 ring-white/60 px-3 py-2 bg-white/60 supports-[backdrop-filter]:bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-300/60 text-neutral-900 placeholder:text-neutral-500"
            placeholder="Escribe aquí las observaciones..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <button
            disabled={!resultado || saving}
            onClick={async () => { if (resultado) { await onSave({ resultado, notas: obs }); await refreshObsCount(); } }}
            className="rounded-xl bg-gradient-to-r from-sky-300 via-indigo-300 to-cyan-300 text-slate-900 ring-1 ring-white/50 shadow-[0_6px_20px_rgba(20,150,220,0.35)] px-4 py-2 hover:scale-[1.02] active:scale-95 transition disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Enviar informe'}
          </button>
        </div>
      </div>

      {obsOpen && (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={() => setObsOpen(false)}
          />
          <div className="absolute inset-0 flex justify-center items-start md:items-center overflow-y-auto px-0 md:px-4 pt-4 md:pt-6 pb-0">
            <div className="w-full min-h-[100dvh] md:h-auto max-w-none md:max-w-4xl rounded-none md:rounded-[28px] shadow-[0_30px_80px_-20px_rgba(0,0,0,.45)] ring-0 md:ring-1 ring-neutral-200 bg-white overflow-auto md:overflow-hidden">
              <div className="px-4 md:px-7 py-4 md:py-5 flex items-center justify-between border-b border-neutral-200 sticky top-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 z-10">
                <div>
                  <div className="text-2xl md:text-3xl font-semibold text-neutral-900">Observaciones</div>
                  <div className="text-[13px] text-neutral-500">{row.nombre ?? '-'}</div>
                </div>
                <button
                  onClick={() => setObsOpen(false)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-neutral-200 text-neutral-900 shadow-sm hover:bg-neutral-50"
                >
                  Atras
                </button>
              </div>
              <div className="px-4 md:px-6 py-4 md:py-5">
                <div className="flex md:block gap-4">
                 
                  {/* Contenido principal del modal */}
                  <div className="flex-1 min-w-0">
                    {obsLoading ? (
                      <div className="py-6 text-center text-neutral-600">Cargando.</div>
                    ) : obsItems.length === 0 ? (
                      <div className="py-6 text-center text-neutral-500">Sin observaciones registradas.</div>
                    ) : (
                      <ul className="space-y-3">
                       {obsItems.map((it, idx) => (
                        <li key={idx} className="rounded-2xl bg-white ring-1 ring-neutral-200 px-4 py-3 shadow-sm">
                          <div className="text-sm text-neutral-600 flex items-center justify-between">
                            <span className="font-medium text-neutral-800">
                              {new Date(it.fecha).toLocaleString()}
                            </span>
                            <span className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 ring-1 ring-neutral-200 text-neutral-600">
                              {it.fuente === 'registro' ? 'Registro' : 'Llamada'}
                            </span>
                          </div>

                          {it.autor && (
                            <div className="mt-1 text-[11px] text-neutral-500">
                              Registrado por {it.autor}
                            </div>
                          )}

                          <div className="mt-2 text-[13px] text-neutral-900 whitespace-pre-wrap">
                            <strong className="font-semibold">
                              {it.resultado ? (resultadoLabels[it.resultado as Resultado] ?? it.resultado) : '-'}
                            </strong>
                            {it.notas ? ` - ${it.notas}` : ''}
                          </div>
                        </li>
                      ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
