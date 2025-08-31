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
    rol: string;               // Logistica | Contactos | Maestros | Timoteo - Maestros | ...
    destino: string[];         // UI
    cultoSeleccionado: string; // UI logística (resumen)
    observaciones: string;
    cultos: CultosMap;         // UI logística (dropdowns)
};

type AsigContacto = {
    id: number;
    etapa: 'Semillas' | 'Devocionales' | 'Restauracion';
    dia: AppEstudioDia;
    semana: number;
    vigente: boolean;
};

// 👇 Puede venir como "Semilla 3", "Devocionales 2", "Restauracion 1"
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

/* ========= Catálogo UI ========= */
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

/* ========= Helpers ========= */
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

/** ✅ "Semillas 1" | "Devocionales 3" | "Restauración 1" -> "Semilla 1" | "Devocionales 3" | "Restauracion 1" */
const toEtapaDetFromUi = (nivelSel: string): string | null => {
    const t = norm(nivelSel); // "semillas 1", "devocionales 3", "restauracion 1"
    const m = /^(semillas|devocionales|restauracion)\s+(\d+)/.exec(t);
    if (!m) return null;
    const grupo = m[1];
    const num = m[2];
    if (grupo === 'semillas') return `Semillas ${num}`;        // singular
    if (grupo === 'devocionales') return `Devocionales ${num}`;
    return `Restauracion ${num}`;                             // sin tilde
};

/** ✅ "Semilla 3" | "Devocionales 2" | "Restauracion 1" -> { grupoUI: 'Semillas'|'Devocionales'|'Restauración', num: '3' } */
const parseEtapaDetFromDb = (
    etapaDb: string
): { grupoUI: 'Semillas' | 'Devocionales' | 'Restauración'; num: string } | null => {
    const t = norm(etapaDb); // "semilla 3"
    const m = /^(semilla|devocionales|restauracion)\s+(\d+)/.exec(t);
    if (!m) return null;
    const base = m[1];
    const num = m[2];
    if (base === 'semilla') return { grupoUI: 'Semillas', num };
    if (base === 'devocionales') return { grupoUI: 'Devocionales', num };
    return { grupoUI: 'Restauración', num };
};

/* ========= Componente ========= */
export default function Servidores() {
    const observacionesRef = useRef<HTMLTextAreaElement | null>(null);
    const inputNombreRef = useRef<HTMLInputElement | null>(null);

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

    useEffect(() => {
        inputNombreRef.current?.focus();
    }, []);

    /* ========================= MODALES ========================= */
    const [contactosModalVisible, setContactosModalVisible] = useState(false);
    const [timoteoModalVisible, setTimoteoModalVisible] = useState(false);
    const [logisticaModalVisible, setLogisticaModalVisible] = useState(false);

    // Semana (solo Contactos)
    const [contactosSemana, setContactosSemana] = useState<string>(''); // 'Semana 1' | 'Semana 2' | 'Semana 3'
    // Día PTM
    const [contactosDia, setContactosDia] = useState<AppEstudioDia | ''>(''); // Domingo | Martes | Virtual

    // Nivel/Etapa (selección única por radios)
    const [nivelSeleccionado, setNivelSeleccionado] = useState<string>(''); // 'Semillas 1' | 'Devocionales 2' | 'Restauración 1'...
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
        const isContactos = rolEs(form.rol, 'Contactos');
        const obsSemana = isContactos && contactosSemana ? `Semana: ${contactosSemana}` : '';
        const obsDia = contactosDia ? `Día: ${contactosDia}` : '';
        const obsNivel = nivelSeleccionado ? `Nivel: ${nivelSeleccionado}` : '';
        const extra = [obsSemana, obsDia, obsNivel].filter(Boolean).join(' | ');

        setForm((prev) => ({
            ...prev,
            destino: contactosDia ? [contactosDia.toUpperCase()] : prev.destino,
            observaciones: [prev.observaciones?.trim(), extra].filter(Boolean).join(' | '),
        }));
        setContactosModalVisible(false);
    };

    /* ========================= BUSCAR (modal online) ========================= */
    const [buscarModalVisible, setBuscarModalVisible] = useState(false);
    const [q, setQ] = useState('');
    const [results, setResults] = useState<ServidorRow[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const h = setTimeout(async () => {
            if (!buscarModalVisible) return;
            const term = trim(q);
            setSearching(true);
            const or = term
                ? `nombre.ilike.%${term}%,telefono.ilike.%${term}%,cedula.ilike.%${term}%`
                : undefined;

            const sel =
                'id, cedula, nombre, telefono, email, activo, asignaciones_contacto(id, etapa, dia, semana, vigente), asignaciones_maestro(id, etapa, dia, vigente)';

            let query = supabase.from('servidores').select(sel);
            if (or) query = query.or(or);
            query = query.eq('activo', true).limit(20);

            const { data, error } = await query;
            if (!error && data) setResults(data as ServidorRow[]);
            setSearching(false);
        }, 400);
        return () => clearTimeout(h);
    }, [q, buscarModalVisible]);

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

            // ✅ Si viene detallado ("Semilla 3" / "Devocionales 2" / "Restauracion 1"), marcamos radios
            const det = parseEtapaDetFromDb(a.etapa);
            if (det) selectNivel(det.grupoUI, det.num);
            else {
                // Si por compatibilidad aún viniera general, marcamos grupo y por defecto "1"
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

        setBuscarModalVisible(false);
    };

    /* ========================= VALIDACIÓN & GUARDAR / ELIMINAR ========================= */
    const validateBeforeSave = (): boolean => {
        const errs: Errores = {};
        if (esVacio(form.nombre)) errs.nombre = 'Nombre es obligatorio';
        if (esVacio(form.cedula)) errs.cedula = 'Cédula es obligatoria';
        if (esVacio(form.rol)) errs.rol = 'Seleccione un rol';

        const etapaGeneral = toEtapaEnum(nivelSeleccionado ?? '');
        const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');

        if (rolEs(form.rol, 'Contactos')) {
            if (!etapaGeneral) errs.etapa = 'Seleccione la etapa (Semillas/Devocionales/Restauración)';
            if (!contactosDia) errs.dia = 'Seleccione el día PTM';
            if (!contactosSemana) errs.semana = 'Seleccione la semana (1/2/3)';
        }
        if (rolEs(form.rol, 'Maestros')) {
            // ✅ Para Maestros exigimos etapa con número
            if (!etapaDet) errs.etapa = 'Seleccione la etapa con número (p. ej., Semillas 1 / Devocionales 2 / Restauración 1)';
            if (!contactosDia) errs.dia = 'Seleccione el día PTM';
        }
        // Logística: solo UI

        setErrores(errs);
        return Object.keys(errs).length === 0;
    };

    const onGuardar = async () => {
        setFeedback(null);
        if (!validateBeforeSave()) return;

        setBusy(true);
        try {
            // ✅ SIEMPRE guardamos/actualizamos en TABLA SERVIDORES (fn_upsert_servidor)
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
                    p_etapa: etapaDet, // 👈 Ahora sí manda "Semillas 1"
                    p_dia: dia,
                    p_semana: semana,
                });
                if (error) throw error;
            } else if (rolEs(form.rol, 'Maestros')) {
                // ✅ Para Maestros mandamos el DETALLE ("Semilla 1" / "Devocionales 3" / "Restauracion 1")
                const etapaDet = toEtapaDetFromUi(nivelSeleccionado || '');
                if (!etapaDet) throw new Error('Etapa inválida. Elija por ejemplo "Semillas 1".');

                const dia = contactosDia as AppEstudioDia;

                const { error } = await supabase.rpc('fn_asignar_maestro', {
                    p_cedula: trim(form.cedula),
                    p_etapa: etapaDet, // << detalle esperado por enum app_etapa_det
                    p_dia: dia,
                });
                if (error) throw error;
            } else if (rolEs(form.rol, 'Logistica')) {
                // (pendiente de SQL) Ej: fn_asignar_logistica(...)
            }

            setFeedback('✅ Guardado correctamente.');
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

    /* ========= Handlers de Modales ========= */
    const abrirModalRol = (valor: string) => {
        // Reset mínimos por cambio de rol
        setErrores((prev) => ({ ...prev, rol: null, etapa: null, dia: null, semana: null }));

        // Timoteos: preguntar a qué área pertenece
        if (valor === 'Timoteos') {
            setTimoteoModalVisible(true);
            return;
        }

        // Asignar rol directo
        setForm((prev) => ({
            ...prev,
            rol: valor,
            cultoSeleccionado: valor === 'Logistica' ? prev.cultoSeleccionado : '',
            cultos: valor === 'Logistica' ? prev.cultos : defaultCultos(),
            destino: valor === 'Maestros' ? prev.destino : [],
        }));

        // Abrir modal de configuración según rol base
        if (valor === 'Contactos' || valor === 'Maestros') {
            setContactosModalVisible(true);
        } else if (valor === 'Logistica') {
            setLogisticaModalVisible(true);
        } else {
            setContactosModalVisible(false);
            setLogisticaModalVisible(false);
        }
    };

    const elegirTimoteoDestino = (destino: 'Contactos' | 'Maestros' | 'Logistica') => {
        const compuesto = `Timoteo - ${destino}`;
        setForm((prev) => ({
            ...prev,
            rol: compuesto,
            cultoSeleccionado: destino === 'Logistica' ? prev.cultoSeleccionado : '',
            cultos: destino === 'Logistica' ? prev.cultos : defaultCultos(),
        }));
        setTimoteoModalVisible(false);

        if (destino === 'Contactos' || destino === 'Maestros') {
            setContactosModalVisible(true);
        }
        if (destino === 'Logistica') {
            setLogisticaModalVisible(true);
        }
    };

    const onChangeCulto = (key: DiaKey, value: string) => {
        setForm((prev) => ({
            ...prev,
            cultos: { ...prev.cultos, [key]: value },
            cultoSeleccionado: `${key} - ${value}`,
        }));
    };

    /* ===== UI ===== */
    return (
        <div className="srv-root">
            <div className="srv-box" id="form-servidores">
                <div className="srv-title">Registro de Servidores</div>

                {/* Modal TIMOTEO → selección de destino */}
                {timoteoModalVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div className="srv-modal__box" style={{ maxWidth: 520 }}>
                            <button
                                className="srv-modal__close"
                                aria-label="Cerrar"
                                onClick={() => setTimoteoModalVisible(false)}
                            >
                                ×
                            </button>

                            <div className="srv-modal__content">
                                <h4 className="srv-section__title">¿Timoteo para qué área?</h4>
                                <div className="srv-roles-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                                    {(['Maestros', 'Contactos', 'Logistica'] as const).map((dest) => (
                                        <label key={dest} className="srv-radio">
                                            <input
                                                type="radio"
                                                name="timoteo-destino"
                                                className="srv-radio-input"
                                                onChange={() => elegirTimoteoDestino(dest)}
                                            />
                                            <div className="srv-radio-card">
                                                <span className="srv-radio-dot" />
                                                <span className="srv-radio-text">{dest}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <p className="srv-info" style={{ marginTop: 12 }}>
                                    Se registrará como <b>Timoteo - …</b> y se configurarán las opciones del área elegida.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal CONTACTOS / MAESTROS — Día / Semana / Etapa */}
                {contactosModalVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div className="srv-modal__box">
                            <button
                                className="srv-modal__close"
                                aria-label="Cerrar"
                                onClick={() => setContactosModalVisible(false)}
                            >
                                ×
                            </button>

                            <div className="srv-modal__content">
                                <div className="srv-modal-grid">
                                    {rolEs(form.rol, 'Contactos') && (
                                        <section className="srv-card">
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
                                                                onChange={() => setContactosSemana(sem)}
                                                            />
                                                            <div className="srv-radio-card">
                                                                <span className="srv-radio-dot" />
                                                                <span className="srv-radio-text">{sem}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    <section className="srv-card">
                                        <h4 className="srv-card__title">Día PTM</h4>
                                        <div className="srv-card__content">
                                            <div className="srv-switches srv-switches--modal">
                                                {(['Domingo', 'Martes', 'Virtual'] as AppEstudioDia[]).map((d) => (
                                                    <label key={d} className="srv-switch">
                                                        <input
                                                            type="checkbox"
                                                            className="srv-switch-input"
                                                            checked={contactosDia === d}
                                                            onChange={(e) => setContactosDia(e.target.checked ? d : '')}
                                                        />
                                                        <span className="srv-switch-slider" />
                                                        {d}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <section className="srv-section">
                                    <h4 className="srv-section__title">Etapas de Aprendizaje</h4>

                                    <div className="srv-cultos srv-cultos--niveles" style={{ flexWrap: 'nowrap', gap: '16px' }}>
                                        {/* Semillas */}
                                        <div className="srv-culto-box" style={{ minWidth: 220 }}>
                                            {nivelSemillasSel ? `Semillas ${nivelSemillasSel}` : 'Semillas'}
                                            <ul className="srv-culto-lista" style={{ display: 'flex', gap: 10, padding: 10 }}>
                                                {['1', '2', '3', '4'].map((n) => (
                                                    <li key={`sem-${n}`} style={{ padding: 0 }}>
                                                        <label
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 10,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="nivel-semillas"
                                                                checked={nivelSemillasSel === n}
                                                                onChange={() => selectNivel('Semillas', n)}
                                                            />
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
                                                        <label
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 10,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="nivel-dev"
                                                                checked={nivelDevSel === n}
                                                                onChange={() => selectNivel('Devocionales', n)}
                                                            />
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
                                                        <label
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 10,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="nivel-res"
                                                                checked={nivelResSel === n}
                                                                onChange={() => selectNivel('Restauración', n)}
                                                            />
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

                {/* Modal LOGÍSTICA — Dropdowns de cultos */}
                {logisticaModalVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div className="srv-modal__box" style={{ maxWidth: 680 }}>
                            <button
                                className="srv-modal__close"
                                aria-label="Cerrar"
                                onClick={() => setLogisticaModalVisible(false)}
                            >
                                ×
                            </button>

                            <div className="srv-modal__content">
                                <h4 className="srv-section__title">Selecciona los cultos</h4>

                                <div className="srv-modal-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                    {(Object.keys(cultosOpciones) as DiaKey[]).map((k) => (
                                        <div key={k} className="srv-card">
                                            <h5 className="srv-card__title">{k}</h5>
                                            <div className="srv-card__content">
                                                <select
                                                    className="srv-select"
                                                    value={form.cultos[k]}
                                                    onChange={(e) => onChangeCulto(k, e.target.value)}
                                                >
                                                    <option value={k}>{k}</option>
                                                    {cultosOpciones[k].map((op) => (
                                                        <option key={op} value={op}>
                                                            {op}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <p className="srv-info" style={{ marginTop: 10 }}>
                                    Selección actual: <b>{form.cultoSeleccionado || '—'}</b>
                                </p>
                            </div>

                            <div className="srv-actions srv-modal__actions">
                                <button className="srv-btn" onClick={() => setLogisticaModalVisible(false)}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal BUSCAR (online) */}
                {buscarModalVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div className="srv-modal__box" style={{ maxWidth: 820 }}>
                            <button
                                className="srv-modal__close"
                                aria-label="Cerrar"
                                onClick={() => setBuscarModalVisible(false)}
                            >
                                ×
                            </button>

                            <div className="srv-modal__content">
                                <div className="srv-section">
                                    <h4 className="srv-section__title">Buscar Servidor</h4>
                                    <input
                                        type="text"
                                        placeholder="Nombre, teléfono o cédula…"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        className="srv-search-input"
                                    />
                                </div>

                                <div className="srv-section" style={{ maxHeight: 420, overflowY: 'auto' }}>
                                    {searching && <div className="srv-info">Buscando…</div>}
                                    {!searching && results.length === 0 && <div className="srv-empty">Sin resultados.</div>}

                                    <ul className="srv-results">
                                        {results.map((s) => {
                                            const lineTop = `${s.nombre ?? ''} • ${s.telefono ?? ''}`;
                                            const bloques: string[] = [];
                                            (s.asignaciones_contacto ?? []).forEach((a) => {
                                                bloques.push(`Contactos — ${a.etapa} — ${a.dia} — Semana ${a.semana}`);
                                            });
                                            (s.asignaciones_maestro ?? []).forEach((a) => {
                                                bloques.push(`Maestros — ${a.etapa} — ${a.dia}`);
                                            });
                                            const lineBottom = bloques.join('   |   ');
                                            return (
                                                <li key={s.id} className="srv-result" onClick={() => pickResult(s)}>
                                                    <div className="srv-result__top">{lineTop}</div>
                                                    {lineBottom && <div className="srv-result__bottom">{lineBottom}</div>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>

                            <div className="srv-actions srv-modal__actions">
                                <button className="srv-btn" onClick={() => setBuscarModalVisible(false)}>
                                    Cerrar
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
                            }}
                            placeholder="Nombre"
                            className={errores.nombre ? 'srv-input-error' : ''}
                        />
                        {errores.nombre && <div className="srv-error">** {errores.nombre}</div>}
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
                            value={form.cedula}
                            onChange={(e) => {
                                setForm((f) => ({ ...f, cedula: e.target.value }));
                                if (e.target.value.trim()) setErrores((prev) => ({ ...prev, cedula: null }));
                            }}
                            placeholder="Cédula"
                            className={errores.cedula ? 'srv-input-error' : ''}
                        />
                        {errores.cedula && <div className="srv-error">** {errores.cedula}</div>}
                    </div>
                </div>

                {/* Roles */}
                <div className="srv-roles-card">
                    <div className="srv-roles-title">Roles del Servidor</div>
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
                                    />
                                    <div className="srv-radio-card">
                                        <span className="srv-radio-dot" />
                                        <span className="srv-radio-text">{r}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

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
                {(errores.rol || errores.etapa || errores.dia || errores.semana) && (
                    <div className="srv-error srv-error--center" style={{ marginTop: 6 }}>
                        {[errores.rol, errores.etapa, errores.dia, errores.semana].filter(Boolean).join(' • ')}
                    </div>
                )}

                {/* Botones */}
                <div className="srv-actions">
                    <button className="srv-btn" onClick={onGuardar} disabled={busy} title="Guardar">
                        {busy ? 'Guardando…' : 'Guardar'}
                    </button>

                    <button
                        className="srv-btn srv-btn-buscar"
                        onClick={() => setBuscarModalVisible(true)}
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
        </div>
    );
}
