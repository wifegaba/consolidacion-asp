'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ========= Tipos ========= */
type AppEstudioDia = 'Domingo' | 'Martes' | 'Virtual';

type Registro = {
    id: string;
    fecha: string;
    nombre: string;
    telefono: string | null;
    preferencias: string | null;
    cultosSeleccionados: string | null;
    observaciones?: string | null;
    estudioDia?: string | null;
};

type Errores = { nombre?: string | null; telefono?: string | null };

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

/* ========= Catálogo UI ========= */
const defaultCultos = (): CultosMap => ({
    DOMINGO: 'DOMINGO',
    MIÉRCOLES: 'MIÉRCOLES',
    VIERNES: 'VIERNES',
    SÁBADO: 'SÁBADO',
});

const cultosOpciones: Record<DiaKey, string[]> = {
    DOMINGO: ['7:00 AM', '9:00 AM', '11:00 PM', '5:30 PM'],
    MIÉRCOLES: ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '6:30 PM'],
    VIERNES: ['9:AM', '5:30 PM'],
    SÁBADO: ['Ayuno Familiar', 'Jovenes'],
};

const ROLES_FILA_1 = ['Logistica', 'Contactos', 'Maestros', 'Practicantes'];
const ROLES_FILA_2 = ['Timoteos', 'Coordinador', 'Director'];

/* ========= Helpers ========= */
const toDbEstudio = (arr: string[]): AppEstudioDia =>
    arr.includes('DOMINGO') ? 'Domingo' : arr.includes('MARTES') ? 'Martes' : 'Virtual';

const normaliza = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const claveDia = (d: string): DiaKey | null => {
    const t = normaliza(d.trim());
    if (t === 'domingo') return 'DOMINGO';
    if (t === 'miercoles') return 'MIÉRCOLES';
    if (t === 'viernes') return 'VIERNES';
    if (t === 'sabado') return 'SÁBADO';
    return null;
};

const extraerCultoDesdeNotas = (
    txt?: string | null
): { diaKey: DiaKey | null; hora: string | null; full: string | null; clean: string } => {
    if (!txt) return { diaKey: null, hora: null, full: null, clean: '' };

    const parts = txt.split('|').map(s => s.trim()).filter(Boolean);
    let diaKey: DiaKey | null = null;
    let hora: string | null = null;
    const resto: string[] = [];

    for (const p of parts) {
        const m = /^Culto\s+de\s+ingreso\s*:\s*([A-Za-zÁÉÍÓÚáéíóú]+)\s*-\s*([0-9:\sAPMapm\.]+)$/i.exec(p);
        if (m && !diaKey) {
            diaKey = claveDia(m[1]) as DiaKey | null;
            hora = (m[2] || '').trim();
        } else {
            resto.push(p);
        }
    }
    const full = diaKey && hora ? `${diaKey[0] + diaKey.slice(1).toLowerCase()} - ${hora}` : null;
    return { diaKey, hora, full, clean: resto.join(' | ') };
};

/* ========= Componente ========= */
export default function Servidores() {
    const observacionesRef = useRef<HTMLTextAreaElement | null>(null);
    const inputNombreRef = useRef<HTMLInputElement | null>(null);
    const inputBusquedaModalRef = useRef<HTMLInputElement | null>(null);

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
    const [mostrarErrorCulto, setMostrarErrorCulto] = useState(false);
    const [mostrarErrorDestino, setMostrarErrorDestino] = useState(false);

    const [modoEdicion, setModoEdicion] = useState(false);
    const [indiceEdicion, setIndiceEdicion] = useState<string | null>(null);

    // Modal búsqueda
    const [modalBuscarVisible, setModalBuscarVisible] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [sugs, setSugs] = useState<Registro[]>([]);
    const [openSugs, setOpenSugs] = useState(false);
    const [active, setActive] = useState(0);
    const [loadingSug, setLoadingSug] = useState(0);

    const cacheSugs = useRef(new Map<string, { ts: number; data: Registro[] }>()).current;
    const TTL_MS = 60_000, MIN_CHARS = 3, DEBOUNCE_MS = 350;

    useEffect(() => { inputNombreRef.current?.focus(); }, []);
    useEffect(() => {
        if (modalBuscarVisible) setTimeout(() => inputBusquedaModalRef.current?.focus(), 0);
    }, [modalBuscarVisible]);

    const toast = (msg: string) => {
        const t = document.createElement('div');
        t.className = 'srv-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    };

    /* =========================
       MODAL (Contactos / Maestros)
       ========================= */
    const [contactosModalVisible, setContactosModalVisible] = useState(false);

    // Semana (solo Contactos)
    const [contactosSemana, setContactosSemana] = useState<string>('');

    // Día/Modo (switch único)
    const [contactosDia, setContactosDia] = useState<AppEstudioDia | ''>('');

    // Nivel (selección única con dropdowns de 4 radios horizontales)
    const [nivelSeleccionado, setNivelSeleccionado] = useState<string>('');
    const [nivelSemillasSel, setNivelSemillasSel] = useState<string>('');
    const [nivelDevSel, setNivelDevSel] = useState<string>('');
    const [nivelResSel, setNivelResSel] = useState<string>('');

    // helper para seleccionar número y actualizar título
    const selectNivel = (grupo: 'Semillas' | 'Devocionales' | 'Restauración', num: string) => {
        setNivelSeleccionado(`${grupo} ${num}`);
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

    const confirmarModal = () => {
        const isContactos = form.rol === 'Contactos';
        const obsSemana = isContactos && contactosSemana ? `Semana de llamadas: ${contactosSemana}` : '';
        const obsDia = contactosDia ? `Día: ${contactosDia}` : '';
        const obsNivel = nivelSeleccionado ? `Nivel: ${nivelSeleccionado}` : '';
        const extra = [obsSemana, obsDia, obsNivel].filter(Boolean).join(' | ');

        setForm(prev => ({
            ...prev,
            destino: contactosDia ? [contactosDia.toUpperCase()] : prev.destino,
            observaciones: [prev.observaciones?.trim(), extra].filter(Boolean).join(' | '),
        }));
        setContactosModalVisible(false);
    };

    /* ===== Guardar / Actualizar ===== */
    const validar = (): boolean => {
        const err: Errores = {};
        if (!form.nombre.trim()) {
            err.nombre = 'Ingresa el Nombre y Apellido';
            setErrores(err);
            return false;
        }
        if (!/\d{7,}/.test(form.telefono)) {
            err.telefono = 'Número inválido o incompleto';
            setErrores(err);
            return false;
        }
        // Solo exigir Culto si el rol es Logistica
        if (form.rol === 'Logistica' && !form.cultoSeleccionado) {
            setMostrarErrorCulto(true);
            return false;
        }
        if (form.rol === 'Maestros' && form.destino.length === 0) {
            setMostrarErrorDestino(true);
            return false;
        }
        setErrores({});
        setMostrarErrorCulto(false);
        setMostrarErrorDestino(false);
        return true;
    };

    const handleGuardar = async () => {
        if (!validar()) return;

        const p_estudio: AppEstudioDia = toDbEstudio(form.destino);
        const p_notas = (() => {
            const [dia, hora] = (form.cultoSeleccionado || '').split(' - ');
            const cultoLinea = dia && hora ? `Culto de ingreso: ${dia} - ${hora}` : null;
            const extra = (form.observaciones || '').trim();
            return [cultoLinea, extra].filter(Boolean).join(' | ') || null;
        })();

        try {
            if (modoEdicion && indiceEdicion) {
                const { error } = await supabase.rpc('fn_actualizar_persona', {
                    p_id: indiceEdicion,
                    p_nombre: form.nombre.trim(),
                    p_telefono: form.telefono.trim(),
                    p_estudio,
                    p_notas,
                });
                if (error) throw error;
                toast('✅ Registro actualizado');
            } else {
                const { error } = await supabase.rpc('fn_registrar_persona', {
                    p_nombre: form.nombre.trim(),
                    p_telefono: form.telefono.trim(),
                    p_culto: p_estudio,
                    p_estudio,
                    p_notas,
                });
                if (error) throw error;
                toast('✅ Guardado. Enviado a Semillas 1 • Semana 1');
            }

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
            setMostrarErrorCulto(false);
            setMostrarErrorDestino(false);
            setModoEdicion(false);
            setIndiceEdicion(null);
            inputNombreRef.current?.focus();
            cacheSugs.clear();
        } catch (e) {
            console.error(e);
            toast('❌ Error al guardar/actualizar');
        }
    };

    /* ===== ELIMINAR ===== */
    const handleEliminar = async () => {
        if (!modoEdicion || !indiceEdicion) {
            toast('Selecciona un registro primero.');
            return;
        }
        const ok = window.confirm('¿Seguro que deseas eliminar este registro? Esta acción no se puede deshacer.');
        if (!ok) return;

        try {
            const { error } = await supabase.rpc('fn_eliminar_persona', { p_id: indiceEdicion });
            if (error) throw error;

            toast('🗑️ Registro eliminado');
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
            setMostrarErrorCulto(false);
            setMostrarErrorDestino(false);
            setModoEdicion(false);
            setIndiceEdicion(null);
            cacheSugs.clear();
            inputNombreRef.current?.focus();
        } catch (e) {
            console.error(e);
            toast('❌ Error al eliminar');
        }
    };

    /* ===== Búsqueda (modal) ===== */
    useEffect(() => {
        const q = busqueda.trim();
        if (q.length < MIN_CHARS) {
            setSugs([]);
            setOpenSugs(false);
            setActive(0);
            return;
        }

        const cached = cacheSugs.get(q);
        if (cached && Date.now() - cached.ts < TTL_MS) {
            setSugs(cached.data);
            setOpenSugs(cached.data.length > 0);
            setActive(0);
            return;
        }

        let cancel = false;
        setLoadingSug(1);
        const t = setTimeout(async () => {
            try {
                const { data, error } = await supabase.rpc('fn_buscar_persona', { q });
                if (error) throw error;

                const arr: Registro[] = (data || []).map((r: any) => ({
                    id: r.id,
                    fecha: '',
                    nombre: r.nombre,
                    telefono: r.telefono ?? null,
                    preferencias: null,
                    cultosSeleccionados: null,
                    observaciones: r.observaciones ?? null,
                    estudioDia: r.estudio_dia ?? null,
                }));

                if (!cancel) {
                    cacheSugs.set(q, { ts: Date.now(), data: arr });
                    setSugs(arr);
                    setOpenSugs(arr.length > 0);
                    setActive(0);
                }
            } catch (e) {
                console.error('buscar sugerencias:', e);
                if (!cancel) {
                    setSugs([]);
                    setOpenSugs(false);
                }
            } finally {
                if (!cancel) setLoadingSug(0);
            }
        }, DEBOUNCE_MS);

        return () => {
            cancel = true;
            clearTimeout(t);
        };
    }, [busqueda]);

    /* ===== Inyectar datos al formulario ===== */
    const selectPersona = (p: Registro) => {
        const culto = extraerCultoDesdeNotas(p.observaciones);
        let cultosMap: CultosMap = defaultCultos();
        let cultoSeleccionado = '';

        if (culto.diaKey && culto.hora) {
            const key = culto.diaKey as DiaKey;
            cultosMap = { ...defaultCultos(), [key]: culto.hora! } as CultosMap;
            const diaBonito = key[0] + key.slice(1).toLowerCase();
            cultoSeleccionado = `${diaBonito} - ${culto.hora}`;
        }

        const destino = p.estudioDia ? [p.estudioDia.toUpperCase()] : [];

        setForm(f => ({
            ...f,
            nombre: p.nombre || '',
            telefono: p.telefono || '',
            cedula: '',
            rol: '',
            observaciones: culto.clean || '',
            destino,
            cultos: cultosMap,
            cultoSeleccionado,
        }));

        setModoEdicion(true);
        setIndiceEdicion(p.id);

        setBusqueda('');
        setSugs([]);
        setOpenSugs(false);
        setModalBuscarVisible(false);
        setTimeout(() => observacionesRef.current?.focus(), 0);
    };

    const onKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (openSugs && sugs.length > 0) selectPersona(sugs[active] ?? sugs[0]);
            setBusqueda('');
            setOpenSugs(false);
            return;
        }
        if (!openSugs || sugs.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(i => Math.min(i + 1, sugs.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => Math.max(i - 1, 0));
        } else if (e.key === 'Escape') {
            setOpenSugs(false);
        }
    };

    const ghost =
        openSugs &&
        sugs[0] &&
        sugs[0].nombre.toLowerCase().startsWith(busqueda.toLowerCase())
            ? sugs[0].nombre.slice(busqueda.length)
            : '';

    /* ===== UI ===== */
    return (
        <div className="srv-root">
            <div className="srv-box" id="form-servidores">
                <div className="srv-title">Registro de Servidores</div>

                {/* Modal BUSCAR */}
                {modalBuscarVisible && (
                    <div className="srv-modal" role="dialog" aria-modal="true">
                        <div className="srv-modal__box">
                            <button
                                className="srv-modal__close"
                                aria-label="Cerrar"
                                onClick={() => {
                                    setBusqueda('');
                                    setSugs([]);
                                    setOpenSugs(false);
                                    setModalBuscarVisible(false);
                                }}
                            >
                                ×
                            </button>

                            <h3 className="srv-modal__heading">Buscar Registros en Base de Datos</h3>

                            <div
                                className="srv-search-wrap"
                                onBlur={() => setTimeout(() => setOpenSugs(false), 120)}
                            >
                                <div className="srv-ghost" aria-hidden>
                                    <span className="srv-ghost-typed">{busqueda}</span>
                                    <span className="srv-ghost-hint">{ghost}</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o teléfono…"
                                    value={busqueda}
                                    ref={inputBusquedaModalRef}
                                    onFocus={() => setOpenSugs(sugs.length > 0)}
                                    onChange={e => {
                                        const v = e.target.value;
                                        setBusqueda(v);
                                        setOpenSugs(v.trim().length >= MIN_CHARS);
                                    }}
                                    onKeyDown={onKeyDownSearch}
                                    role="combobox"
                                    aria-expanded={openSugs}
                                    aria-controls="sug-list-modal"
                                    aria-activedescendant={
                                        openSugs && sugs[active] ? `optm-${sugs[active].id}` : undefined
                                    }
                                />
                                {openSugs && (
                                    <div id="sug-list-modal" role="listbox" className="srv-sug-list">
                                        {sugs.map((p, i) => (
                                            <button
                                                key={p.id}
                                                id={`optm-${p.id}`}
                                                role="option"
                                                aria-selected={i === active}
                                                onMouseEnter={() => setActive(i)}
                                                onMouseDown={ev => ev.preventDefault()}
                                                onClick={() => selectPersona(p)}
                                                className={`srv-sug-item ${i === active ? 'is-active' : ''}`}
                                                title={`${p.nombre} • ${p.telefono ?? '—'}`}
                                            >
                                                <div className="srv-sug-name">{p.nombre}</div>
                                                <div className="srv-sug-sub">
                                                    {p.telefono ?? '—'}
                                                    <span className="srv-sug-pill" style={{ marginLeft: 8 }}>
                            Grupo: {p.estudioDia ?? '—'}
                          </span>
                                                </div>
                                            </button>
                                        ))}
                                        {loadingSug ? <div className="srv-sug-loading">Buscando…</div> : null}
                                        {!loadingSug && sugs.length === 0 && (
                                            <div className="srv-sug-empty">Sin resultados</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal CONTACTOS / MAESTROS — REORGANIZADO EN TARJETAS */}
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
                                {/* Tarjetas superiores: izquierda Semana, derecha Día PTM */}
                                <div className="srv-modal-grid">
                                    {/* Tarjeta: Selecciona la Semana (solo Contactos) */}
                                    {form.rol === 'Contactos' && (
                                        <section className="srv-card">
                                            <h4 className="srv-card__title">Selecciona la Semana</h4>
                                            <div className="srv-card__content">
                                                <div className="srv-roles-grid srv-roles-grid--weeks">
                                                    {['Semana 1', 'Semana 2', 'Semana 3'].map(sem => (
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

                                    {/* Tarjeta: Día PTM (Domingo / Martes / Virtual) */}
                                    <section className="srv-card">
                                        <h4 className="srv-card__title">Día PTM</h4>
                                        <div className="srv-card__content">
                                            <div className="srv-switches srv-switches--modal">
                                                {(['Domingo', 'Martes', 'Virtual'] as AppEstudioDia[]).map(d => (
                                                    <label key={d} className="srv-switch">
                                                        <input
                                                            type="checkbox"
                                                            className="srv-switch-input"
                                                            checked={contactosDia === d}
                                                            onChange={e => setContactosDia(e.target.checked ? d : '')}
                                                        />
                                                        <span className="srv-switch-slider" />
                                                        {d}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Sección inferior: Etapas de Aprendizaje */}
                                <section className="srv-section">
                                    <h4 className="srv-section__title">Etapas de Aprendizaje</h4>

                                    <div className="srv-cultos srv-cultos--niveles" style={{ flexWrap: 'nowrap', gap: '16px' }}>
                                        {/* Semillas */}
                                        <div className="srv-culto-box" style={{ minWidth: 220 }}>
                                            {nivelSemillasSel ? `Semillas ${nivelSemillasSel}` : 'Semillas'}
                                            <ul className="srv-culto-lista" style={{ display: 'flex', gap: 10, padding: 10 }}>
                                                {['1','2','3','4'].map(n => (
                                                    <li key={`sem-${n}`} style={{ padding: 0 }}>
                                                        <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:10, cursor:'pointer' }}>
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
                                                {['1','2','3','4'].map(n => (
                                                    <li key={`dev-${n}`} style={{ padding: 0 }}>
                                                        <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:10, cursor:'pointer' }}>
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
                                                {['1'].map(n => (
                                                    <li key={`res-${n}`} style={{ padding: 0 }}>
                                                        <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:10, cursor:'pointer' }}>
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

                            {/* Acciones */}
                            <div className="srv-actions srv-modal__actions">
                                <button className="srv-btn" onClick={() => setContactosModalVisible(false)}>Cancelar</button>
                                <button className="srv-btn srv-btn-buscar" onClick={confirmarModal}>Listo</button>
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
                            onChange={e => {
                                const value = e.target.value;
                                setForm(f => ({ ...f, nombre: value }));
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
                            onChange={e => {
                                const value = e.target.value;
                                setForm(f => ({ ...f, telefono: value }));
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
                            onChange={e => setForm(f => ({ ...f, cedula: e.target.value }))}
                            placeholder="Cédula"
                        />
                    </div>
                </div>

                {/* Roles */}
                <div className="srv-roles-card">
                    <div className="srv-roles-title">Roles del Servidor</div>
                    <div className="srv-roles-grid">
                        {[...ROLES_FILA_1, ...ROLES_FILA_2].map(r => {
                            const checked = form.rol === r;
                            return (
                                <label key={r} className="srv-radio">
                                    <input
                                        type="radio"
                                        name="rol-servidor"
                                        value={r}
                                        className="srv-radio-input"
                                        checked={checked}
                                        onChange={e => {
                                            const valor = e.target.value;
                                            setForm(prev => ({
                                                ...prev,
                                                rol: valor,
                                                cultoSeleccionado: valor === 'Logistica' ? prev.cultoSeleccionado : '',
                                                cultos: valor === 'Logistica' ? prev.cultos : defaultCultos(),
                                                destino: valor === 'Maestros' ? prev.destino : [],
                                            }));
                                            setMostrarErrorDestino(false);
                                            setMostrarErrorCulto(false);

                                            if (valor === 'Contactos' || valor === 'Maestros') {
                                                setContactosModalVisible(true);
                                            } else {
                                                setContactosModalVisible(false);
                                            }
                                        }}
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

                {mostrarErrorDestino && form.rol === 'Maestros' && (
                    <div className="srv-error srv-error--center" style={{ marginTop: 6 }}>
                        Selecciona un destino para Maestros.
                    </div>
                )}

                {/* Culto de ingreso (solo Logistica) */}
                {form.rol === 'Logistica' && (
                    <>
                        <div className="srv-cultos">
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
                                                    setForm(prev => ({
                                                        ...prev,
                                                        cultoSeleccionado: full,
                                                        cultos: updated,
                                                    }));
                                                    setMostrarErrorCulto(false);
                                                }}
                                            >
                                                {opcion}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {mostrarErrorCulto && (
                            <div className="srv-error srv-error--center" style={{ marginBottom: '1rem' }}>
                                ¡Escoge por favor un horario del Culto!
                            </div>
                        )}
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
                onChange={e => setForm({ ...form, observaciones: e.target.value })}
            />
                    </div>
                </div>

                {/* Botones */}
                <div className="srv-actions">
                    <button
                        className={`srv-btn ${modoEdicion ? 'srv-btn--update' : ''}`}
                        onClick={handleGuardar}
                    >
                        {modoEdicion ? 'Actualizar' : 'Guardar'}
                    </button>

                    <button
                        className="srv-btn srv-btn-buscar"
                        onClick={() => {
                            setBusqueda('');
                            setSugs([]);
                            setOpenSugs(false);
                            setModalBuscarVisible(true);
                            setTimeout(() => inputBusquedaModalRef.current?.focus(), 0);
                        }}
                        title="Abrir panel de búsqueda"
                    >
                        Buscar
                    </button>

                    <button
                        className="srv-btn"
                        disabled={!modoEdicion}
                        onClick={handleEliminar}
                        title={modoEdicion ? 'Eliminar este registro' : 'Selecciona un registro para eliminar'}
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}
