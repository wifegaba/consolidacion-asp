'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ========= Tipos ========= */
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
    etapa: string; // puede venir "Semillas 1", etc.
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

const ADMIN_PASSWORD = '1061355';

// Mínimo de caracteres para disparar la búsqueda online
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
const ROLES_FILA_2 = ['Director'];

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
  const ida = a?.[0]?.id ?? -1;   // se asume orden DESC por id en la query
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

// <-- CORRECCIÓN: Se añade 'Director' para que la lógica de validación y guardado lo reconozca.
const rolEs = (rol: string, base: 'Contactos' | 'Maestros' | 'Logistica' | 'Director') =>
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


/* ========= Componente ========= */
export default function Servidores() {
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
    const [listAnimating, setListAnimating] = useState(false);
    const [listRows, setListRows] = useState<ServidorRow[]>([]);
    const listFetchLockRef = useRef(false);
    const [listRequestPage, setListRequestPage] = useState<number | null>(null);

    const cargarListado = async (page: number) => {
        // prevent duplicate concurrent page loads
        if (listFetchLockRef.current) return;
        listFetchLockRef.current = true;

        // trigger a smooth fade animation while new page is being fetched
        setListRequestPage(page);
        setListAnimating(true);
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
            listFetchLockRef.current = false;
            // keep the fade for a short duration so the new content appears smooth
            setTimeout(() => setListAnimating(false), 140);
            setListRequestPage(null);
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
    
    // <-- CORRECCIÓN: Esta es la función onGuardar completamente refactorizada y corregida.
    const onGuardar = async () => {
        clearToast();
        if (!validateBeforeSave()) return;
    
        const wasEdit = editMode;
        setBusy(true);
        try {
            const ced = trim(form.cedula);
            const nom = trim(form.nombre);
            const tel = trim(form.telefono);
    
            // Paso 1: Llamada a la función RPC para crear o actualizar el servidor.
            // Esta llamada ahora captura el `servidorId` directamente, eliminando la necesidad de una segunda consulta.
            const { error: rpcError, data: servidorId } = await supabase.rpc('fn_upsert_servidor', {
                p_cedula: ced,
                p_nombre: nom,
                p_telefono: tel,
                p_email: null,
            });
    
            if (rpcError) throw rpcError;
            if (!servidorId) throw new Error('No se pudo obtener el ID del servidor tras la operación.');
    
            // Paso 2: Lógica de asignación de roles, usando el `servidorId` obtenido.
            // Primero, se desactivan todas las asignaciones operativas para limpiar el estado.
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
            // Para 'Director', no se necesita ninguna asignación operativa, así que la limpieza inicial es suficiente.
    
            // Paso 3: Actualizar el rol principal en `servidores_roles` usando el método `upsert` robusto.
            await upsertRolVigente(servidorId);
    
            // Paso 4: Guardar observación, si existe.
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
    
    // <-- CORRECCIÓN: Esta es la función `upsertRolVigente` robusta y corregida.
    const upsertRolVigente = async (servidorId: string) => {
        const rolActual = trim(form.rol);
        if (!servidorId || !rolActual) {
            console.warn('No se puede actualizar el rol: falta servidorId o rol.');
            return;
        }
    
        try {
            // Se utiliza `upsert` en lugar de `update` + `insert`.
            // Esto le dice a Supabase: "Inserta este registro. Si ya existe una fila
            // con este `servidor_id` (debido a la restricción `onConflict`),
            // actualiza esa fila existente con los nuevos valores en lugar de fallar".
            const { error } = await supabase
                .from('servidores_roles')
                .upsert(
                    { 
                        servidor_id: servidorId, 
                        rol: rolActual, 
                        vigente: true 
                    },
                    { 
                        onConflict: 'servidor_id', // Nombre de la columna con la restricción UNIQUE
                    }
                );
    
            if (error) {
                // Si hay un error, lo lanzamos para que sea capturado por el bloque `onGuardar`.
                throw error;
            }
    
        } catch (e) {
            console.error('Error crítico al actualizar el rol vigente:', e);
            // Relanzamos el error para que la función `onGuardar` se detenga y muestre el feedback al usuario.
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
            
            // También desactivar rol en servidores_roles
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

    // <-- CORRECCIÓN: La función ahora acepta el `servidorId` para ser más eficiente.
    const saveObservacion = async (texto: string, servidorId: string): Promise<void> => {
        const obs = trim(texto);
        if (!obs || !servidorId) return;
        
        try {
            const { error } = await supabase.from('observaciones_servidor').insert({ servidor_id: servidorId, texto: obs });
            if (error) {
                // Si falla, intentamos con la cédula como respaldo, aunque no es lo ideal.
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

    /* ===== UI ===== */
    return (
        <div className="srv-root">
            <div className="srv-box" id="form-servidores">
                <div className="srv-form-title" style={{ fontSize: 24, fontWeight: 900, color: '#0a0a0a', marginBottom: 16 }}>
                    Registro de Servidores
                </div>

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

                <div className="srv-row srv-row-first">
                    <div>
                        <input
                            ref={inputNombreRef}
                            type="text"
                            value={form.nombre}
                            onChange={(e) => {
                                const value = e.target.value;
                                setForm((f) => ({ ...f, nombre: value }));
                                if (value.trim()) setErrores((prev: Errores) => ({ ...prev, nombre: null }));
                                if (guidedError?.key === 'nombre' && value.trim()) setGuidedError(null);
                            }}
                            placeholder="Nombre"
                            className={errores.nombre ? 'srv-input-error' : ''}
                        />
                        {guidedError?.key === 'nombre' && (
                            <div className="srv-callout" role="alert">
                                <span className="srv-callout-icon">!</span>
                                {guidedError.msg}
                            </div>
                        )}
                        {errores.nombre && !guidedError && <div className="srv-error">** {errores.nombre}</div>}
                    </div>

                    <div>
                        <input
                            type="text"
                            value={form.telefono}
                            onChange={(e) => {
                                const value = e.target.value;
                                setForm((f) => ({ ...f, telefono: value }));
                                if (/\d{7,}/.test(value)) setErrores((prev: Errores) => ({ ...prev, telefono: null }));
                            }}
                            placeholder="Teléfono"
                            className={errores.telefono ? 'srv-input-error' : ''}
                        />
                        {errores.telefono && <div className="srv-error">** {errores.telefono}</div>}
                    </div>

                    <div>
                        <input
                            type="text"
                            ref={inputCedulaRef}
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
                            placeholder="Cédula"
                            className={errores.cedula ? 'srv-input-error' : ''}
                            readOnly={editMode && !cedulaUnlocked}
                        />
                        {guidedError?.key === 'cedula' && (
                            <div className="srv-callout" role="alert">
                                <span className="srv-callout-icon">!</span>
                                {guidedError.msg}
                            </div>
                        )}
                        {errores.cedula && !guidedError && <div className="srv-error">** {errores.cedula}</div>}
                    </div>
                </div>

                <div className="srv-roles-card" ref={rolesCardRef}>
                    <div className="srv-roles-title">Roles del Servidor</div>
                    {guidedError?.key === 'rol' && (
                        <div className="srv-callout" role="alert" style={{ marginTop: 6 }}>
                            <span className="srv-callout-icon">!</span>
                            {guidedError.msg}
                        </div>
                    )}
                    <div className="srv-roles-grid">
                        {[...ROLES_FILA_1, ...ROLES_FILA_2].map((r) => {
                            const checked = form.rol === r || form.rol === `Timoteo - ${r}`;
                            return (
                                <label key={r} className="srv-radio">
                                    <input
                                        type="radio"
                                        name="rol-servidor"
                                        value={r}
                                        className="srv-radio-input"
                                        checked={checked}
                                        onChange={(e) => abrirModalRol(e.target.value)}
                                        onClick={(e) => {
                                            const valor = (e.currentTarget as HTMLInputElement).value;
                                            if (valor === 'Timoteos') {
                                                setTimoteoModalVisible(true);
                                            } else if (valor === 'Contactos' || valor === 'Maestros') {
                                                setContactosModalVisible(true);
                                            }
                                        }}
                                    />
                                    <div className="srv-radio-card">
                                        <span className="srv-radio-dot" />
                                        <span className="srv-radio-text">{uiRoleLabel(r)}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {rolEs(form.rol, 'Logistica') && (
                    <>
                        <div ref={logisticaCultosRef} className={`srv-cultos${errores.culto ? ' srv-cultos--error' : ''}`}>
                            <label className="srv-label-culto">Culto:</label>
                            {Object.entries(form.cultos).map(([dia, valorActual]) => (
                                <div key={dia} className="srv-culto-box">
                                    {valorActual}
                                    <ul className="srv-culto-lista">
                                        {cultosOpciones[dia as DiaKey].map((opcion, index) => (
                                            <li
                                                key={index}
                                                onClick={() => {
                                                    const key = dia as DiaKey;
                                                    const full = `${dia} - ${opcion}`;
                                                    const updated: CultosMap = {
                                                        ...defaultCultos(),
                                                        [key]: opcion,
                                                    } as CultosMap;
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        cultoSeleccionado: full,
                                                        cultos: updated,
                                                    }));
                                                    setErrores((prev) => ({ ...prev, culto: null }));
                                                    if (guidedError?.key === 'culto') setGuidedError(null);
                                                }}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                {opcion}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        {guidedError?.key === 'culto' && (
                            <div className="srv-callout" role="alert" style={{ marginTop: 8 }}>
                                <span className="srv-callout-icon">!</span>
                                {guidedError.msg}
                            </div>
                        )}
                        {errores.culto && !guidedError && <div className="srv-error" style={{ marginTop: 6 }}>{errores.culto}</div>}
                    </>
                )}

                <div className="srv-group" style={{ marginTop: 10 }}>
                    <div style={{ flex: 1 }}>
                        <textarea
                            ref={observacionesRef}
                            id="observaciones"
                            className="srv-observaciones"
                            placeholder="Escribe aquí las observaciones..."
                            value={form.observaciones}
                            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                        />
                    </div>
                </div>

                {feedback && (
                    <div className="srv-toast" role="status" aria-live="polite">
                        <span className="srv-toast-icon" aria-hidden>
                            {(feedbackKind === 'success' || (!feedbackKind && feedback && !feedback.toLowerCase().includes('error') && !feedback.toLowerCase().includes('eliminado'))) && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" fill="url(#g1)" />
                                    <path d="M7 12.5l3 3 7-7" stroke="#0b5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                    <defs>
                                        <linearGradient id="g1" x1="0" y1="0" x2="24" y2="24">
                                            <stop stopColor="#E6FFF2" />
                                            <stop offset="1" stopColor="#C7F8E0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            )}
                            {(feedbackKind === 'delete' || (!feedbackKind && (feedback || '').toLowerCase().includes('eliminado'))) && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <rect x="5" y="7" width="14" height="13" rx="2" fill="url(#g2)" />
                                    <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" stroke="#666" strokeWidth="1.6" />
                                    <path d="M4 7h16" stroke="#888" strokeWidth="2" strokeLinecap="round" />
                                    <defs>
                                        <linearGradient id="g2" x1="5" y1="7" x2="19" y2="20">
                                            <stop stopColor="#FFF2F2" />
                                            <stop offset="1" stopColor="#FFE1E1" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            )}
                            {(feedbackKind === 'error' || (!feedbackKind && (feedback || '').toLowerCase().includes('error'))) && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" fill="url(#g3)" />
                                    <path d="M12 7v7" stroke="#b00" strokeWidth="2.2" strokeLinecap="round" />
                                    <circle cx="12" cy="17" r="1.2" fill="#b00" />
                                    <defs>
                                        <linearGradient id="g3" x1="0" y1="0" x2="24" y2="24">
                                            <stop stopColor="#FFF0F0" />
                                            <stop offset="1" stopColor="#FFE0E0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            )}
                        </span>
                        <span className="srv-toast-text">{feedback}</span>
                        <button className="srv-toast-close" onClick={toastClear} aria-label="Cerrar">×</button>
                    </div>
                )}
                {!guidedError && (errores.rol || errores.etapa || errores.dia || errores.semana || errores.culto) && (
                    <div className="srv-error srv-error--center" style={{ marginTop: 6 }}>
                        {[errores.rol, errores.etapa, errores.dia, errores.semana, errores.culto].filter(Boolean).join(' • ')}
                    </div>
                )}

                <div className="srv-actions">
                    <button className="srv-btn" onClick={onGuardar} disabled={busy} title={editMode ? 'Actualizar' : 'Guardar'}>
                        {busy ? (editMode ? 'Actualizando…' : 'Guardando…') : (editMode ? 'Actualizar' : 'Guardar')}
                    </button>

                    <button
                        className="srv-btn srv-btn-buscar"
                        onClick={() => { setQ(''); setResults([]); setFocusIndex(0); setBuscarModalVisible(true); }}
                        disabled={busy}
                        title="Buscar"
                    >
                        Buscar
                    </button>

                    <button className="srv-btn" onClick={abrirListado} disabled={busy} title="Listado">Listado</button>
                </div>
            </div>

            {listadoVisible && (
                <div className="srv-modal" role="dialog" aria-modal="true">
                    <div className="srv-modal__box list-box">
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={cerrarListado}>×</button>
                        <div className="list-header">
                            <h4 className="list-title">Listado de Servidores</h4>
                            <div className="list-subtitle">Mostrando {Math.min(listPage*listPageSize, listTotal)} de {listTotal}</div>
                        </div>
                        <div className={`list-table ${listAnimating ? 'is-animating' : ''}`} role="table" aria-label="Servidores">
                            <div className="list-row list-head" role="row">
                                <div className="list-cell col-idx" role="columnheader">#</div>
                                <div className="list-cell col-name" role="columnheader">Nombre</div>
                                <div className="list-cell col-tel" role="columnheader">Teléfono</div>
                                <div className="list-cell col-ced" role="columnheader">Cédula</div>
                                <div className="list-cell col-etp" role="columnheader">Etapa</div>
                                <div className="list-cell col-dia" role="columnheader">Día</div>
                                <div className="list-cell col-rol" role="columnheader">Rol</div>
                                <div className="list-cell col-act" role="columnheader">Acción</div>
                            </div>
                            {listLoading && <div className="list-empty">Cargando…</div>}
                            {!listLoading && listRows.length === 0 && <div className="list-empty">Sin registros.</div>}
                            {!listLoading && listRows.length > 0 && listRows.map((s, i) => (
                                <div key={s.id} className="list-row" role="row">
                                    <div className="list-cell col-idx" role="cell">{(listPage-1)*listPageSize + i + 1}</div>
                                    <div className="list-cell col-name" role="cell">{s.nombre || '—'}</div>
                                    <div className="list-cell col-tel" role="cell">{s.telefono || '—'}</div>
                                    <div className="list-cell col-ced" role="cell">{maskCedulaDisplay(s.cedula)}</div>
                                    <div className="list-cell col-etp" role="cell">{etapaDiaFromRow(s).etapa}</div>
                                    <div className="list-cell col-dia" role="cell">{etapaDiaFromRow(s).dia}</div>
                                    <div className="list-cell col-rol" role="cell">{(() => {
                                        const rawRol = s.asignaciones_contacto?.some(a => a?.vigente)
                                            ? 'Contactos'
                                            : (s.asignaciones_maestro?.some(a => a?.vigente) ? 'Maestros' : '—');
                                        return uiRoleLabel(rawRol);
                                    })()}</div>
                                    <div className="list-cell col-act" role="cell">
                                        <button className="srv-btn list-select" onClick={() => { applyPick(s); cerrarListado(); }}>Seleccionar</button>
                                    </div>
                                </div>
                            ))}
                            {/* Skeleton overlay: keep rows visible but show shimmer during fetch */}
                            <div className={`list-skeleton-overlay ${listLoading ? 'visible' : ''}`} aria-hidden>
                                {[...Array(listPageSize)].map((_, i) => (
                                    <div key={i} className="list-row list-row--skeleton" />
                                ))}
                            </div>
                        </div>
                        <div className="list-pager">
                            <button className="pager-btn" onClick={() => cargarListado(Math.max(1, listPage-1))} disabled={listPage<=1 || listLoading} onMouseDown={() => { if (!listLoading) cargarListado(Math.max(1, listPage-1)); }}>
                                {listRequestPage === Math.max(1, listPage-1) && <span className="pager-spinner" />}◀ Anterior
                            </button>
                            <span className="pager-info">Página {listPage} de {Math.max(1, Math.ceil(listTotal / listPageSize))}</span>
                            <button className="pager-btn" onClick={() => cargarListado(listPage+1)} disabled={listPage>=Math.ceil(listTotal / listPageSize) || listLoading} onMouseDown={() => { if (!listLoading) cargarListado(listPage+1); }}>
                                Siguiente ▶{listRequestPage === listPage+1 && <span className="pager-spinner" />}
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

            <style jsx>{`
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
            
                /* Liquid glass look for the list modal and fixed height to prevent resizing */
                .list-box{ width: min(92vw, 1200px); max-width: 1100px; padding: 18px 20px; border-radius: 22px; background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); box-shadow: 0 18px 40px rgba(8,15,30,0.4); border: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%); display:flex; flex-direction:column; height: clamp(520px, 68vh, 760px); min-height:480px; }
                .list-header{ display:flex; align-items:flex-end; justify-content:space-between; margin: 2px 2px 12px; padding: 0 2px; }
                .list-title{ font-size:20px; font-weight:900; letter-spacing:.2px; color:#0b0b0b; }
                .list-subtitle{ font-size:12.5px; opacity:.65; }
                .list-box .srv-modal__close{
                    position: absolute; top: 10px; right: 12px; left: auto;
                    width: 22px; height: 22px; border-radius: 50%;
                    border: 1px solid rgba(0,0,0,0.08);
                    background: radial-gradient(120% 120% at 30% 30%, #ff8a80, #ff5f57 60%, #e0443e 100%);
                    box-shadow: inset 1px 1px 2px rgba(255,255,255,.6), inset -1px -1px 2px rgba(0,0,0,.06), 0 6px 14px rgba(255,95,87,.22);
                    cursor: pointer;
                    display: inline-flex; align-items: center; justify-content: center;
                    color: #ffffff; font-size: 14px; line-height: 1; font-weight: 900; padding: 0;
                }
                .list-box .srv-modal__close:hover{
                    box-shadow: inset 1px 1px 2px rgba(255,255,255,.65), inset -1px -1px 2px rgba(0,0,0,.06), 0 0 0 4px rgba(255,95,87,.18), 0 10px 20px rgba(255,95,87,.25);
                    filter: brightness(1.02);
                }
                .list-box .srv-modal__close:focus-visible{
                    outline: none;
                    box-shadow: inset 1px 1px 2px rgba(255,255,255,.65), inset -1px -1px 2px rgba(0,0,0,.06), 0 0 0 4px rgba(255,95,87,.28), 0 12px 24px rgba(255,95,87,.28);
                }
                .list-table{ width: 100%;  border:1px solid rgba(0,0,0,.05); border-radius:16px; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,.96), rgba(244,248,255,.9)); box-shadow: inset 2px 2px 7px rgba(255,255,255,.9), inset -2px -2px 6px rgba(0,0,0,.045); flex:1 1 auto; min-height: 0; transition: opacity .12s ease, transform .12s cubic-bezier(.22,1,.36,1); }
                .list-table.is-animating{ opacity: 0.28; transform: translateY(6px); }
                .list-row{ display:grid; grid-template-columns: 28px 1.6fr .9fr .8fr .9fr .8fr .8fr 120px; align-items:center; padding:7px 10px; border-bottom:1px solid rgba(0,0,0,.045); }
                @media (max-width: 640px){
                    .list-row{ grid-template-columns: 1fr .8fr .8fr; }
                    .list-row .col-name{ grid-column: 1; }
                    .list-row .col-rol{ grid-column: 2; }
                    .list-row .col-etp{ grid-column: 3; }
                    .list-table .col-idx,
                    .list-table .col-tel,
                    .list-table .col-ced,
                    .list-table .col-dia,
                    .list-table .col-act{ display: none; }
                }
                .list-head{ background:linear-gradient(180deg, rgba(245,247,255,.98), rgba(232,238,255,.92)); font-weight:900; letter-spacing:.25px; color:#0b0b0b; }
                .list-row:last-child{ border-bottom:0; }
                .list-cell{ font-size:13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .col-idx{ text-align:center; font-weight:700; opacity:.8; }
                .col-name{ font-weight:700; color:#0b0b0b; white-space: normal; overflow: visible; text-overflow: clip; }
                .col-rol{ font-weight:600; opacity:.8; }
                .list-empty{ padding:16px; text-align:center; opacity:.7; }
                .list-select{ padding:6px 12px !important; min-height: auto !important; font-size:13px !important; border-radius:10px !important; color:#0b183a !important; background: linear-gradient(180deg, #e7f0ff, #dbe7ff) !important; border: 1px solid rgba(28,72,196,.22) !important; box-shadow: inset 1px 1px 3px rgba(255,255,255,.7), 0 6px 16px rgba(40,80,200,.12) !important; }
                .list-select:hover{ filter: none; background: linear-gradient(180deg, #eaf2ff, #dfe9ff) !important; box-shadow: inset 1px 1px 3px rgba(255,255,255,.8), 0 10px 22px rgba(40,80,200,.16) !important; }
                .list-select:active{ transform: translateY(0.5px); box-shadow: inset 1px 1px 2px rgba(0,0,0,.05), 0 6px 14px rgba(40,80,200,.12) !important; }
                .list-select:focus-visible{ outline: none; box-shadow: 0 0 0 3px rgba(88,132,255,.22), inset 1px 1px 3px rgba(255,255,255,.75) !important; }

                @media (max-width: 640px){
                    .list-box{ display:flex; flex-direction:column; max-height: 92dvh; }
                    .list-table{ flex: 1 1 auto; min-height: 0; overflow: auto; }
                    .list-pager{ flex: 0 0 auto; }

                    .list-header{ margin-bottom: 8px; }
                    .list-head{ display: none; }
                    .list-table{ border: none; background: transparent; box-shadow: none; }
                    .list-row{
                        grid-template-columns: 1fr;
                        gap: 6px;
                        margin: 10px 0;
                        padding: 12px;
                        border-radius: 14px;
                        background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(246,248,255,.92));
                        box-shadow: inset 2px 2px 6px rgba(255,255,255,.85), inset -2px -2px 6px rgba(0,0,0,.05), 0 8px 18px rgba(0,0,0,.06);
                        border: 1px solid rgba(0,0,0,.06);
                    }
                    .list-cell{ display: block; white-space: normal; }
                    .col-idx{ display: none; }
                    .col-name{ order: 1; font-weight: 800; font-size: 16px; color:#0b0b0b; }
                    .col-tel{ order: 2; }
                    .col-ced{ order: 3; }
                    .col-etp{ order: 4; }
                    .col-dia{ order: 5; }
                    .col-rol{ order: 6; }
                    .col-act{ order: 7; }
                    .col-tel::before{ content: 'Teléfono: '; font-weight: 700; opacity:.85; }
                    .col-ced::before{ content: 'Cédula: '; font-weight: 700; opacity:.85; }
                    .col-etp::before{ content: 'Etapa: '; font-weight: 700; opacity:.85; }
                    .col-dia::before{ content: 'Día: '; font-weight: 700; opacity:.85; }
                    .col-rol::before{ content: 'Rol: '; font-weight: 700; opacity:.85; }
                    .list-table .col-act{ display: block !important; margin-top: 6px; }
                    .col-act .list-select{ width: 100%; justify-content: center; }
                }
                .list-pager{ display:flex; justify-content:center; align-items:center; gap:14px; margin-top:12px; }
                .pager-btn{ padding:8px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.08); background:linear-gradient(180deg, rgba(255,255,255,.95), rgba(246,248,255,.9)); font-weight:700; box-shadow: inset 1px 1px 3px rgba(255,255,255,.85), inset -1px -1px 3px rgba(0,0,0,.05); }
                .pager-btn:disabled{ opacity:.5; cursor:not-allowed; }
                .pager-info{ font-size:13px; opacity:.75; }
            `}</style>
        </div>
    );
}