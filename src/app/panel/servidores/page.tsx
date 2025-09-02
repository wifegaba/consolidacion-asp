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
    if (s.asignaciones_contacto?.length) return 'Contactos';
    if (s.asignaciones_maestro?.length) return 'Maestros';
    return '—';
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
    const [busy, setBusy] = useState(false);
    const [guidedError, setGuidedError] = useState<
        | { key: 'nombre' | 'cedula' | 'rol' | 'etapa' | 'dia' | 'semana' | 'culto'; msg: string }
        | null
    >(null);

    // Modo edición (cuando eliges un registro desde Buscar)
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        inputNombreRef.current?.focus();
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

    // Modal Detalle (vista lateral con sidebar)
    const [detalleVisible, setDetalleVisible] = useState(false);
    const [detalleTab, setDetalleTab] = useState<'datos' | 'actualizar'>('datos');
    const [detalleSel, setDetalleSel] = useState<ServidorRow | null>(null);
    const [obsLoading, setObsLoading] = useState(false);
    const [obsItems, setObsItems] = useState<ObservacionRow[]>([]);
    const [confirmDetalleDelete, setConfirmDetalleDelete] = useState(false);

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

    const onGuardar = async () => {
        setFeedback(null);
        if (!validateBeforeSave()) return;

        const wasEdit = editMode;
        setBusy(true);
        try {
            // Alta/actualización básica
            const { error: upErr } = await supabase.rpc('fn_upsert_servidor', {
                p_cedula: trim(form.cedula),
                p_nombre: trim(form.nombre),
                p_telefono: trim(form.telefono),
                p_email: null,
            });
            if (upErr) throw upErr;

            if (rolEs(form.rol, 'Contactos')) {
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
                // Pendiente: RPC logística si aplica
            }

            // Guardar observación, si existe
            const okObs = await saveObservacion(form.observaciones);
            if (okObs) {
                setFeedback(wasEdit ? '✅ Actualizado correctamente.' : '✅ Guardado correctamente.');
            } else {
                setFeedback((wasEdit ? '✅ Actualizado, ' : '✅ Guardado, ') + 'pero no se pudo guardar la observación.');
            }
            // Limpiar campos tras éxito (tanto Guardar como Actualizar)
            resetFormulario();
        } catch (e: any) {
            setFeedback(`❌ Error al guardar: ${e?.message ?? e}`);
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

    const abrirModalRol = (valor: string) => {
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
                <div className="srv-title">Registro de Servidores</div>

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

                {/* Feedback */}
                {feedback && <div className="srv-info" style={{ marginTop: 8 }}>{feedback}</div>}
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

                    <button className="srv-btn" onClick={onEliminar} disabled={busy} title="Eliminar">
                        {busy ? 'Eliminando…' : 'Eliminar'}
                    </button>
                </div>
            </div>

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
                                            <div className="view-row"><label>Día:</label> <span>{(detalleSel.asignaciones_contacto?.[0]?.dia || detalleSel.asignaciones_maestro?.[0]?.dia || '—')}</span></div>
                                            <div className="view-row"><label>Etapa:</label> <span>{(detalleSel.asignaciones_contacto?.[0]?.etapa || detalleSel.asignaciones_maestro?.[0]?.etapa || '—')}</span></div>
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
                                <button className="srv-btn" style={{ background: '#ffe8e8' }} onClick={eliminarDesdeDetalle} disabled={busy}>
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
                    transition: transform .08s ease, box-shadow .12s ease, border-color .12s ease;
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
                    border-color: rgba(88,132,255,.45);
                    box-shadow:
                            inset 2px 2px 6px rgba(255,255,255,.92),
                            inset -2px -2px 6px rgba(0,0,0,.06),
                            0 18px 34px rgba(88,132,255,.18);
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
                .view-item{
                    text-align: left; padding: 10px 12px; border-radius: 12px;
                    border: 1px solid rgba(0,0,0,0.06);
                    background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(246,248,255,.86));
                    cursor: pointer; font-weight: 600;
                    box-shadow: inset 1px 1px 3px rgba(255,255,255,.8), inset -1px -1px 3px rgba(0,0,0,.05);
                }
                .view-item.is-active{ border-color: rgba(88,132,255,.45); box-shadow: inset 2px 2px 6px rgba(255,255,255,.92), inset -2px -2px 6px rgba(0,0,0,.06), 0 6px 12px rgba(88,132,255,.15); }
                .view-item-danger{ color: #8a1f1f; background: linear-gradient(180deg, #fff3f3, #ffe8e8); border-color: rgba(195,40,40,.25); }
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
            `}</style>
        </div>
    );
}
