/*
  ARCHIVO: app/admin/components/GestionServidores.tsx
  ROL: Módulo de Gestión de Servidores (Refactorizado)
  (ACTUALIZADO con modal "Listado" premium y fluido)
*/
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
// --- 1. Imports de UI/UX añadidos ---
import { 
  Server, 
  type LucideIcon,
  Search,
  Check,
  UserCheck,
  Loader2,
  List,
  Save,
  Trash2,
  X // <-- Añadido para el nuevo modal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // <-- Añadido para animación

/* ========= Tipos ========= */
// (Toda tu lógica de Tipos permanece intacta)
type AppEstudioDia = 'Domingo' | 'Martes' | 'Virtual';
type Errores = {
    nombre?: string | null;
    telefono?: string | null;
    cedula?: string | null;
    rol?: string | null;
    etapa?: string | null;
    dia?: string | null;
    semana?: string | null;
    culto?: string | null;
};
type DiaKey = 'DOMINGO' | 'MIÉRCOLES' | 'VIERNES' | 'SÁBADO';
type CultosMap = {
    DOMINGO: string;
    MIÉRCOLES: string;
    VIERNES: string;
    SÁBADO: string;
};
type FormState = {
    nombre: string;
    telefono: string;
    cedula: string;
    rol: string;
    destino: string[];
    cultoSeleccionado: string;
    observaciones: string;
    cultos: CultosMap;
};
type AsigContacto = {
    id: number;
    etapa: 'Semillas' | 'Devocionales' | 'Restauracion';
    dia: AppEstudioDia;
    semana: number;
    vigente: boolean;
};
type AsigMaestro = {
    id: number;
    etapa: string; 
    dia: AppEstudioDia;
    vigente: boolean;
};
type ServidorRow = {
    id: string;
    cedula: string;
    nombre: string;
    telefono: string | null;
    email?: string | null;
    activo: boolean;
    asignaciones_contacto?: AsigContacto[];
    asignaciones_maestro?: AsigMaestro[];
};
type ObservacionRow = {
    id?: string | number;
    texto?: string;
    created_at?: string;
};


/* ========= Constantes / Helpers ========= */
// (Toda tu lógica de Helpers permanece intacta)
const ADMIN_PASSWORD = '1061355';
const MIN_SEARCH = 2;
const defaultCultos = (): CultosMap => ({
    DOMINGO: 'DOMINGO',
    MIÉRCOLES: 'MIÉRCOLES',
    VIERNES: 'VIERNES',
    SÁBADO: 'SÁBADO',
});
const cultosOpciones: Record<DiaKey, string[]> = {
    DOMINGO: ['7:00 AM', '9:00 AM', '11:00 AM', '5:30 PM'],
    MIÉRCOLES: ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '6:30 PM'],
    VIERNES: ['9:00 AM', '5:30 PM'],
    SÁBADO: ['Ayuno Familiar', 'Jóvenes'],
};
const ROLES_FILA_1 = ['Logistica', 'Contactos', 'Maestros'];
const ROLES_FILA_2 = ['Director', 'Administrador'];
const ROLE_UI_LABEL: Record<string, string> = {
    Maestros: 'Coordinadores',
    Contactos: 'Timoteos',
};
const uiRoleLabel = (v: string) => ROLE_UI_LABEL[v] ?? v;
const trim = (s: string) => (s ?? '').trim();
const esVacio = (s: string) => !trim(s);
const maskCedulaValue = (value?: string | null) => {
    const base = trim(value ?? '');
    if (!base) return '';
    return base.replace(/\S/g, '*');
};
const maskCedulaDisplay = (value?: string | null) => maskCedulaValue(value) || '—';
type AsigBase = { id?: number; vigente?: boolean };
const getVigente = <T extends AsigBase>(arr?: T[]) =>
  (arr ?? []).find(a => !!a.vigente) ?? (arr && arr.length ? arr[0] : undefined);
const comparaMasReciente = (a?: AsigBase[], b?: AsigBase[]) => {
  const ida = a?.[0]?.id ?? -1;
  const idb = b?.[0]?.id ?? -1;
  return ida >= idb ? 'contactos' : 'maestros';
};
const rolDesdeServidor = (s: ServidorRow): 'Contactos' | 'Maestros' | '' => {
  const vigC = (s.asignaciones_contacto ?? []).some(x => x.vigente);
  const vigM = (s.asignaciones_maestro ?? []).some(x => x.vigente);
  if (vigC) return 'Contactos';
  if (vigM) return 'Maestros';
  const hasC = (s.asignaciones_contacto?.length ?? 0) > 0;
  const hasM = (s.asignaciones_maestro?.length ?? 0) > 0;
  if (!hasC && !hasM) return '';
  return comparaMasReciente(s.asignaciones_contacto, s.asignaciones_maestro) === 'contactos'
    ? 'Contactos'
    : 'Maestros';
};
const getVigenteContacto = (s: ServidorRow) => getVigente(s.asignaciones_contacto);
const getVigenteMaestro  = (s: ServidorRow) => getVigente(s.asignaciones_maestro);
const norm = (t: string) =>
    (t ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
const toEtapaEnum = (
    texto: string
): 'Semillas' | 'Devocionales' | 'Restauracion' | null => {
    const t = norm(texto);
    if (t.startsWith('semillas')) return 'Semillas';
    if (t.startsWith('devocionales')) return 'Devocionales';
    if (t.startsWith('restauracion')) return 'Restauracion';
    return null;
};
const rolEs = (rol: string, base: 'Contactos' | 'Maestros' | 'Logistica' | 'Director' | 'Administrador') =>
    rol === base || rol === `Timoteo - ${base}`;
const toEtapaDetFromUi = (nivelSel: string): string | null => {
    const t = norm(nivelSel);
    const m = /^(semillas|devocionales|restauracion)\s+(\d+)/.exec(t);
    if (!m) return null;
    const grupo = m[1];
    const num = m[2];
    if (grupo === 'semillas') return `Semillas ${num}`;
    if (grupo === 'devocionales') return `Devocionales ${num}`;
    return `Restauracion ${num}`;
};
const parseEtapaDetFromDb = (
    etapaDb: string
): { grupoUI: 'Semillas' | 'Devocionales' | 'Restauración'; num: string } | null => {
    const t = norm(etapaDb);
    const m = /^(semillas|devocionales|restauracion)\s+(\d+)/.exec(t);
    if (!m) return null;
    const base = m[1];
    const num = m[2];
    if (base === 'semillas') return { grupoUI: 'Semillas', num };
    if (base === 'devocionales') return { grupoUI: 'Devocionales', num };
    return { grupoUI: 'Restauración', num };
};
const roleFromRow = (s: ServidorRow): string => {
    if (s.asignaciones_contacto?.some(a => a?.vigente)) return 'Contactos';
    if (s.asignaciones_maestro?.some(a => a?.vigente)) return 'Maestros';
    return '—';
};
const etapaDiaFromRow = (s: ServidorRow): { etapa: string; dia: string } => {
  const ac = s.asignaciones_contacto?.find(a => a?.vigente);
  const am = s.asignaciones_maestro?.find(a => a?.vigente);
  return { etapa: (ac?.etapa ?? am?.etapa ?? '—') as string, dia: (ac?.dia ?? am?.dia ?? '—') as string };
};
type ModalTransitionState = 'entering' | 'entered' | 'exiting';
const MODAL_TRANSITION_MS = 220;
const useModalTransition = (isVisible: boolean, duration = MODAL_TRANSITION_MS) => {
    const [shouldRender, setShouldRender] = useState(isVisible);
    const [transitionState, setTransitionState] = useState<ModalTransitionState>(
        isVisible ? 'entered' : 'exiting'
    );
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let rafId: number | null = null;
        let rafId2: number | null = null;
        if (isVisible) {
            setShouldRender(true);
            setTransitionState('entering');
            rafId = requestAnimationFrame(() => {
                rafId2 = requestAnimationFrame(() => {
                    setTransitionState('entered');
                });
            });
        } else if (shouldRender) {
            setTransitionState('exiting');
            timeoutId = setTimeout(() => {
                setShouldRender(false);
            }, duration);
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (rafId) cancelAnimationFrame(rafId);
            if (rafId2) cancelAnimationFrame(rafId2);
        };
    }, [isVisible, duration, shouldRender]);
    return { shouldRender, transitionState };
};

// --- 2. AÑADIDAS CONSTANTES DE ANIMACIÓN ---
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const modalVariants = {
  hidden: { scale: 0.9, opacity: 0, y: 50 },
  visible: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  exit: { scale: 0.9, opacity: 0, y: 50 },
};

// --- AÑADIDOS COMPONENTES DE UI ---
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-2xl bg-white/60 backdrop-blur-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
      {children}
    </div>
  );
}

function CardHeader({
  IconComponent,
  title,
  subtitle,
  children
}: {
  IconComponent: LucideIcon;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/80 bg-white/50 p-4 md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
          <IconComponent size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
      {children && (
        <div className="w-full md:w-auto flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}

function FormInput({ 
  label, 
  id,
  value, 
  onChange, 
  placeholder,
  className = '',
  error,
  guidedError,
  readOnly = false,
  onFocus,
  onMouseDown,
  inputRef
}: {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  error?: string | null;
  guidedError?: { key: string; msg: string } | null;
  readOnly?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLInputElement>) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const hasError = !!error || (guidedError?.key === id);
  const errorMsg = error || guidedError?.msg;

  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="mb-1.5 text-sm font-medium text-gray-800">
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onMouseDown={onMouseDown}
        readOnly={readOnly}
        placeholder={placeholder}
        className={
          `w-full rounded-lg border bg-white/50 py-2.5 px-4 text-sm text-gray-900 placeholder-gray-500 shadow-sm
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-indigo-500
          ${readOnly ? 'cursor-not-allowed bg-gray-100/80' : ''}
          ${hasError ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'}`
        }
      />
      {hasError && (
        <p className="mt-1.5 text-xs font-semibold text-red-600">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
// --- FIN DE COMPONENTES AÑADIDOS ---


/* ========= Componente Principal ========= */
export default function GestionServidores() {
    // (Lógica de 'useRef', 'useState', 'useEffect' y funciones intacta)
    const observacionesRef = useRef<HTMLTextAreaElement | null>(null);
    const inputNombreRef = useRef<HTMLInputElement | null>(null);
    const inputCedulaRef = useRef<HTMLInputElement | null>(null);
    const rolesCardRef = useRef<HTMLDivElement | null>(null);
    const logisticaCultosRef = useRef<HTMLDivElement | null>(null);
    const modalSemanaRef = useRef<HTMLDivElement | null>(null);
    const modalDiaRef = useRef<HTMLDivElement | null>(null);
    const modalEtapasRef = useRef<HTMLDivElement | null>(null);
    const adminPasswordRef = useRef<HTMLInputElement | null>(null);
    const adminPassDismissedAt = useRef<number>(0);
    const [form, setForm] = useState<FormState>({
        nombre: '',
        telefono: '',
        cedula: '',
        rol: '',
        destino: [],
        cultoSeleccionado: '',
        observaciones: '',
        cultos: defaultCultos(),
    });
    const [errores, setErrores] = useState<Errores>({});
    const [feedback, setFeedback] = useState<string | null>(null);
    const [feedbackKind, setFeedbackKind] = useState<'success' | 'error' | 'delete' | 'info' | null>(null);
    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearToast = () => {
        if (feedbackTimer.current) {
            clearTimeout(feedbackTimer.current);
            feedbackTimer.current = null;
        }
        toastClear();
        setFeedbackKind(null);
    };
    const showToast = (kind: 'success' | 'error' | 'delete' | 'info', text: string) => {
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        setFeedback(text);
        setFeedbackKind(kind);
        feedbackTimer.current = setTimeout(() => {
            setFeedback(null);
            setFeedbackKind(null);
            feedbackTimer.current = null;
        }, 5000);
    };
    const [busy, setBusy] = useState(false);
    const [guidedError, setGuidedError] = useState<
        | { key: 'nombre' | 'cedula' | 'rol' | 'etapa' | 'dia' | 'semana' | 'culto'; msg: string }
        | null
    >(null);
    const [editMode, setEditMode] = useState(false);
    const [cedulaUnlocked, setCedulaUnlocked] = useState(true);
    const [adminPassModalVisible, setAdminPassModalVisible] = useState(false);
    const [adminPassValue, setAdminPassValue] = useState('');
    const [adminPassError, setAdminPassError] = useState<string | null>(null);
    useEffect(() => {
        if (editMode) {
            setCedulaUnlocked(false);
            setAdminPassModalVisible(false);
            setAdminPassValue('');
            setAdminPassError(null);
        } else {
            setCedulaUnlocked(true);
        }
    }, [editMode]);
    useEffect(() => {
        if (adminPassModalVisible) {
            const timer = setTimeout(() => adminPasswordRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [adminPassModalVisible]);
    const openAdminPassModal = () => {
        if (adminPassModalVisible) return;
        const now = Date.now();
        if (now - adminPassDismissedAt.current < 250) return;
        adminPassDismissedAt.current = 0;
        setAdminPassValue('');
        setAdminPassError(null);
        setAdminPassModalVisible(true);
    };
    const closeAdminPassModal = () => {
        adminPassDismissedAt.current = Date.now();
        setAdminPassModalVisible(false);
        setAdminPassValue('');
        setAdminPassError(null);
        requestAnimationFrame(() => {
            if (!cedulaUnlocked) inputCedulaRef.current?.blur();
        });
    };
    const [pendingDelete, setPendingDelete] = useState(false);
    const handleDeleteButtonClick = () => {
        setPendingDelete(true);
        openAdminPassModal();
    };
    const handleAdminPassSubmit = (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        const pass = trim(adminPassValue);
        if (!pass) {
            setAdminPassError('Ingresa la contraseña del administrador.');
            return;
        }
        if (pass !== ADMIN_PASSWORD) {
            setAdminPassError('Contraseña incorrecta.');
            return;
        }
        closeAdminPassModal();
        if (pendingDelete) {
            setPendingDelete(false);
            setConfirmDetalleDelete(true);
        } else {
            setCedulaUnlocked(true);
            requestAnimationFrame(() => {
                inputCedulaRef.current?.focus();
            });
        }
    };
    const [contactosModalVisible, setContactosModalVisible] = useState(false);
    const [timoteoModalVisible, setTimoteoModalVisible] = useState(false);
    const contactosModalTransition = useModalTransition(contactosModalVisible);
    const timoteoModalTransition = useModalTransition(timoteoModalVisible);
    const [contactosSemana, setContactosSemana] = useState<string>('Semana 1');
    const [contactosDia, setContactosDia] = useState<AppEstudioDia | ''>('');
    const [nivelSeleccionado, setNivelSeleccionado] = useState<string>('');
    const [nivelSemillasSel, setNivelSemillasSel] = useState<string>('');
    const [nivelDevSel, setNivelDevSel] = useState<string>('');
    const [nivelResSel, setNivelResSel] = useState<string>('');
    const etapaSeleccionada = useMemo(
        () => toEtapaEnum(nivelSeleccionado ?? ''),
        [nivelSeleccionado]
    );
    const semanaNumero = useMemo(() => {
        const m = /Semana\s+(\d+)/i.exec(contactosSemana ?? '');
        return m ? parseInt(m[1], 10) : NaN;
    }, [contactosSemana]);
    const selectNivel = (
        grupo: 'Semillas' | 'Devocionales' | 'Restauración',
        num: string
    ) => {
        const etiqueta = `${grupo} ${num}`;
        setNivelSeleccionado(etiqueta);
        if (grupo === 'Semillas') {
            setNivelSemillasSel(num);
            setNivelDevSel('');
            setNivelResSel('');
        } else if (grupo === 'Devocionales') {
            setNivelDevSel(num);
            setNivelSemillasSel('');
            setNivelResSel('');
        } else {
            setNivelResSel(num);
            setNivelSemillasSel('');
            setNivelDevSel('');
        }
    };
    const confirmarModalContactos = () => {
        setForm((prev) => ({
            ...prev,
            destino: contactosDia ? [contactosDia.toUpperCase()] : prev.destino,
        }));
        setContactosModalVisible(false);
    };
    const [buscarModalVisible, setBuscarModalVisible] = useState(false);
    const [q, setQ] = useState('');
    const [results, setResults] = useState<ServidorRow[]>([]);
    const [searching, setSearching] = useState(false);
    const [focusIndex, setFocusIndex] = useState(0);
    const [listadoVisible, setListadoVisible] = useState(false);
    const [listPage, setListPage] = useState(1);
    const listPageSize = 7;
    const [listTotal, setListTotal] = useState(0);
    const [listLoading, setListLoading] = useState(false);
    const [listRows, setListRows] = useState<ServidorRow[]>([]);
    const cargarListado = async (page: number) => {
        setListLoading(true);
        try {
            const start = (page - 1) * listPageSize;
            const end = start + listPageSize - 1;
            const sel =
              'id, cedula, nombre, telefono, email, activo,' +
              ' asignaciones_contacto(id, etapa, dia, semana, vigente),' +
              ' asignaciones_maestro(id, etapa, dia, vigente)';
            const { data, error, count } = await supabase
                .from('servidores')
                .select(sel, { count: 'exact' })
                .eq('activo', true)
                .order('nombre', { ascending: true })
                .range(start, end)
                .returns<ServidorRow[]>();
            if (error) throw error;
            setListRows(data || []);
            setListTotal(count || 0);
            setListPage(page);
        } catch (e) {
            setListRows([]);
            setListTotal(0);
        } finally {
            setListLoading(false);
        }
    };
    const abrirListado = () => { setListadoVisible(true); cargarListado(1); };
    const cerrarListado = () => setListadoVisible(false);
    const [detalleVisible, setDetalleVisible] = useState(false);
    const [detalleTab, setDetalleTab] = useState<'datos' | 'actualizar'>('datos');
    const [detalleSel, setDetalleSel] = useState<ServidorRow | null>(null);
    const [obsLoading, setObsLoading] = useState(false);
    const [obsItems, setObsItems] = useState<ObservacionRow[]>([]);
    const [confirmDetalleDelete, setConfirmDetalleDelete] = useState(false);
    const volverABuscar = () => {
        setConfirmDetalleDelete(false);
        setDetalleVisible(false);
        setDetalleSel(null);
        setQ('');
        setResults([]);
        setFocusIndex(0);
        setBuscarModalVisible(true);
    };
    useEffect(() => {
        if (!buscarModalVisible) return;
        const term = trim(q);
        if (term.length < MIN_SEARCH) {
            setResults([]);
            setSearching(false);
            return;
        }
        const h = setTimeout(async () => {
            setSearching(true);
            const sel =
                'id, cedula, nombre, telefono, email, activo,' +
                ' asignaciones_contacto(id, etapa, dia, semana, vigente),' +
                ' asignaciones_maestro(id, etapa, dia, vigente)';
            const { data, error } = await supabase
                .from('servidores')
                .select(sel)
                .or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%,cedula.ilike.%${term}%`)
                .eq('activo', true)
                .order('vigente', { foreignTable: 'asignaciones_contacto', ascending: false })
                .order('id', { foreignTable: 'asignaciones_contacto', ascending: false })
                .order('vigente', { foreignTable: 'asignaciones_maestro', ascending: false })
                .order('id', { foreignTable: 'asignaciones_maestro', ascending: false })
                .limit(20)
                .returns<ServidorRow[]>();
            if (!error && data) {
                setResults((data as unknown) as ServidorRow[]);
            } else {
                setResults([]);
            }
            setSearching(false);
        }, 300);
        return () => clearTimeout(h);
    }, [q, buscarModalVisible]);
    useEffect(() => {
        if (buscarModalVisible && results.length) setFocusIndex(0);
    }, [results, buscarModalVisible]);
    const applyPick = (s: ServidorRow) => {
        setDetalleSel(s);
        setDetalleTab('datos');
        setObsItems([]);
        setBuscarModalVisible(false);
        setDetalleVisible(true);
    };
    const onSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (!results.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            applyPick(results[focusIndex]);
        }
    };
    const pickResult = (s: ServidorRow) => {
      const rol = rolDesdeServidor(s);
      setForm(prev => ({
        ...prev,
        nombre: s.nombre ?? '',
        telefono: s.telefono ?? '',
        cedula: s.cedula ?? '',
        rol,
      }));
      if (rol === 'Contactos') {
        const a = getVigenteContacto(s);
        if (a) {
          setContactosDia(a.dia);
          setContactosSemana(`Semana ${a.semana ?? 1}`);
          if (a.etapa === 'Semillas')         selectNivel('Semillas',      nivelSemillasSel || '1');
          else if (a.etapa === 'Devocionales') selectNivel('Devocionales',  nivelDevSel      || '1');
          else if (a.etapa === 'Restauracion') selectNivel('Restauración',  nivelResSel      || '1');
        } else {
          setContactosDia('');
          setContactosSemana('Semana 1');
          setNivelSeleccionado('');
          setNivelSemillasSel('');
          setNivelDevSel('');
          setNivelResSel('');
        }
      } else if (rol === 'Maestros') {
        const a = getVigenteMaestro(s);
        if (a) {
          setContactosDia(a.dia);
          const det = parseEtapaDetFromDb(a.etapa);
          if (det) selectNivel(det.grupoUI, det.num);
          else {
            if (a.etapa === 'Semillas')         selectNivel('Semillas',      nivelSemillasSel || '1');
            else if (a.etapa === 'Devocionales') selectNivel('Devocionales',  nivelDevSel      || '1');
            else if (a.etapa === 'Restauracion') selectNivel('Restauración',  nivelResSel      || '1');
          }
          setContactosSemana('');
        } else {
          setContactosDia('');
          setContactosSemana('Semana 1');
          setNivelSeleccionado('');
          setNivelSemillasSel('');
          setNivelDevSel('');
          setNivelResSel('');
        }
      } else {
        setContactosDia('');
        setContactosSemana('Semana 1');
        setNivelSeleccionado('');
        setNivelSemillasSel('');
        setNivelDevSel('');
        setNivelResSel('');
      }
    };
    useEffect(() => {
        const loadObs = async () => {
            if (!detalleVisible || !detalleSel?.cedula) return;
            setObsLoading(true);
            try {
                let items: ObservacionRow[] = [];
                const q1 = await supabase
                    .from('observaciones_servidor')
                    .select('id, texto, created_at')
                    .eq('cedula', detalleSel.cedula)
                    .order('created_at', { ascending: false });
                if (!q1.error && q1.data) items = q1.data as ObservacionRow[];
                if ((!items || items.length === 0)) {
                    const sid = await findServidorIdByCedula(detalleSel.cedula);
                    if (sid) {
                        const q2 = await supabase
                            .from('observaciones_servidor')
                            .select('id, texto, created_at')
                            .eq('servidor_id', sid)
                            .order('created_at', { ascending: false });
                        if (!q2.error && q2.data) items = q2.data as ObservacionRow[];
                    }
                }
                setObsItems(items || []);
            } catch (err) {
                setObsItems([]);
            } finally {
                setObsLoading(false);
            }
        };
        loadObs();
    }, [detalleVisible, detalleSel?.cedula]);
    const actualizarDesdeDetalle = () => {
        if (!detalleSel) return;
        pickResult(detalleSel);
        setEditMode(true);
        setDetalleVisible(false);
    };
    const eliminarDesdeDetalle = async () => {
        if (!detalleSel?.cedula) return;
        const prevCed = form.cedula;
        setForm((f) => ({ ...f, cedula: detalleSel.cedula }));
        await onEliminar();
        setForm((f) => ({ ...f, cedula: prevCed }));
        setDetalleVisible(false);
        setConfirmDetalleDelete(false);
    };
    const resetFormulario = () => {
        setForm({
            nombre: '',
            telefono: '',
            cedula: '',
            rol: '',
            destino: [],
            cultoSeleccionado: '',
            observaciones: '',
            cultos: defaultCultos(),
        });
        setErrores({});
        setEditMode(false);
        setCedulaUnlocked(true);
        setAdminPassModalVisible(false);
        setAdminPassValue('');
        setAdminPassError(null);
        setContactosSemana('Semana 1');
        setContactosDia('');
        setNivelSeleccionado('');
        setNivelSemillasSel('');
        setNivelDevSel('');
        setNivelResSel('');
        setContactosModalVisible(false);
        setTimoteoModalVisible(false);
        setGuidedError(null);
        requestAnimationFrame(() => {
            inputNombreRef.current?.focus();
        });
    };
    const validateBeforeSave = (): boolean => {
        const mk = (k: 'nombre' | 'cedula' | 'rol' | 'etapa' | 'dia' | 'semana' | 'culto', msg: string) => {
            setErrores({ [k]: msg } as Errores);
            setGuidedError({ key: k, msg });
            if (k === 'nombre') {
                inputNombreRef.current?.focus();
            } else if (k === 'cedula') {
                inputCedulaRef.current?.focus();
            } else if (k === 'rol') {
                rolesCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (k === 'culto') {
                logisticaCultosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (k === 'etapa' || k === 'dia' || k === 'semana') {
                setContactosModalVisible(true);
                setTimeout(() => {
                    const el = k === 'etapa' ? modalEtapasRef.current : k === 'dia' ? modalDiaRef.current : modalSemanaRef.current;
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
            }
            return false;
        };
        if (esVacio(form.nombre)) return mk('nombre', 'Ingresa el nombre del servidor.');
        if (esVacio(form.cedula)) return mk('cedula', 'Ingresa la cédula del servidor.');
        if (esVacio(form.rol)) return mk('rol', 'Selecciona un rol para continuar.');
        if (rolEs(form.rol, 'Contactos')) {
            if (!toEtapaEnum(nivelSeleccionado ?? '')) return mk('etapa', 'Selecciona la etapa de aprendizaje.');
            if (!contactosDia) return mk('dia', 'Selecciona el día PTM.');
            if (!contactosSemana) return mk('semana', 'Selecciona la semana (1/2/3).');
        }
        if (rolEs(form.rol, 'Maestros')) {
            const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');
            if (!etapaDet) return mk('etapa', 'Selecciona la etapa con número (p. ej., Semillas 1).');
            if (!contactosDia) return mk('dia', 'Selecciona el día PTM.');
        }
        if (rolEs(form.rol, 'Logistica')) {
            const hasHora = !!trim(form.cultoSeleccionado);
            if (!hasHora) return mk('culto', 'Selecciona una hora de culto.');
        }
        setGuidedError(null);
        setErrores({});
        return true;
    };
    const toastClear = () => {
        if (feedbackTimer && feedbackTimer.current) {
            try { clearTimeout(feedbackTimer.current as any); } catch {}
            feedbackTimer.current = null;
        }
        setFeedback(null);
        if (setFeedbackKind) setFeedbackKind(null as any);
    };
    const toastShow = (kind: 'success' | 'error' | 'delete' | 'info', text: string) => {
        if (feedbackTimer && feedbackTimer.current) {
            try { clearTimeout(feedbackTimer.current as any); } catch {}
            feedbackTimer.current = null;
        }
        setFeedback(text);
        if (setFeedbackKind) setFeedbackKind(kind as any);
        const id = setTimeout(() => {
            setFeedback(null);
            if (setFeedbackKind) setFeedbackKind(null as any);
            if (feedbackTimer) feedbackTimer.current = null;
        }, 5000);
        if (feedbackTimer) feedbackTimer.current = id as any;
    };
    const onGuardar = async () => {
        clearToast();
        if (!validateBeforeSave()) return;
    
        const wasEdit = editMode;
        setBusy(true);
        try {
            const ced = trim(form.cedula);
            const nom = trim(form.nombre);
            const tel = trim(form.telefono);
    
            const { error: rpcError, data: servidorId } = await supabase.rpc('fn_upsert_servidor', {
                p_cedula: ced,
                p_nombre: nom,
                p_telefono: tel,
                p_email: null,
            });
    
            if (rpcError) throw rpcError;
            if (!servidorId) throw new Error('No se pudo obtener el ID del servidor tras la operación.');
    
            await supabase.from('asignaciones_contacto').update({ vigente: false }).eq('servidor_id', servidorId);
            await supabase.from('asignaciones_maestro').update({ vigente: false }).eq('servidor_id', servidorId);
            await supabase.from('asignaciones_logistica').update({ vigente: false }).eq('servidor_id', servidorId);

            if (rolEs(form.rol, 'Contactos')) {
                const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');
                if (!etapaDet) throw new Error('Etapa inválida para Contactos.');
                const { error } = await supabase.rpc('fn_asignar_contactos', {
                    p_cedula: ced, p_etapa: etapaDet, p_dia: contactosDia, p_semana: semanaNumero,
                });
                if (error) throw error;
    
            } else if (rolEs(form.rol, 'Maestros')) {
                const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');
                if (!etapaDet) throw new Error('Etapa inválida para Maestros.');
                const { error } = await supabase.rpc('fn_asignar_maestro', {
                    p_cedula: ced, p_etapa: etapaDet, p_dia: contactosDia,
                });
                if (error) throw error;
    
            } else if (rolEs(form.rol, 'Logistica')) {
                const full = trim(form.cultoSeleccionado);
                if (!full) throw new Error('Seleccione una hora de culto para Logística.');
                const [diaCulto, franja] = full.split(' - ').map(s => s.trim());
                if (!diaCulto || !franja) throw new Error('Selección de culto inválida.');
                
                const { error } = await supabase.rpc('fn_asignar_logistica', {
                    p_cedula: ced, p_dia: diaCulto, p_franja: franja
                });
                if (error) throw error;
            }
            // Para 'Director' y 'Administrador', no se necesita ninguna asignación operativa.
    
            await upsertRolVigente(servidorId);
            await saveObservacion(form.observaciones, servidorId);
    
            toastShow('success', wasEdit ? 'Servidor actualizado correctamente.' : 'Servidor guardado correctamente.');
            resetFormulario();
    
        } catch (e: any) {
            toastShow('error', `Error al guardar: ${e?.message ?? String(e)}`);
        } finally {
            setBusy(false);
        }
    };
    const findServidorIdByCedula = async (cedula: string): Promise<string | null> => {
        const { data, error } = await supabase
            .from('servidores')
            .select('id')
            .eq('cedula', cedula)
            .limit(1)
            .maybeSingle();
        if (error || !data) return null;
        return (data as any).id as string;
    };
    const upsertRolVigente = async (servidorId: string) => {
        const rolActual = trim(form.rol);
        if (!servidorId || !rolActual) {
            console.warn('No se puede actualizar el rol: falta servidorId o rol.');
            return;
        }
    
        try {
            const { error } = await supabase
                .from('servidores_roles')
                .upsert(
                    { 
                        servidor_id: servidorId, 
                        rol: rolActual, 
                        vigente: true 
                    },
                    { 
                        onConflict: 'servidor_id', 
                    }
                );
    
            if (error) {
                throw error;
            }
    
        } catch (e) {
            console.error('Error crítico al actualizar el rol vigente:', e);
            throw e; 
        }
    };
    const eliminarByCedula = async (ced?: string) => {
        const cedula = trim(ced ?? '');
        if (!cedula) return;
        setFeedback(null);
        setBusy(true);
        try {
            const sid = await findServidorIdByCedula(cedula);
            if (!sid) throw new Error('Servidor no encontrado');

            const up1 = await supabase.from('servidores').update({ activo: false }).eq('id', sid);
            if (up1.error) throw up1.error;

            const up2 = await supabase
                .from('asignaciones_contacto')
                .update({ vigente: false })
                .eq('servidor_id', sid);
            if (up2.error && up2.error.code !== 'PGRST116') throw up2.error;

            const up3 = await supabase
                .from('asignaciones_maestro')
                .update({ vigente: false })
                .eq('servidor_id', sid);
            if (up3.error && up3.error.code !== 'PGRST116') throw up3.error;
            
            const up4 = await supabase.from('servidores_roles').update({ vigente: false }).eq('servidor_id', sid);
            if (up4.error && up4.error.code !== 'PGRST116') throw up4.error;


            toastShow('delete', 'Eliminado (inactivado) correctamente.');
            setDetalleVisible(false);
            setConfirmDetalleDelete(false);
        } catch (e: any) {
            toastShow('error', `Error al eliminar: ${e?.message ?? e}`);
        } finally {
            setBusy(false);
        }
    };
    const saveObservacion = async (texto: string, servidorId: string): Promise<void> => {
        const obs = trim(texto);
        if (!obs || !servidorId) return;
        
        try {
            const { error } = await supabase.from('observaciones_servidor').insert({ servidor_id: servidorId, texto: obs });
            if (error) {
                console.warn('Fallo al guardar observación con servidor_id, intentando con cédula:', error.message);
                const ced = trim(form.cedula);
                await supabase.from('observaciones_servidor').insert({ cedula: ced, texto: obs });
            }
        } catch(e) {
            console.error("No se pudo guardar la observación:", e);
        }
    };
    const onEliminar = async () => {
        setFeedback(null);
        const ced = trim(form.cedula);
        if (!ced) {
            setErrores((prev) => ({ ...prev, cedula: 'Cédula es obligatoria para eliminar' }));
            return;
        }
        await eliminarByCedula(ced);
    };
    const abrirModalRol = async (valor: string) => {
        setErrores((prev) => ({ ...prev, rol: null, etapa: null, dia: null, semana: null, culto: null }));
        if (guidedError?.key === 'rol') setGuidedError(null);

        if (valor === 'Timoteos') {
            setForm((prev) => ({ ...prev, observaciones: '' }));
            setTimoteoModalVisible(true);
            return;
        }

        setForm((prev) => ({
            ...prev,
            rol: valor,
            cultoSeleccionado: valor === 'Logistica' ? prev.cultoSeleccionado : '',
            cultos: valor === 'Logistica' ? prev.cultos : defaultCultos(),
            destino: valor === 'Maestros' ? prev.destino : [],
            observaciones: '',
        }));

        if (valor === 'Contactos' || valor === 'Maestros') {
            setContactosModalVisible(true);
        } else {
            setContactosModalVisible(false);
        }
    };
    const elegirTimoteoDestino = (destino: 'Contactos' | 'Maestros' | 'Logistica') => {
        const compuesto = `Timoteo - ${destino}`;
        setForm((prev) => ({
            ...prev,
            rol: compuesto,
            cultoSeleccionado: destino === 'Logistica' ? prev.cultoSeleccionado : '',
            cultos: destino === 'Logistica' ? prev.cultos : defaultCultos(),
            observaciones: '',
        }));
        if (guidedError?.key === 'rol') setGuidedError(null);
        setTimoteoModalVisible(false);

        if (destino === 'Contactos' || destino === 'Maestros') {
            setContactosModalVisible(true);
        }
    };

    /* ===== 4. INICIO DEL BLOQUE JSX REFACTORIZADO ===== */
    return (
        <>
            {/* El formulario principal ahora usa los componentes premium */}
            <GlassCard>
                <CardHeader 
                    IconComponent={Server} 
                    title="Gestión de Servidores" 
                    subtitle="Crear, editar y asignar roles a todos los servidores del ministerio."
                >
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setQ(''); setResults([]); setFocusIndex(0); setBuscarModalVisible(true); }}
                            disabled={busy}
                            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                            <Search size={16} />
                            Buscar
                        </button>
                        <button 
                            onClick={abrirListado} 
                            disabled={busy} 
                            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                            <List size={16} />
                            Ver Listado
                        </button>
                    </div>
                </CardHeader>
                
                {/* Contenido del formulario con padding */}
                <div className="p-6">
                    {/* Fila 1: Datos Personales (3 columnas) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mb-6">
                        <FormInput
                            label="Nombre Completo"
                            id="nombre"
                            inputRef={inputNombreRef}
                            value={form.nombre}
                            onChange={(e) => {
                                const value = e.target.value;
                                setForm((f) => ({ ...f, nombre: value }));
                                if (value.trim()) setErrores((prev: Errores) => ({ ...prev, nombre: null }));
                                if (guidedError?.key === 'nombre' && value.trim()) setGuidedError(null);
                            }}
                            placeholder="Nombre y Apellido"
                            error={errores.nombre}
                            guidedError={guidedError}
                        />

                        <FormInput
                            label="Teléfono"
                            id="telefono"
                            value={form.telefono}
                            onChange={(e) => {
                                const value = e.target.value;
                                setForm((f) => ({ ...f, telefono: value }));
                                if (/\d{7,}/.test(value)) setErrores((prev: Errores) => ({ ...prev, telefono: null }));
                            }}
                            placeholder="Ej: 3101234567"
                            error={errores.telefono}
                        />

                        <FormInput
                            label="Cédula"
                            id="cedula"
                            inputRef={inputCedulaRef}
                            value={editMode && !cedulaUnlocked ? maskCedulaValue(form.cedula) : form.cedula}
                            onChange={(e) => {
                                if (editMode && !cedulaUnlocked) return;
                                setForm((f) => ({ ...f, cedula: e.target.value }));
                                if (e.target.value.trim()) setErrores((prev) => ({ ...prev, cedula: null }));
                                if (guidedError?.key === 'cedula' && e.target.value.trim()) setGuidedError(null);
                            }}
                            onFocus={(e) => {
                                if (editMode && !cedulaUnlocked) {
                                    e.target.blur();
                                    openAdminPassModal();
                                }
                            }}
                            onMouseDown={(e) => {
                                if (editMode && !cedulaUnlocked) {
                                    e.preventDefault();
                                    openAdminPassModal();
                                }
                            }}
                            placeholder="Documento de identidad"
                            readOnly={editMode && !cedulaUnlocked}
                            error={errores.cedula}
                            guidedError={guidedError}
                        />
                    </div>

                    {/* Fila 2: Roles (Tarjetas Premium) */}
                    <div className="mt-8" ref={rolesCardRef}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rol del Servidor</h3>
                        {guidedError?.key === 'rol' && (
                            <p className="mb-2 text-xs font-semibold text-red-600">
                                {guidedError.msg}
                            </p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {[...ROLES_FILA_1, ...ROLES_FILA_2].map((r) => {
                                const checked = form.rol === r || form.rol === `Timoteo - ${r}`;
                                return (
                                    <label key={r} className="cursor-pointer">
                                        <input
                                            type="radio"
                                            name="rol-servidor"
                                            value={r}
                                            className="sr-only" // Oculto, la UI la maneja el div
                                            checked={checked}
                                            onChange={(e) => abrirModalRol(e.target.value)}
                                            onClick={(e) => {
                                                const valor = (e.currentTarget as HTMLInputElement).value;
                                                if (valor === 'Timoteos') setTimoteoModalVisible(true);
                                                else if (valor === 'Contactos' || valor === 'Maestros') setContactosModalVisible(true);
                                            }}
                                        />
                                        <div className={`
                                            flex flex-col items-center justify-center
                                            p-4 h-24 rounded-lg border-2
                                            transition-all duration-200
                                            ${checked
                                              ? 'bg-indigo-50 border-indigo-500 shadow-lg scale-[1.03]' 
                                              : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                            }
                                        `}>
                                            <span className={`font-semibold text-sm ${checked ? 'text-indigo-700' : 'text-gray-700'}`}>
                                                {uiRoleLabel(r)}
                                            </span>
                                            {/* Icono (opcional) o descripción */}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fila 3: Opciones de Logística (Condicional) */}
                    {rolEs(form.rol, 'Logistica') && (
                        <div className="mt-8" ref={logisticaCultosRef}>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Asignación de Logística</h3>
                            <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-white/50 border ${errores.culto ? 'border-red-300' : 'border-gray-200'}`}>
                                {Object.entries(form.cultos).map(([dia, valorActual]) => (
                                    <div key={dia} className="relative">
                                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">{dia}</label>
                                        <select
                                            value={valorActual === dia ? "" : `${dia} - ${valorActual}`}
                                            onChange={(e) => {
                                                const full = e.target.value;
                                                if (!full) return;
                                                const [diaCulto, opcion] = full.split(' - ').map(s => s.trim());
                                                
                                                const updated: CultosMap = {
                                                    ...defaultCultos(),
                                                    [diaCulto as DiaKey]: opcion,
                                                } as CultosMap;
                                                
                                                setForm((prev) => ({
                                                    ...prev,
                                                    cultoSeleccionado: full,
                                                    cultos: updated,
                                                }));
                                                setErrores((prev) => ({ ...prev, culto: null }));
                                                if (guidedError?.key === 'culto') setGuidedError(null);
                                            }}
                                            className={`w-full rounded-lg border bg-white/50 py-2.5 px-4 text-sm text-gray-900
                                                        transition-all duration-200
                                                        focus:outline-none focus:ring-2 focus:ring-indigo-500
                                                        ${errores.culto ? 'border-red-500' : 'border-gray-300'}`}
                                        >
                                            <option value="">Selecciona...</option>
                                            {cultosOpciones[dia as DiaKey].map((opcion, index) => (
                                                <option key={index} value={`${dia} - ${opcion}`}>
                                                    {opcion}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            {guidedError?.key === 'culto' && (
                                <p className="mt-1.5 text-xs font-semibold text-red-600">
                                    {guidedError.msg}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Fila 4: Observaciones */}
                    <div className="mt-8">
                        <label htmlFor="observaciones" className="block text-lg font-semibold text-gray-900 mb-4">
                            Observaciones
                        </label>
                        {/* --- INICIO DE LA CORRECCIÓN --- */}
                        <textarea
                            ref={observacionesRef}
                            id="observaciones"
                            rows={4}
                            className={`w-full rounded-lg border bg-white/50 py-2.5 px-4 text-sm text-gray-900 placeholder-gray-500 shadow-sm transition-all duration-200 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            placeholder="Escribe aquí las observaciones..."
                            value={form.observaciones}
                            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                        />
                        {/* --- FIN DE LA CORRECCIÓN --- */}
                    </div>

                    {/* Fila 5: Acciones */}
                    <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                        <button 
                            onClick={onGuardar} 
                            disabled={busy}
                            className="flex items-center justify-center gap-2 w-full md:w-auto rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
                        >
                            {busy ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            {busy ? (editMode ? 'Actualizando…' : 'Guardando…') : (editMode ? 'Actualizar Servidor' : 'Guardar Servidor')}
                        </button>
                        
                        <button 
                            onClick={resetFormulario} 
                            disabled={busy}
                            className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60"
                        >
                            Limpiar
                        </button>

                        {editMode && (
                            <button 
                                onClick={handleDeleteButtonClick} 
                                disabled={busy}
                                className="ml-auto flex items-center justify-center gap-2 rounded-lg bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 transition-all hover:bg-red-100 active:scale-[0.98] disabled:opacity-60"
                            >
                                <Trash2 size={16} />
                                Eliminar
                            </button>
                        )}
                    </div>
                    {/* Toast (Tostada de feedback) */}
                    {feedback && (
                        <div className="mt-4" role="status" aria-live="polite">
                            <div className={`flex items-center gap-3 rounded-lg p-3 text-sm font-semibold
                                ${feedbackKind === 'success' ? 'bg-green-50 text-green-800 ring-1 ring-green-200' : ''}
                                ${feedbackKind === 'error' ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : ''}
                                ${feedbackKind === 'delete' ? 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200' : ''}
                            `}>
                                <Check size={16} />
                                {feedback}
                            </div>
                        </div>
                    )}

                </div>
            </GlassCard>

            {/* --- 3. MODAL DE LISTADO REFACTORIZADO --- */}
            <AnimatePresence>
                {listadoVisible && (
                    <motion.div
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
                        onClick={cerrarListado}
                    >
                        <motion.div
                            variants={modalVariants}
                            className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={cerrarListado}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                            >
                                <X size={20} />
                            </button>
                            
                            {/* Header del Modal */}
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900">Listado de Servidores</h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    Mostrando {Math.min(listPage*listPageSize, listTotal)} de {listTotal} servidores activos.
                                </p>
                            </div>
                            
                            {/* Contenido del Modal (con scroll) */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="inline-block min-w-full align-middle">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cédula</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Día</th>
                                                <th scope="col" className="relative px-6 py-3">
                                                    <span className="sr-only">Acción</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {listLoading ? (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                                                        <Loader2 size={20} className="inline animate-spin mr-2" />
                                                        Cargando...
                                                    </td>
                                                </tr>
                                            ) : listRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                                                        No se encontraron servidores.
                                                    </td>
                                                </tr>
                                            ) : (
                                                listRows.map((s, i) => (
                                                    <tr key={s.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                                                            {(listPage-1)*listPageSize + i + 1}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{s.nombre || '—'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{s.telefono || '—'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{maskCedulaDisplay(s.cedula)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                {uiRoleLabel(roleFromRow(s))}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{etapaDiaFromRow(s).etapa}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{etapaDiaFromRow(s).dia}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button 
                                                                onClick={() => { applyPick(s); cerrarListado(); }}
                                                                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
                                                            >
                                                                Seleccionar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Footer del Modal (Paginación) */}
                            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                                <button 
                                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
                                    onClick={() => cargarListado(Math.max(1, listPage-1))} 
                                    disabled={listPage<=1 || listLoading}
                                >
                                    ◀ Anterior
                                </button>
                                <span className="text-sm text-gray-600">
                                    Página {listPage} de {Math.max(1, Math.ceil(listTotal / listPageSize))}
                                </span>
                                <button 
                                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
                                    onClick={() => cargarListado(listPage+1)} 
                                    disabled={listPage>=Math.ceil(listTotal / listPageSize) || listLoading}
                                >
                                    Siguiente ▶
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* --- Modales Antiguos (Lógica intacta, estilos en <style jsx>) --- */}
            {/* ... (Timoteo, Contactos, Buscar, Detalle, AdminPass, ConfirmDelete) ... */}
            {timoteoModalTransition.shouldRender && (
                <div
                    className="srv-modal"
                    role="dialog"
                    aria-modal="true"
                    data-state={timoteoModalTransition.transitionState}
                >
                    <div
                        className="srv-modal__box"
                        data-state={timoteoModalTransition.transitionState}
                        style={{ maxWidth: 640, padding: '24px 24px 18px', borderRadius: 18 }}
                    >
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={() => setTimoteoModalVisible(false)}>
                            ×
                        </button>

                        <div className="srv-modal__content" style={{ paddingTop: 4 }}>
                            <h4
                                className="srv-section__title"
                                style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}
                            >
                                ¿Timoteo para qué área?
                            </h4>
                            <div
                                className="srv-roles-grid"
                                style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}
                            >
                                {(['Maestros', 'Contactos', 'Logistica'] as const).map((dest) => (
                                    <label key={dest} className="srv-radio" style={{ flex: '0 0 auto' }}>
                                        <input
                                            type="radio"
                                            name="timoteo-destino"
                                            className="srv-radio-input"
                                            onChange={() => elegirTimoteoDestino(dest)}
                                        />
                                        <div
                                            className="srv-radio-card"
                                            style={{ padding: '10px 16px', borderRadius: 12, minWidth: 130, display: 'inline-flex', gap: 10 }}
                                        >
                                            <span className="srv-radio-dot" />
                                            <span className="srv-radio-text" style={{ fontWeight: 600 }}>{dest}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <p className="srv-info" style={{ marginTop: 18, lineHeight: 1.35 }}>
                                Se registrará como <b>Timoteo - …</b> y se configurarán las opciones del área elegida.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {contactosModalTransition.shouldRender && (
                <div
                    className="srv-modal"
                    role="dialog"
                    aria-modal="true"
                    data-state={contactosModalTransition.transitionState}
                >
                    <div
                        className="srv-modal__box"
                        data-state={contactosModalTransition.transitionState}
                        style={{
                            width: rolEs(form.rol, 'Maestros') ? 'min(92vw, 820px)' : 'min(92vw, 1000px)',
                            maxHeight: '92vh',
                            padding: '24px 24px 20px',
                            borderRadius: 18,
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={() => setContactosModalVisible(false)}>
                            ×
                        </button>

                        <div
                            className="srv-modal__content"
                            style={{ flex: '1 1 auto', overflow: 'visible' }}
                        >
                            <div className="srv-modal-grid">
                                <section className="srv-card" ref={modalDiaRef}>
                                    <h4 className="srv-card__title">Día PTM</h4>
                                    <div className="srv-card__content">
                                        <div className="srv-switches srv-switches--modal">
                                            {(['Domingo', 'Martes', 'Virtual'] as AppEstudioDia[]).map((d) => (
                                                <label key={d} className="srv-switch">
                                                    <input
                                                        type="checkbox"
                                                        className="srv-switch-input"
                                                        checked={contactosDia === d}
                                                        onChange={(e) => { const val = e.target.checked ? d : ''; setContactosDia(val); if (guidedError?.key === 'dia' && val) setGuidedError(null); }}
                                                    />
                                                    <span className="srv-switch-slider" />
                                                    {d}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {guidedError?.key === 'dia' && (
                                        <div className="srv-callout" role="alert" style={{ marginTop: 8 }}>
                                            <span className="srv-callout-icon">!</span>
                                            {guidedError.msg}
                                        </div>
                                    )}
                                </section>
                            </div>

                            <section className="srv-section" ref={modalEtapasRef}>
                                <h4 className="srv-section__title">Etapas de Aprendizaje</h4>
                                {guidedError?.key === 'etapa' && (
                                    <div className="srv-callout" role="alert" style={{ marginTop: 8 }}>
                                        <span className="srv-callout-icon">!</span>
                                        {guidedError.msg}
                                    </div>
                                )}

                                <div className="srv-cultos srv-cultos--niveles" style={{ flexWrap: 'wrap', gap: '16px' }}>
                                    <div className="srv-culto-box" style={{ minWidth: 220 }}>
                                        {nivelSemillasSel ? `Semillas ${nivelSemillasSel}` : 'Semillas'}
                                        <ul className="srv-culto-lista" style={{ display: 'flex', gap: 10, padding: 10 }}>
                                            {['1', '2', '3', '4'].map((n) => (
                                                <li key={`sem-${n}`} style={{ padding: 0 }}>
                                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}>
                                                        <input type="radio" name="nivel-semillas" checked={nivelSemillasSel === n} onChange={() => selectNivel('Semillas', n)} />
                                                        <span>{n}</span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="srv-culto-box" style={{ minWidth: 220 }}>
                                        {nivelDevSel ? `Devocionales ${nivelDevSel}` : 'Devocionales'}
                                        <ul className="srv-culto-lista" style={{ display: 'flex', gap: 10, padding: 10 }}>
                                            {['1', '2', '3', '4'].map((n) => (
                                                <li key={`dev-${n}`} style={{ padding: 0 }}>
                                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}>
                                                        <input type="radio" name="nivel-dev" checked={nivelDevSel === n} onChange={() => selectNivel('Devocionales', n)} />
                                                        <span>{n}</span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="srv-culto-box" style={{ minWidth: 220 }}>
                                        {nivelResSel ? `Restauración ${nivelResSel}` : 'Restauración'}
                                        <ul className="srv-culto-lista" style={{ display: 'flex', gap: 10, padding: 10 }}>
                                            {['1'].map((n) => (
                                                <li key={`res-${n}`} style={{ padding: 0 }}>
                                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}>
                                                        <input type="radio" name="nivel-res" checked={nivelResSel === n} onChange={() => selectNivel('Restauración', n)} />
                                                        <span>{n}</span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="srv-actions srv-modal__actions" style={{ marginTop: 18 }}>
                            <button className="srv-btn" onClick={() => setContactosModalVisible(false)}>
                                Cancelar
                            </button>
                            <button className="srv-btn srv-btn-buscar" onClick={confirmarModalContactos}>
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {buscarModalVisible && (
                <div className="srv-modal search-modal" role="dialog" aria-modal="true">
                    <div className="srv-modal__box search-box">
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={() => setBuscarModalVisible(false)}>
                            ×
                        </button>

                        <div className="srv-modal__content">
                            <h4 className="search-title">Buscar Registros en Base de Datos</h4>

                            <div className="search-input-wrap">
                                <input
                                    className="search-input"
                                    placeholder={`Busca por nombre, teléfono o cédula… (mín. ${MIN_SEARCH})`}
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onKeyDown={onSearchKeyDown}
                                    autoFocus
                                />
                                {searching && <span className="search-spinner" aria-hidden>•••</span>}
                            </div>

                            <div className="search-list" role="listbox" aria-label="Resultados de búsqueda">
                                {results.map((s, idx) => {
                                    const active = idx === focusIndex;
                                    return (
                                        <button
                                            key={s.id}
                                            className={`search-item${active ? ' is-active' : ''}`}
                                            onClick={() => applyPick(s)}
                                            role="option"
                                            aria-selected={active}
                                        >
                                            <div className="search-line">
                                                <span className="search-name">{s.nombre || '—'}</span>
                                            </div>

                                            <div className="search-meta">
                                                <span className="meta-item">
                                                  <label>Teléfono:</label> {s.telefono || '—'}
                                                </span>
                                                <span className="meta-dot">•</span>
                                                <span className="meta-item">
                                                   <label>Cédula:</label> {maskCedulaDisplay(s.cedula)}
                                                </span>
                                                <span className="meta-dot">•</span>
                                                <span className="meta-item">
                                                  <label>Rol:</label> {uiRoleLabel(roleFromRow(s))}
                                                </span>
                                                <span className="meta-dot">•</span>
                                                <span className="meta-item">
                                                  <label>Etapa:</label> {etapaDiaFromRow(s).etapa}
                                                </span>
                                                <span className="meta-dot">•</span>
                                                <span className="meta-item">
                                                  <label>Día:</label> {etapaDiaFromRow(s).dia}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}

                                {!searching && results.length === 0 && trim(q).length >= MIN_SEARCH && (
                                    <div className="search-empty">Sin resultados. Prueba con otro término.</div>
                                )}
                            </div>
                        </div>

                        <div className="srv-actions srv-modal__actions">
                            <button className="srv-btn" onClick={() => setBuscarModalVisible(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {detalleVisible && detalleSel && (
                <div className="srv-modal" role="dialog" aria-modal="true">
                    <div className="srv-modal__box view-box">
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={() => setDetalleVisible(false)}>
                            ×
                        </button>

                        <div className="view-layout">
                            <div className="view-content">
                                {detalleTab === 'datos' && (
                                    <div className="view-section">
                                        <h4 className="view-title">Datos Personales</h4>
                                        <div className="view-grid">
                                            <div className="view-row"><label>Nombre:</label> <span>{detalleSel.nombre || '—'}</span></div>
                                            <div className="view-row"><label>Teléfono:</label> <span>{detalleSel.telefono || '—'}</span></div>
                                            <div className="view-row"><label>Cédula:</label> <span>{maskCedulaDisplay(detalleSel.cedula)}</span></div>
                                            <div className="view-row"><label>Rol:</label> <span>{uiRoleLabel(roleFromRow(detalleSel))}</span></div>
                                            <div className="view-row"><label>Día:</label> <span>{((detalleSel.asignaciones_contacto?.find(a => a.vigente)?.dia ?? detalleSel.asignaciones_maestro?.find(a => a.vigente)?.dia) || (detalleSel.asignaciones_contacto?.find(a => a.vigente)?.dia ?? detalleSel.asignaciones_maestro?.find(a => a.vigente)?.dia) || '—')}</span></div>
                                            <div className="view-row"><label>Etapa:</label> <span>{((detalleSel.asignaciones_contacto?.find(a => a.vigente)?.etapa ?? detalleSel.asignaciones_maestro?.find(a => a.vigente)?.etapa) || (detalleSel.asignaciones_contacto?.find(a => a.vigente)?.etapa ?? detalleSel.asignaciones_maestro?.find(a => a.vigente)?.etapa) || '—')}</span></div>
                                        </div>
                                        <h4 className="view-title" style={{ marginTop: 16 }}>Historial de Observaciones</h4>
                                        <div className="view-obs">
                                            {obsLoading && <div className="view-obs-empty">Cargando…</div>}
                                            {!obsLoading && obsItems.length === 0 && <div className="view-obs-empty">Sin observaciones registradas.</div>}
                                            {!obsLoading && obsItems.length > 0 && (
                                                <ul className="view-obs-list">
                                                    {obsItems.map((o, i) => (
                                                        <li key={o.id ?? i}>
                                                            <div className="view-obs-text">{o.texto || '—'}</div>
                                                            {o.created_at && <div className="view-obs-date">{new Date(o.created_at).toLocaleString()}</div>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {detalleTab === 'actualizar' && (
                                    <div className="view-section">
                                        <h4 className="view-title">Actualizar Datos</h4>
                                        <p className="srv-info" style={{ marginBottom: 12 }}>Cargar este servidor en el formulario para editar.</p>
                                        <div className="srv-actions">
                                            <button className="srv-btn srv-btn-buscar" onClick={actualizarDesdeDetalle}>Cargar para Actualizar</button>
                                        </div>
                                        <div style={{ marginTop: 10 }}>
                                            <small className="srv-info">El botón principal del formulario cambiará a “Actualizar”.</small>
                                        </div>
                                        <div className="srv-actions" style={{ marginTop: 18 }}>
                                            <button className="srv-btn" style={{ background: '#ffe8e8' }} onClick={handleDeleteButtonClick}>Eliminar Servidor</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <aside className="view-sidebar">
                                <button className={`view-item${detalleTab === 'datos' ? ' is-active' : ''}`} onClick={() => setDetalleTab('datos')}>Datos Personales</button>
                                <button className={`view-item${detalleTab === 'actualizar' ? ' is-active' : ''}`} onClick={() => setDetalleTab('actualizar')}>Actualizar Datos</button>
                                <button className="view-item view-item-danger" onClick={handleDeleteButtonClick}>Eliminar Servidor</button>
                                <button className="view-item" onClick={volverABuscar}>Atras</button>
                            </aside>
                        </div>
                    </div>
                </div>
            )}

            {adminPassModalVisible && (
                <div className="srv-modal" role="dialog" aria-modal="true">
                    <div className="srv-modal__box premium-box">
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={closeAdminPassModal}>×</button>
                        <div className="premium-content">
                            <h4 className="premium-title">Acceso premium requerido</h4>
                            <p className="premium-text">Ingresa la contrasena del administrador para editar la cedula.</p>
                            <form onSubmit={handleAdminPassSubmit}>
                                <label className="premium-label" htmlFor="admin-pass">Contrasena del administrador</label>
                                <input
                                    id="admin-pass"
                                    ref={adminPasswordRef}
                                    type="password"
                                    value={adminPassValue}
                                    onChange={(e) => {
                                        setAdminPassValue(e.target.value);
                                        if (adminPassError) setAdminPassError(null);
                                    }}
                                    className={adminPassError ? 'srv-input-error' : ''}
                                    placeholder="********"
                                    autoComplete="off"
                                />
                                {adminPassError && <div className="srv-error">** {adminPassError}</div>}
                                <div className="srv-actions" style={{ marginTop: 18 }}>
                                    <button type="button" className="srv-btn" onClick={closeAdminPassModal}>Cancelar</button>
                                    <button type="submit" className="srv-btn srv-btn-primary">Desbloquear</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {detalleVisible && confirmDetalleDelete && detalleSel && (
                <div className="srv-modal" role="dialog" aria-modal="true">
                    <div className="srv-modal__box confirm-box">
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={() => setConfirmDetalleDelete(false)}>×</button>
                        <div className="confirm-content">
                            <h4 className="confirm-title">¿Eliminar servidor?</h4>
                            <p className="confirm-text">
                                Esta acción inactivará al servidor y sus asignaciones.
                            </p>
                            <div className="confirm-data">
                                <div><strong>Nombre:</strong> {detalleSel.nombre || '—'}</div>
                                <div><strong>Cédula:</strong> {maskCedulaDisplay(detalleSel.cedula)}</div>
                            </div>
                            <div className="srv-actions" style={{ marginTop: 14 }}>
                                <button className="srv-btn" onClick={() => setConfirmDetalleDelete(false)}>Cancelar</button>
                                <button className="srv-btn" style={{ background: '#ffe8e8' }} onClick={() => eliminarByCedula(detalleSel.cedula)} disabled={busy}>
                                    {busy ? 'Eliminando…' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 5. BLOQUE <style jsx> LIMPIADO --- */}
            {/* Se eliminaron .srv-root, .srv-box, .srv-row, .srv-roles-card, y todos los estilos del listado */}
            <style jsx>{`
                /* --- Estilos de Cultos (Dropdown) --- */
                .srv-cultos{
                    display:flex;
                    align-items:center;
                    gap:1rem;
                    row-gap:1rem;
                    flex-wrap:wrap;
                    margin:2rem 0;
                }
                .srv-label-culto{ font-weight:600; margin-right:12px; }
                .srv-culto-box{
                    position:relative;
                    flex:0 0 auto;
                    font-weight:700;
                    padding:8px 12px;
                    border:1px solid var(--srv-border, #e5e7eb);
                    border-radius:14px;
                    background:var(--srv-surface, #fff);
                    cursor:pointer;
                    user-select:none;
                    outline:none;
                }
                .srv-culto-box::after{
                    content:""; position:absolute; left:0; right:0; top:100%; height:8px;
                }
                .srv-culto-lista{
                    position:absolute;
                    top:100%;
                    left:50%;
                    transform:translateX(-50%) scaleY(0);
                    transform-origin:top center;
                    background:var(--srv-surface, #fff);
                    border:1px solid var(--srv-border, #e5e7eb);
                    border-radius:8px;
                    padding:10px;
                    min-width:140px;
                    box-shadow:0 6px 16px rgba(0,0,0,.08);
                    opacity:0; pointer-events:none;
                    transition:opacity .25s ease-out, transform .25s ease-out;
                    z-index:20;
                }
                .srv-culto-box:hover .srv-culto-lista,
                .srv-culto-box:focus-within .srv-culto-lista{
                    opacity:1; pointer-events:auto; transform:translateX(-50%) scaleY(1);
                }
                .srv-culto-lista li{
                    list-style:none;
                    padding:12px 14px;
                    text-align:center;
                    font-weight:600;
                    border-radius:12px;
                    cursor:pointer;
                    color:#1e293b;
                    transition:transform .2s, background .2s, color .2s;
                }
                .srv-culto-lista li:hover{
                    background:#f3f4f6;
                    transform:scale(1.05);
                    color:#1e40af;
                }
                .srv-culto-box.is-disabled{ opacity:.5; cursor:not-allowed; }

                /* --- Estilos de Switches (Modal) --- */
                .srv-switches{ display:flex; flex-wrap:wrap; gap:1rem; margin-bottom:20px; }
                .srv-switch{
                    position:relative;
                    display:flex;
                    align-items:center;
                    gap:.5rem;
                    font-weight:600;
                    color: var(--srv-muted, #1e293b);
                    cursor:pointer;
                    padding-left:40px;
                    user-select:none;
                }
                .srv-switch-input{ display:none; }
                .srv-switch-slider{
                    position:absolute; left:0; top:50%; transform:translateY(-50%);
                    width:36px; height:20px;
                    background:#f3f4f6; border:1px solid var(--srv-border, #e5e7eb);
                    border-radius:20px;
                    transition:background .2s, border-color .2s;
                }
                .srv-switch-slider::before{
                    content:""; position:absolute; left:2px; top:2px;
                    width:16px; height:16px; border-radius:50%;
                    background:#94a3b8;
                    transition:transform .18s, background .18s;
                }
                .srv-switch-input:checked + .srv-switch-slider{
                    background:#d1fae5; border-color:#a7f3d0;
                }
                .srv-switch-input:checked + .srv-switch-slider::before{
                    transform:translateX(16px); background:var(--srv-success, #10b981);
                }
                
                /* --- Estilos de Radios (Modal Timoteo) --- */
                .srv-roles-grid{
                    display:grid;
                    grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
                    gap:12px;
                    max-width: 800px;
                }
                .srv-radio{ display:block; }
                .srv-radio-input{ position:absolute; opacity:0; pointer-events:none; width:0; height:0; }
                .srv-radio-card{
                    display:flex; align-items:center; gap:10px;
                    border:1px solid var(--srv-border, #e5e7eb);
                    border-radius:12px; padding:12px 14px;
                    background:#f6f7fb;
                    box-shadow:0 1px 2px rgba(16,24,40,.06);
                    transition: box-shadow .2s, transform .06s, border-color .2s, background .2s;
                    min-width: 180px;
                    justify-content:flex-start;
                }
                .srv-radio:hover .srv-radio-card{ box-shadow:0 8px 20px rgba(16,24,40,.12); }
                .srv-radio-input:focus-visible + .srv-radio-card{
                    outline:2px solid rgba(59,130,246,.6); outline-offset:2px;
                }
                .srv-radio-input:checked + .srv-radio-card{
                    border-color:#60a5fa;
                    background:linear-gradient(180deg, rgba(59,130,246,.08), rgba(59,130,246,.02));
                    box-shadow:0 10px 24px rgba(16,24,40,.14);
                }
                .srv-radio-dot{
                    display:inline-grid; place-items:center; width:16px; height:16px;
                    border-radius:999px; border:1px solid #9ca3af; background:#fff;
                }
                .srv-radio-input:checked + .srv-radio-card .srv-radio-dot{ border-color:#2563eb; }
                .srv-radio-dot::after{
                    content:''; width:10px; height:10px; border-radius:999px; background:#2563eb;
                    opacity:0; transition:opacity .15s;
                }
                .srv-radio-input:checked + .srv-radio-card .srv-radio-dot::after{ opacity:1; }
                .srv-radio-text{ color:#111827; }

                /* --- Estilos de Botones (Modales) --- */
                .srv-actions{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:16px; }
                .srv-btn{
                    border:1px solid var(--srv-border, #e5e7eb);
                    background:var(--srv-surface, #fff);
                    color:var(--srv-text, #111827);
                    padding:10px 16px;
                    border-radius:12px;
                    font-weight:700;
                    cursor:pointer;
                    transition:border-color .18s, color .18s, transform .06s;
                }
                .srv-btn:hover{ border-color:var(--srv-brand, #4f46e5); color:var(--srv-brand, #4f46e5); transform:translateY(-1px); }
                .srv-btn:disabled{ opacity:.55; cursor:not-allowed; }
                .srv-btn--update{ background:#fff6e5; border-color:#f59e0b; color:#b45309; }
                .srv-btn-buscar{ color:#22c55e; border-color:rgba(34,197,94,.35); }

                /* --- Estilos de Errores (Modales) --- */
                .srv-input-error{ border-color:#ef4444; }
                .srv-error{ margin-top:6px; font-size:12px; color:#ef4444; }
                .srv-error--center{ text-align:center; }

                /* --- Estilos de Modal (Generales) --- */
                .srv-modal{ position:fixed; inset:0; background:rgba(17,24,39,.45); display:grid; place-items:center; z-index:50; padding:12px; box-sizing:border-box; }
                .srv-modal__box{
                    width:min(720px,92vw);
                    max-height:min(92dvh, calc(100dvh - 24px));
                    background:var(--srv-surface, #fff);
                    border:1px solid var(--srv-border, #e5e7eb);
                    border-radius:16px;
                    padding:18px;
                    box-shadow:0 24px 60px rgba(0,0,0,.22);
                    position:relative;
                    display:flex;
                    flex-direction:column;
                    overflow:hidden;
                }
                .srv-modal__box > *{ min-height: 0; }
                .srv-modal[data-state]{
                    opacity:0;
                    transform:translate3d(0,6px,0) scale(.98);
                    transition:opacity .22s ease, transform .22s ease;
                    will-change:opacity, transform;
                }
                .srv-modal[data-state="entering"],
                .srv-modal[data-state="entered"]{
                    opacity:1;
                    transform:none;
                }
                .srv-modal[data-state="exiting"]{
                    opacity:0;
                    transform:translate3d(0,6px,0) scale(.98);
                }
                .srv-modal__box[data-state]{
                    opacity:0;
                    transform:translate3d(0,18px,0) scale(.99);
                    transition:opacity .26s cubic-bezier(.22,1,.36,1), transform .26s cubic-bezier(.22,1,.36,1);
                    will-change:opacity, transform;
                }
                .srv-modal__box[data-state="entering"],
                .srv-modal__box[data-state="entered"]{
                    opacity:1;
                    transform:none;
                }
                .srv-modal__box[data-state="exiting"]{
                    opacity:0;
                    transform:translate3d(0,18px,0) scale(.99);
                }
                @media (prefers-reduced-motion: reduce){
                    .srv-modal[data-state],
                    .srv-modal__box[data-state]{
                        transition:none;
                        transform:none;
                    }
                }
                .srv-modal__close{
                    position:absolute; right:8px; top:6px;
                    width:36px; height:36px; border-radius:10px;
                    border:1px solid var(--srv-border, #e5e7eb); background:var(--srv-surface, #fff);
                    font-size:20px; line-height:1; cursor:pointer;
                }
                .srv-modal__heading{ font-weight:700; margin:6px 0 12px; }
                .srv-modal__content{
                    flex:1 1 auto;
                    min-height:0;
                    overflow:auto;
                    -webkit-overflow-scrolling:touch;
                }
                .srv-modal__box .view-layout{
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow: auto;
                }
                
                /* (Resto de los estilos de .search-box, .view-box, .premium-box, etc., permanecen intactos) */
                .search-box {
                    max-width: 760px;
                    padding: 22px 22px 16px;
                    border-radius: 22px;
                    background: radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.9), rgba(246,248,255,0.9));
                    box-shadow:
                            inset 8px 8px 24px rgba(255,255,255,0.45),
                            inset -8px -8px 22px rgba(0,0,0,0.05),
                            0 24px 50px rgba(0,0,0,0.35);
                    backdrop-filter: blur(18px);
                    border: 1px solid rgba(255,255,255,0.6);
                }
                .search-title{
                    margin: 0 0 12px;
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: .2px;
                }
                .search-input-wrap{
                    position: relative;
                    margin-bottom: 12px;
                }
                .search-input{
                    width: 100%;
                    height: 48px;
                    padding: 0 18px;
                    border-radius: 14px;
                    border: 1px solid rgba(0,0,0,0.08);
                    background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(248,250,255,.85));
                    box-shadow:
                            inset 2px 2px 6px rgba(255,255,255,.8),
                            inset -2px -2px 6px rgba(0,0,0,.06),
                            0 16px 30px rgba(0,0,0,.12);
                    outline: none;
                    font-size: 15px;
                }
                .search-input:focus{
                    box-shadow:
                            inset 2px 2px 6px rgba(255,255,255,.9),
                            inset -2px -2px 6px rgba(0,0,0,.07),
                            0 0 0 3px rgba(88,132,255,.18),
                            0 16px 30px rgba(0,0,0,.12);
                    border-color: rgba(88,132,255,.35);
                }
                .search-spinner{
                    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                    font-weight: 800; opacity: .35;
                }
                .search-list{
                    display: grid;
                    gap: 10px;
                    max-height: 52vh;
                    overflow: auto;
                    padding: 6px 2px 2px;
                }
                .search-item{
                    position: relative;
                    text-align: left;
                    width: 100%;
                    border: 1px solid rgba(0,0,0,0.06);
                    border-radius: 14px;
                    padding: 12px 14px;
                    background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(246,248,255,.82));
                    box-shadow:
                            inset 1px 1px 3px rgba(255,255,255,.8),
                            inset -1px -1px 3px rgba(0,0,0,.05),
                            0 10px 18px rgba(0,0,0,.08);
                    cursor: pointer;
                    transition: transform .08s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease;
                }
                .search-item:hover{
                    transform: translateY(-1px);
                    box-shadow:
                            inset 1px 1px 3px rgba(255,255,255,.85),
                            inset -1px -1px 3px rgba(0,0,0,.05),
                            0 16px 26px rgba(0,0,0,.10);
                    border-color: rgba(88,132,255,.25);
                }
                .search-item.is-active{
                    transform: translateY(-1.5px);
                    border-color: rgba(88,132,255,.6);
                    background: linear-gradient(180deg, rgba(250,253,255,.95), rgba(235,243,255,.90));
                    box-shadow:
                            inset 2px 2px 6px rgba(255,255,255,.95),
                            inset -2px -2px 6px rgba(0,0,0,.06),
                            0 12px 24px rgba(88,132,255,.18),
                            0 0 0 3px rgba(88,132,255,.25);
                    outline: none;
                }
                .search-item.is-active::before{
                    content: '';
                    position: absolute; left: 0; top: 0; bottom: 0; width: 6px;
                    border-radius: 14px 0 0 14px;
                    background: linear-gradient(180deg, #8bb6ff, #5e8eff);
                }
                .search-item:focus-visible{
                    outline: none;
                    box-shadow:
                            inset 2px 2px 6px rgba(255,255,255,.95),
                            inset -2px -2px 6px rgba(0,0,0,.06),
                            0 12px 24px rgba(88,132,255,.18),
                            0 0 0 3px rgba(88,132,255,.3);
                    border-color: rgba(88,132,255,.6);
                }
                .search-line{
                    display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap;
                }
                .search-name{
                    color: #0b0b0b;
                    font-weight: 800;
                    font-size: 16px;
                    letter-spacing: .1px;
                }
                .search-item.is-active .search-name{ color: #0a2a6b; }
                .search-meta{
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-top: 4px;
                    align-items: center;
                }
                .meta-item{
                    font-size: 13px;
                    opacity: .86;
                    display: inline-flex;
                    gap: 6px;
                    align-items: baseline;
                }
                .meta-item > label{
                    font-size: 11.5px;
                    opacity: .65;
                    margin-right: 2px;
                }
                .meta-dot{
                    opacity: .45;
                }
                .search-empty{
                    opacity: .7; font-size: 14px; padding: 10px 2px;
                }
                .srv-callout{
                    position: relative;
                    margin-top: 6px;
                    padding: 10px 12px 10px 34px;
                    background: #ffffff;
                    border: 1px solid rgba(0,0,0,0.08);
                    border-radius: 10px;
                    box-shadow: 0 8px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.85);
                    font-size: 13px;
                    color: #0b0b0b;
                    z-index: 10;
                }
                .srv-callout::before{
                    content: '';
                    position: absolute;
                    top: -8px; left: 24px;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 8px solid rgba(0,0,0,0.08);
                }
                .srv-callout::after{
                    content: '';
                    position: absolute;
                    top: -7px; left: 25px;
                    border-left: 7px solid transparent;
                    border-right: 7px solid transparent;
                    border-bottom: 7px solid #ffffff;
                }
                .srv-callout-icon{
                    position: absolute;
                    left: 10px; top: 50%; transform: translateY(-50%);
                    width: 16px; height: 16px; border-radius: 50%;
                    background: linear-gradient(180deg, #ffde9a, #ffc466);
                    color: #6b3f00;
                    display: inline-flex; align-items: center; justify-content: center;
                    font-weight: 800; font-size: 12px;
                    border: 1px solid rgba(0,0,0,0.08);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.75);
                }
                .view-box{
                    max-width: 900px;
                    padding: 22px 22px 16px;
                    border-radius: 22px;
                    background: radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.65), rgba(240,244,255,0.55));
                    box-shadow:
                            inset 8px 8px 24px rgba(255,255,255,0.45),
                            inset -8px -8px 22px rgba(0,0,0,0.05),
                            0 24px 50px rgba(0,0,0,0.35);
                    backdrop-filter: blur(18px);
                    border: 1px solid rgba(255,255,255,0.6);
                }
                .view-layout{ display: grid; grid-template-columns: 1fr 220px; gap: 18px; min-height: 320px; }
                .view-content{
                    background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(248,250,255,.85));
                    border: 1px solid rgba(0,0,0,0.06);
                    border-radius: 16px; padding: 16px;
                    box-shadow: inset 2px 2px 6px rgba(255,255,255,.8), inset -2px -2px 6px rgba(0,0,0,.06);
                }
                .view-sidebar{
                    background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(246,248,255,.82));
                    border: 1px solid rgba(0,0,0,0.06);
                    border-radius: 16px; padding: 10px;
                    display: flex; flex-direction: column; gap: 8px;
                    box-shadow: inset 2px 2px 6px rgba(255,255,255,.8), inset -2px -2px 6px rgba(0,0,0,.06);
                }
                @media (max-width: 900px){
                    .view-layout{ grid-template-columns: 1fr; }
                    .view-sidebar{ margin-top: 14px; width: 100%; }
                }
                .view-item{
                    text-align: left; padding: 10px 12px; border-radius: 12px;
                    border: 1px solid rgba(0,0,0,0.06);
                    background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(246,248,255,.86));
                    cursor: pointer; font-weight: 600;
                    box-shadow: inset 1px 1px 3px rgba(255,255,255,.8), inset -1px -1px 3px rgba(0,0,0,.05);
                }
                .view-item:hover{
                    transform: translateY(-1px);
                    border-color: rgba(88,132,255,.35);
                    background: linear-gradient(180deg, #eaf2ff, #dfe9ff) !important; box-shadow: inset 1px 1px 3px rgba(255,255,255,.8), 0 10px 22px rgba(40,80,200,.16) !important;
                }
                .view-item.is-active{ border-color: rgba(88,132,255,.45); box-shadow: inset 2px 2px 6px rgba(255,255,255,.92), inset -2px -2px 6px rgba(0,0,0,.06), 0 6px 12px rgba(88,132,255,.15); }
                .view-item-danger{ color: #8a1f1f; background: linear-gradient(180deg, #fff3f3, #ffe8e8); border-color: rgba(195,40,40,.25); }
                .view-item-danger:hover{
                    transform: translateY(-1px);
                    border-color: rgba(195,40,40,.45);
                    background: linear-gradient(180deg, #fff0f0, #ffe2e2);
                    box-shadow:
                        inset 2px 2px 6px rgba(255,255,255,.95),
                        inset -2px -2px 6px rgba(0,0,0,.06),
                        0 0 0 3px rgba(195,40,40,.15);
                }
                .view-item:focus-visible, .view-item-danger:focus-visible{
                    outline: none;
                    border-color: rgba(88,132,255,.55);
                    box-shadow:
                        inset 2px 2px 6px rgba(255,255,255,.95),
                        inset -2px -2px 6px rgba(0,0,0,.06),
                        0 0 0 3px rgba(88,132,255,.25);
                }
                .view-title{ margin: 0 0 10px; font-size: 16px; font-weight: 800; }
                .view-grid{ display: grid; grid-template-columns: 1fr; gap: 8px; }
                .view-row{ display: flex; gap: 8px; font-size: 14px; }
                .view-row > label{ width: 110px; opacity: .65; font-size: 13px; }
                .view-obs{ margin-top: 8px; }
                .view-obs-list{ list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
                .view-obs-list li{ padding: 10px 12px; border: 1px solid rgba(0,0,0,0.06); border-radius: 12px; background: rgba(255,255,255,.95); }
                .view-obs-text{ font-size: 14px; }
                .view-obs-date{ font-size: 12px; opacity: .6; margin-top: 4px; }
                .view-obs-empty{ opacity: .7; font-size: 13px; padding: 8px 2px; }
                .srv-toast{
                    position: relative;
                    margin-top: 10px;
                    padding: 10px 38px 10px 36px;
                    border-radius: 14px;
                    background: radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.9), rgba(246,248,255,0.9));
                    border: 1px solid rgba(0,0,0,0.06);
                    box-shadow: inset 2px 2px 6px rgba(255,255,255,.9), inset -2px -2px 6px rgba(0,0,0,.06), 0 16px 28px rgba(0,0,0,.12);
                    display: flex; align-items: center; gap: 10px;
                }
                .srv-toast-icon{ position: absolute; left: 10px; display: inline-flex; align-items: center; justify-content: center; }
                .srv-toast-text{ font-size: 14px; color: #0b0b0b; }
                .srv-toast-close{
                    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
                    width: 24px; height: 24px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.06);
                    background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(248,250,255,.9));
                    cursor: pointer; font-size: 16px; line-height: 1; font-weight: 900; padding: 0;
                }
                .premium-box{
                    max-width: 420px;
                    padding: 24px 24px 18px;
                    border-radius: 22px;
                    background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(242,246,255,.94));
                    box-shadow: inset 2px 2px 8px rgba(255,255,255,.85), inset -2px -2px 6px rgba(0,0,0,.05), 0 18px 32px rgba(0,0,0,.12);
                }
                .premium-content{ display:flex; flex-direction:column; gap:12px; }
                .premium-title{ margin:0; font-size:20px; font-weight:800; color:#10224c; }
                .premium-text{ margin:0; font-size:14px; color:#30426a; line-height:1.5; }
                .premium-label{ display:block; margin-bottom:6px; font-weight:600; color:#22345a; }
                .premium-content input[type="password"]{ width:100%; padding:10px 14px; border-radius:12px; border:1px solid rgba(16,36,92,.18); background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(247,249,255,.92)); box-shadow: inset 1px 1px 3px rgba(255,255,255,.85), inset -1px -1px 3px rgba(0,0,0,.05); font-size:14px; }
                .premium-content input[type="password"]:focus{ outline:none; border-color:rgba(78,118,255,.45); box-shadow: inset 1px 1px 3px rgba(255,255,255,.9), 0 0 0 3px rgba(88,132,255,.22); }
                .srv-btn-primary{ background: linear-gradient(180deg, #5f8dff, #3f6be8); color:#fff; font-weight:700; box-shadow: inset 1px 1px 3px rgba(255,255,255,.25), 0 10px 20px rgba(68,102,220,.22); }
                .srv-btn-primary:hover{ filter:brightness(1.03); box-shadow: inset 1px 1px 3px rgba(255,255,255,.25), 0 12px 24px rgba(68,102,220,.3); }
                .srv-btn-primary:active{ transform:translateY(0.5px); }
                .confirm-box{
                    max-width: 520px;
                    padding: 22px 22px 16px;
                    border-radius: 22px;
                    background: radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.65), rgba(240,244,255,0.55));
                    box-shadow: inset 8px 8px 24px rgba(255,255,255,0.45), inset -8px -8px 22px rgba(0,0,0,0.05), 0 24px 50px rgba(0,0,0,0.35);
                    backdrop-filter: blur(18px);
                    border: 1px solid rgba(255,255,255,0.6);
                }
                .confirm-title{ margin: 0 0 8px; font-size: 18px; font-weight: 800; }
                .confirm-text{ margin: 0 0 10px; opacity: .8; }
                .confirm-data{ display: grid; gap: 6px; font-size: 14px; }
            
                /* --- ESTILOS DE LISTADO (REFACTORIZADOS) --- */
                /* (Se eliminaron todas las clases .list-*) */
                
                /* Responsive para modales */
                @media (max-width: 640px){
                  /* Switches dentro del modal: uno debajo del otro */
                  .srv-modal .srv-switches{
                    flex-wrap: nowrap;
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                  }
                  .srv-modal .srv-switch{ padding-left: 40px; }

                  /* Botones dentro del modal: columna y ancho completo */
                  .srv-modal .srv-actions,
                  .srv-modal .srv-modal__actions{
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                  }
                  .srv-modal .srv-btn{ width: 100%; }

                  /* Opcional: dropdowns de cultos en columna para evitar overflow */
                  .srv-modal .srv-cultos{
                    flex-direction: column;
                    flex-wrap: nowrap;
                    column-gap: 0;
                    row-gap: 12px;
                  }

                  /* Radios del modal (Timoteo/Maestros): evitar desborde lateral */
                  .srv-modal .srv-roles-grid{
                    display: flex;
                    flex-wrap: wrap !important;
                    justify-content: center;
                    gap: 8px;
                  }
                  .srv-modal .srv-radio-card{
                    min-width: 104px;
                    padding: 8px 10px;
                  }
                }
            `}</style>
        </>
    );
}