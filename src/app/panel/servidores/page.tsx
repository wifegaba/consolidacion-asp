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

const ROLES_FILA_1 = ['Logistica', 'Contactos', 'Maestros', 'Practicantes'];
const ROLES_FILA_2 = ['Timoteos', 'Coordinador', 'Director'];

const trim = (s: string) => (s ?? '').trim();
const esVacio = (s: string) => !trim(s);

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

const rolEs = (rol: string, base: 'Contactos' | 'Maestros' | 'Logistica') =>
    rol === base || rol === `Timoteo - ${base}`;

/** "Semillas 1" / "Devocionales 3" / "Restauración 1" -> enum DB esperado */
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
;

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

    // Modo edición (cuando eliges un registro desde Buscar)
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        
    }, []);

    /* ========================= MODALES ========================= */
    const [contactosModalVisible, setContactosModalVisible] = useState(false);
    const [timoteoModalVisible, setTimoteoModalVisible] = useState(false);

    // Semana (solo Contactos)
    const [contactosSemana, setContactosSemana] = useState<string>('');
    // Día PTM
    const [contactosDia, setContactosDia] = useState<AppEstudioDia | ''>('');

    // Nivel/Etapa
    const [nivelSeleccionado, setNivelSeleccionado] = useState<string>(''); // 'Semillas 1' | 'Devocacionales 2' | ...
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
        // No escribir nada en 'observaciones' automáticamente
        setForm((prev) => ({
            ...prev,
            destino: contactosDia ? [contactosDia.toUpperCase()] : prev.destino,
        }));
        setContactosModalVisible(false);
    };

    /* ========================= BUSCAR (modal online) ========================= */
    const [buscarModalVisible, setBuscarModalVisible] = useState(false);
    const [q, setQ] = useState('');
    const [results, setResults] = useState<ServidorRow[]>([]);
    const [searching, setSearching] = useState(false);
    const [focusIndex, setFocusIndex] = useState(0);

    /* ===== LISTADO (modal paginado) ===== */
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


    // Modal Detalle (vista lateral con sidebar)
    const [detalleVisible, setDetalleVisible] = useState(false);
    const [detalleTab, setDetalleTab] = useState<'datos' | 'actualizar'>('datos');
    const [detalleSel, setDetalleSel] = useState<ServidorRow | null>(null);
    const [obsLoading, setObsLoading] = useState(false);
    const [obsItems, setObsItems] = useState<ObservacionRow[]>([]);
    const [confirmDetalleDelete, setConfirmDetalleDelete] = useState(false);

    // Volver al modal de búsqueda desde el detalle
    const volverABuscar = () => {
        setConfirmDetalleDelete(false);
        setDetalleVisible(false);
        setDetalleSel(null);
        setQ('');
        setResults([]);
        setFocusIndex(0);
        setBuscarModalVisible(true);
    };

    // Búsqueda online con debounce; sin resultados si no hay término suficiente
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

    // Resaltar siempre el primero cuando hay resultados
    useEffect(() => {
        if (buscarModalVisible && results.length) setFocusIndex(0);
    }, [results, buscarModalVisible]);

    const applyPick = (s: ServidorRow) => {
        // Abrir modal de detalle en lugar de cargar el formulario
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
        setForm((prev) => ({
            ...prev,
            nombre: s.nombre ?? '',
            telefono: s.telefono ?? '',
            cedula: s.cedula ?? '',
            rol:
                s.asignaciones_contacto && s.asignaciones_contacto.length > 0
                    ? 'Contactos'
                    : s.asignaciones_maestro && s.asignaciones_maestro.length > 0
                        ? 'Maestros'
                        : '',
        }));

        if (s.asignaciones_contacto && s.asignaciones_contacto.length > 0) {
            const a = s.asignaciones_contacto[0];
            setContactosDia(a.dia);
            setContactosSemana(`Semana ${a.semana}`);
            if (a.etapa === 'Semillas') selectNivel('Semillas', nivelSemillasSel || '1');
            if (a.etapa === 'Devocionales') selectNivel('Devocionales', nivelDevSel || '1');
            if (a.etapa === 'Restauracion') selectNivel('Restauración', nivelResSel || '1');
        } else if (s.asignaciones_maestro && s.asignaciones_maestro.length > 0) {
            const a = s.asignaciones_maestro[0];
            setContactosDia(a.dia);
            const det = parseEtapaDetFromDb(a.etapa);
            if (det) selectNivel(det.grupoUI, det.num);
            else {
                if (a.etapa === 'Semillas') selectNivel('Semillas', nivelSemillasSel || '1');
                if (a.etapa === 'Devocionales') selectNivel('Devocionales', nivelDevSel || '1');
                if (a.etapa === 'Restauracion') selectNivel('Restauración', nivelResSel || '1');
            }
            setContactosSemana(''); // Maestros no usa semana
        } else {
            setContactosDia('');
            setContactosSemana('');
            setNivelSeleccionado('');
            setNivelSemillasSel('');
            setNivelDevSel('');
            setNivelResSel('');
        }
    };

    // Cargar observaciones al abrir el detalle
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

    // Reinicia todos los campos del formulario y estados relacionados
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
        setContactosSemana('');
        setContactosDia('');
        setNivelSeleccionado('');
        setNivelSemillasSel('');
        setNivelDevSel('');
        setNivelResSel('');
        setContactosModalVisible(false);
        setTimoteoModalVisible(false);
        setGuidedError(null);
        // Devuelve el foco al primer campo
        requestAnimationFrame(() => {
            inputNombreRef.current?.focus();
        });
    };

    /* ========================= VALIDACIÓN & GUARDAR / ELIMINAR ========================= */
    const validateBeforeSave = (): boolean => {
        // Validación guiada: determinamos el primer campo faltante y solo mostramos ese
        const mk = (k: 'nombre' | 'cedula' | 'rol' | 'etapa' | 'dia' | 'semana' | 'culto', msg: string) => {
            setErrores({ [k]: msg } as Errores);
            setGuidedError({ key: k, msg });
            // Llevar al usuario al control correspondiente
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
                // pequeño delay para asegurar que el modal montó
                setTimeout(() => {
                    const el = k === 'etapa' ? modalEtapasRef.current : k === 'dia' ? modalDiaRef.current : modalSemanaRef.current;
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
            }
            return false;
        };

        // Orden de validación
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

    // Toast helpers seguros (sin recursión)
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
            // Alta/actualización básica
            const ced = trim(form.cedula);
            const nom = trim(form.nombre);
            const tel = trim(form.telefono);
            let sid = await findServidorIdByCedula(ced);

            if (sid) {
                // Actualizar registro existente para evitar duplicados
                const up = await supabase
                    .from('servidores')
                    .update({ nombre: nom, telefono: tel || null, email: null, activo: true })
                    .eq('id', sid);
                if (up.error) throw up.error;
            } else {
                // No existe: usar RPC de upsert/insert
                const { error: upErr } = await supabase.rpc('fn_upsert_servidor', {
                    p_cedula: ced,
                    p_nombre: nom,
                    p_telefono: tel,
                    p_email: null,
                });
                if (upErr) throw upErr;
                sid = await findServidorIdByCedula(ced);
            }

            if (rolEs(form.rol, 'Contactos')) {
                // Desactivar asignaciones de otras áreas
                if (sid) {
                    await supabase.from('asignaciones_maestro').update({ vigente: false }).eq('servidor_id', sid);
                    await supabase.from('asignaciones_logistica').update({ vigente: false }).eq('servidor_id', sid);
                }
                const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');
                if (!etapaDet) throw new Error('Etapa inválida. Elija por ejemplo "Semillas 1".');

                const dia = contactosDia as AppEstudioDia;
                const semana = semanaNumero;

                const { error } = await supabase.rpc('fn_asignar_contactos', {
                    p_cedula: trim(form.cedula),
                    p_etapa: etapaDet,
                    p_dia: dia,
                    p_semana: semana,
                });
                if (error) throw error;
            } else if (rolEs(form.rol, 'Maestros')) {
                // Desactivar asignaciones de otras áreas
                if (sid) {
                    await supabase.from('asignaciones_contacto').update({ vigente: false }).eq('servidor_id', sid);
                    await supabase.from('asignaciones_logistica').update({ vigente: false }).eq('servidor_id', sid);
                }
                const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');
                if (!etapaDet) throw new Error('Etapa inválida. Elija por ejemplo "Semillas 1".');

                const dia = contactosDia as AppEstudioDia;

                const { error } = await supabase.rpc('fn_asignar_maestro', {
                    p_cedula: trim(form.cedula),
                    p_etapa: etapaDet,
                    p_dia: dia,
                });
                if (error) throw error;
            } else if (rolEs(form.rol, 'Logistica')) {
                // Desactivar asignaciones anteriores de otras áreas
                if (sid) {
                    await supabase.from('asignaciones_contacto').update({ vigente: false }).eq('servidor_id', sid);
                    await supabase.from('asignaciones_maestro').update({ vigente: false }).eq('servidor_id', sid);
                    await supabase.from('asignaciones_logistica').update({ vigente: false }).eq('servidor_id', sid);
                }
                // Crear nueva asignación de logística a partir de 'cultoSeleccionado'
                const full = trim(form.cultoSeleccionado);
                if (!full) throw new Error('Seleccione una hora de culto para Logística.');
                const parts = full.split(' - ');
                const diaCulto = (parts[0] || '').trim();
                const franja = (parts[1] || '').trim();
                if (!diaCulto || !franja) throw new Error('Selección de culto inválida.');
                // Insert directo; el tipo enum de dia_culto debe coincidir con el texto
                const ins = await supabase
                    .from('asignaciones_logistica')
                    .insert({ servidor_id: sid, dia_culto: diaCulto, franja, vigente: true });
                if (ins.error) throw ins.error;
            }

            // Guardar observación, si existe
            const okObs = await saveObservacion(form.observaciones);
            if (okObs) {
                toastShow('success', wasEdit ? 'Actualizado correctamente.' : 'Guardado correctamente.');
            } else {
                toastShow('success', (wasEdit ? 'Actualizado, ' : 'Guardado, ') + 'pero no se pudo guardar la observación.');
            }
            // Actualiza el rol vigente y limpia el formulario tras éxito
            await upsertRolVigente();
            resetFormulario();
        } catch (e: any) {
            toastShow('error', `Error al guardar: ${e?.message ?? e}`);
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

    // Mapea el rol del UI al valor esperado en DB
    const mapRolForDB = (rolUi: string): string => {
        const r = trim(rolUi);
        if (!r) return r;
        // Si viene "Timoteo - Contactos/Maestros/Logistica", guardamos como "Timoteos"
        if (r.toLowerCase().startsWith('timoteo')) return 'Timoteos';
        return r;
    };

    // Actualiza la tabla servidores_roles dejando vigente solo el rol actual
    const upsertRolVigente_legacy = async () => {
        try {
            const sid = await findServidorIdByCedula(trim(form.cedula));
            const rolDb = mapRolForDB(form.rol);
            if (sid && rolDb) {
                await supabase.from('servidores_roles').update({ vigente: false }).eq('servidor_id', sid);
                await supabase.from('servidores_roles').insert({ servidor_id: sid, rol: rolDb, vigente: true });
            }
        } catch (e) {
            console.warn('No se pudo actualizar servidores_roles:', e);
        }
    };

    // Actualiza la tabla servidores_roles dejando vigente solo el rol actual
    const upsertRolVigente = async () => {
        try {
            const sid = await findServidorIdByCedula(trim(form.cedula));
            const rolActual = trim(form.rol);
            if (sid && rolActual) {
                await supabase.from('servidores_roles').update({ vigente: false }).eq('servidor_id', sid);
                await supabase.from('servidores_roles').insert({ servidor_id: sid, rol: rolActual, vigente: true });
            }
        } catch (e) {
            console.warn('No se pudo actualizar servidores_roles:', e);
        }
    };

    // Eliminar por cédula desde el modal de detalle, replicando la lógica del formulario
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

            toastShow('delete', 'Eliminado (inactivado) correctamente.');
            setDetalleVisible(false);
            setConfirmDetalleDelete(false);
        } catch (e: any) {
            toastShow('error', `Error al eliminar: ${e?.message ?? e}`);
        } finally {
            setBusy(false);
        }
    };

    // Guarda la observación en 'observaciones_servidor' (por cedula o por servidor_id)
    const saveObservacion = async (texto: string): Promise<boolean> => {
        const obs = trim(texto);
        const ced = trim(form.cedula);
        if (!obs || !ced) return true;
        try {
            const ins1 = await supabase.from('observaciones_servidor').insert({ cedula: ced, texto: obs });
            if (!ins1.error) return true;
            const sid = await findServidorIdByCedula(ced);
            if (!sid) return false;
            const ins2 = await supabase.from('observaciones_servidor').insert({ servidor_id: sid, texto: obs });
            return !ins2.error;
        } catch {
            return false;
        }
    };

    const onEliminar = async () => {
        setFeedback(null);
        const ced = trim(form.cedula);
        if (!ced) {
            setErrores((prev) => ({ ...prev, cedula: 'Cédula es obligatoria para eliminar' }));
            return;
        }
        setBusy(true);
        try {
            const sid = await findServidorIdByCedula(ced);
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

            setFeedback('🗑️ Eliminado (inactivado) correctamente.');
        } catch (e: any) {
            setFeedback(`❌ Error al eliminar: ${e?.message ?? e}`);
        } finally {
            setBusy(false);
        }
    };

    // Asigna y persiste de inmediato roles simples (Coordinador/Director)
    const persistirRolSimple = async (valor: 'Coordinador' | 'Director') => {
        // Validación mínima: nombre y cédula
        const nombreOk = !esVacio(form.nombre);
        const cedulaOk = !esVacio(form.cedula);
        if (!nombreOk) {
            setErrores({ nombre: 'Ingresa el nombre del servidor.' });
            setGuidedError({ key: 'nombre', msg: 'Ingresa el nombre del servidor.' });
            inputNombreRef.current?.focus();
            return;
        }
        if (!cedulaOk) {
            setErrores({ cedula: 'Ingresa la cédula del servidor.' });
            setGuidedError({ key: 'cedula', msg: 'Ingresa la cédula del servidor.' });
            inputCedulaRef.current?.focus();
            return;
        }

        setBusy(true);
        try {
            // Asegurar existencia/actualización del servidor base
            const ced = trim(form.cedula);
            const nom = trim(form.nombre);
            const tel = trim(form.telefono);
            let sid = await findServidorIdByCedula(ced);

            if (sid) {
                const up = await supabase
                    .from('servidores')
                    .update({ nombre: nom, telefono: tel || null, email: null, activo: true })
                    .eq('id', sid);
                if (up.error) throw up.error;
            } else {
                const { error: upErr } = await supabase.rpc('fn_upsert_servidor', {
                    p_cedula: ced,
                    p_nombre: nom,
                    p_telefono: tel,
                    p_email: null,
                });
                if (upErr) throw upErr;
                sid = await findServidorIdByCedula(ced);
            }

            if (!sid) throw new Error('No se pudo localizar el servidor.');

            // Actualizar rol vigente
            await supabase.from('servidores_roles').update({ vigente: false }).eq('servidor_id', sid);
            const ins = await supabase.from('servidores_roles').insert({ servidor_id: sid, rol: valor, vigente: true });
            if (ins.error) throw ins.error;

            toastShow('success', `Rol asignado: ${valor}.`);
        } catch (e: any) {
            toastShow('error', `No fue posible asignar el rol: ${e?.message ?? e}`);
        } finally {
            setBusy(false);
        }
    };

    const abrirModalRol = async (valor: string) => {
        setErrores((prev) => ({ ...prev, rol: null, etapa: null, dia: null, semana: null, culto: null }));
        if (guidedError?.key === 'rol') setGuidedError(null);

        if (valor === 'Timoteos') {
            // Limpiar observaciones al cambiar de rol
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
            // Limpiar observaciones al cambiar de rol
            observaciones: '',
        }));

        if (valor === 'Contactos' || valor === 'Maestros') {
            setContactosModalVisible(true);
        } else {
            setContactosModalVisible(false);
        }

        // Persistencia inmediata para roles simples
        if (valor === 'Coordinador' || valor === 'Director') {
            await persistirRolSimple(valor);
        }
    };

    const elegirTimoteoDestino = (destino: 'Contactos' | 'Maestros' | 'Logistica') => {
        const compuesto = `Timoteo - ${destino}`;
        setForm((prev) => ({
            ...prev,
            rol: compuesto,
            cultoSeleccionado: destino === 'Logistica' ? prev.cultoSeleccionado : '',
            cultos: destino === 'Logistica' ? prev.cultos : defaultCultos(),
            // Limpiar observaciones al cambiar de rol
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

                {/* Modal TIMOTEO */}
                {timoteoModalVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div
                            className="srv-modal__box"
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

                {/* Modal CONTACTOS / MAESTROS */}
                {contactosModalVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div className="srv-modal__box">
                            <button className="srv-modal__close" aria-label="Cerrar" onClick={() => setContactosModalVisible(false)}>
                                ×
                            </button>

                            <div className="srv-modal__content">
                                <div className="srv-modal-grid">
                                    {rolEs(form.rol, 'Contactos') && (
                                        <section className="srv-card" ref={modalSemanaRef}>
                                            <h4 className="srv-card__title">Selecciona la Semana</h4>
                                            <div className="srv-card__content">
                                                <div className="srv-roles-grid srv-roles-grid--weeks">
                                                    {['Semana 1', 'Semana 2', 'Semana 3'].map((sem) => (
                                                        <label key={sem} className="srv-radio">
                                                            <input
                                                                type="radio"
                                                                name="sem-contactos"
                                                                className="srv-radio-input"
                                                                checked={contactosSemana === sem}
                                                                onChange={() => { setContactosSemana(sem); if (guidedError?.key === 'semana') setGuidedError(null); }}
                                                            />
                                                            <div className="srv-radio-card">
                                                                <span className="srv-radio-dot" />
                                                                <span className="srv-radio-text">{sem}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            {guidedError?.key === 'semana' && (
                                                <div className="srv-callout" role="alert" style={{ marginTop: 8 }}>
                                                    <span className="srv-callout-icon">!</span>
                                                    {guidedError.msg}
                                                </div>
                                            )}
                                        </section>
                                    )}

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

                                    <div className="srv-cultos srv-cultos--niveles" style={{ flexWrap: 'nowrap', gap: '16px' }}>
                                        {/* Semillas */}
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

                                        {/* Devocionales */}
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

                                        {/* Restauración */}
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

                            <div className="srv-actions srv-modal__actions">
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

                {/* Fila: nombre / teléfono / cédula */}
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
                            value={form.cedula}
                            onChange={(e) => {
                                setForm((f) => ({ ...f, cedula: e.target.value }));
                                if (e.target.value.trim()) setErrores((prev) => ({ ...prev, cedula: null }));
                                if (guidedError?.key === 'cedula' && e.target.value.trim()) setGuidedError(null);
                            }}
                            placeholder="Cédula"
                            className={errores.cedula ? 'srv-input-error' : ''}
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

                {/* Roles */}
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
                                    <input type="radio" name="rol-servidor" value={r} className="srv-radio-input" checked={checked} onChange={(e) => abrirModalRol(e.target.value)} />
                                    <div className="srv-radio-card">
                                        <span className="srv-radio-dot" />
                                        <span className="srv-radio-text">{r}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Cultos inline (solo Logística) */}
                {form.rol === 'Logistica' && (
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

                {/* Observaciones */}
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

                {/* Feedback (Toast estilo Mac 2025) */}
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

                {/* Botones */}
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

            {/* ===== Modal LISTADO — Mac 2025 con paginación ===== */}
            {listadoVisible && (
                <div className="srv-modal" role="dialog" aria-modal="true">
                    <div className="srv-modal__box list-box">
                        <button className="srv-modal__close" aria-label="Cerrar" onClick={cerrarListado}>×</button>
                        <div className="list-header">
                            <h4 className="list-title">Listado de Servidores</h4>
                            <div className="list-subtitle">Mostrando {Math.min(listPage*listPageSize, listTotal)} de {listTotal}</div>
                        </div>
                        <div className="list-table" role="table" aria-label="Servidores">
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
                                    <div className="list-cell col-ced" role="cell">{s.cedula || '—'}</div>
                                    <div className="list-cell col-etp" role="cell">{etapaDiaFromRow(s).etapa}</div>
                                    <div className="list-cell col-dia" role="cell">{etapaDiaFromRow(s).dia}</div>
                                    <div className="list-cell col-rol" role="cell">{(s.asignaciones_contacto?.some(a=>a?.vigente) ? 'Contactos' : (s.asignaciones_maestro?.some(a=>a?.vigente) ? 'Maestros' : '—'))}</div>
                                    <div className="list-cell col-act" role="cell">
                                        <button className="srv-btn list-select" onClick={() => { applyPick(s); cerrarListado(); }}>Seleccionar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="list-pager">
                            <button className="pager-btn" onClick={() => cargarListado(Math.max(1, listPage-1))} disabled={listPage<=1 || listLoading}>◀ Anterior</button>
                            <span className="pager-info">Página {listPage} de {Math.max(1, Math.ceil(listTotal / listPageSize))}</span>
                            <button className="pager-btn" onClick={() => cargarListado(listPage+1)} disabled={listPage>=Math.ceil(listTotal / listPageSize) || listLoading}>Siguiente ▶</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Modal BUSCAR — Mac 2025 Neumorphism ===== */}
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
                                            {/* Nombre destacado (negro, fuerte) */}
                                            <div className="search-line">
                                                <span className="search-name">{s.nombre || '—'}</span>
                                            </div>

                                            {/* Etiquetas y datos en una línea horizontal */}
                                            <div className="search-meta">
                        <span className="meta-item">
                          <label>Teléfono:</label> {s.telefono || '—'}
                        </span>
                                                <span className="meta-dot">•</span>
                                                <span className="meta-item">
                          <label>Cédula:</label> {s.cedula || '—'}
                        </span>
                                                <span className="meta-dot">•</span>
                                                <span className="meta-item">
                          <label>Rol:</label> {roleFromRow(s)}
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

                                {/* Mostrar "sin resultados" solo si ya se escribió algo suficiente */}
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

            {/* ===== Modal DETALLE — Vista con Sidebar (Mac 2025 + Neumorphism) ===== */}
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
                                            <div className="view-row"><label>Cédula:</label> <span>{detalleSel.cedula || '—'}</span></div>
                                            <div className="view-row"><label>Rol:</label> <span>{roleFromRow(detalleSel)}</span></div>
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
                                            <button className="srv-btn" style={{ background: '#ffe8e8' }} onClick={() => setConfirmDetalleDelete(true)}>Eliminar Servidor</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <aside className="view-sidebar">
                                <button className={`view-item${detalleTab === 'datos' ? ' is-active' : ''}`} onClick={() => setDetalleTab('datos')}>Datos Personales</button>
                                <button className={`view-item${detalleTab === 'actualizar' ? ' is-active' : ''}`} onClick={() => setDetalleTab('actualizar')}>Actualizar Datos</button>
                                <button className="view-item view-item-danger" onClick={() => setConfirmDetalleDelete(true)}>Eliminar Servidor</button>
                                <button className="view-item" onClick={volverABuscar}>Atras</button>
                            </aside>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmación de eliminación */}
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
                                <div><strong>Cédula:</strong> {detalleSel.cedula || '—'}</div>
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

            {/* ===== Estilos locales del modal Buscar (Mac 2025 + Neumorphism) ===== */}
            <style jsx>{`
                .search-box {
                    max-width: 760px;
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
                /* Callout estilo tooltip con flecha */
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
                /* Vista Detalle (Mac 2025) */
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
                /* Layout del detalle en dos tarjetas verticales SOLO en responsive */
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
                    background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(240,246,255,.92));
                    box-shadow:
                        inset 2px 2px 6px rgba(255,255,255,.92),
                        inset -2px -2px 6px rgba(0,0,0,.06),
                        0 0 0 3px rgba(88,132,255,.18);
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
                /* Toast de feedback (Mac 2025) */
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
                    cursor: pointer; font-size: 16px; line-height: 1; opacity: .85;
                    box-shadow: inset 1px 1px 3px rgba(255,255,255,.85), inset -1px -1px 3px rgba(0,0,0,.05);
                }
                /* Confirmación eliminar */
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
            
                /* ===== LISTADO (modal) ===== */
                .list-box{ width: min(92vw, 1200px); max-width: 1100px; }
                .list-header{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:10px; }
                .list-title{ font-size:18px; font-weight:800; letter-spacing:.2px; }
                .list-subtitle{ font-size:13px; opacity:.7; }
                /* Cerrar (macOS 2025) solo para el modal Listado */
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
                .list-table{ width: 100%;  border:1px solid rgba(0,0,0,.06); border-radius:14px; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,.92), rgba(246,248,255,.86)); box-shadow: inset 2px 2px 6px rgba(255,255,255,.85), inset -2px -2px 6px rgba(0,0,0,.05); }
                .list-row{ display:grid; grid-template-columns: 28px 1fr 1fr .9fr .9fr .9fr .8fr 150px; align-items:center; padding:8px 10px; border-bottom:1px solid rgba(0,0,0,.05); }
                /* Responsive: mostrar solo Nombre, Rol y Etapa */
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
                .list-head{ background:linear-gradient(180deg, rgba(245,247,255,.95), rgba(234,238,255,.9)); font-weight:800; letter-spacing:.3px; }
                .list-row:last-child{ border-bottom:0; }
                .list-cell{ font-size:14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .col-idx{ text-align:center; font-weight:700; opacity:.8; }
                .col-name{ font-weight:700; color:#0b0b0b; }
                .col-rol{ font-weight:600; opacity:.85; }
                .list-empty{ padding:16px; text-align:center; opacity:.7; }
                .list-select{ padding:8px 12px; color:#fff; border-color: rgba(59,91,253,.45) !important; background: linear-gradient(180deg, #5b7cff, #3b5bfd) !important; box-shadow: inset 1px 1px 3px rgba(255,255,255,.35), 0 10px 20px rgba(59,91,253,.18) !important; }
                .list-select:hover{ filter: brightness(1.03); box-shadow: inset 1px 1px 3px rgba(255,255,255,.35), 0 14px 26px rgba(59,91,253,.24) !important; }
                .list-select:focus-visible{ outline: none; box-shadow: 0 0 0 3px rgba(88,132,255,.28), inset 1px 1px 3px rgba(255,255,255,.35) !important; }

                /* ===== Listado en tarjetas (solo responsive) ===== */
                @media (max-width: 640px){
                    /* contenedor del modal listado con layout de columna y scroll interno */
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
                    /* Orden de presentación */
                    .col-name{ order: 1; font-weight: 800; font-size: 16px; color:#0b0b0b; }
                    .col-tel{ order: 2; }
                    .col-ced{ order: 3; }
                    .col-etp{ order: 4; }
                    .col-dia{ order: 5; }
                    .col-rol{ order: 6; }
                    .col-act{ order: 7; }
                    /* Etiquetas antes del valor */
                    .col-tel::before{ content: 'Teléfono: '; font-weight: 700; opacity:.85; }
                    .col-ced::before{ content: 'Cédula: '; font-weight: 700; opacity:.85; }
                    .col-etp::before{ content: 'Etapa: '; font-weight: 700; opacity:.85; }
                    .col-dia::before{ content: 'Día: '; font-weight: 700; opacity:.85; }
                    .col-rol::before{ content: 'Rol: '; font-weight: 700; opacity:.85; }
                    /* Botón seleccionar al ancho de la tarjeta */
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
