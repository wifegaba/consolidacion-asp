// File: PersonaNueva.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ========= Tipos ========= */
type AppEstudioDia = 'Domingo' | 'Martes' | 'Virtual' | 'Pendientes';
type AppEtapa = 'Semillas' | 'Devocionales' | 'Restauracion';

type Registro = {
    id: string;
    fecha: string;
    nombre: string;
    telefono: string | null;
    preferencias: string | null;
    cultosSeleccionados: string | null;
    observaciones?: string | null;
    estudioDia?: string | null; // para prender el switch
    etapa?: AppEtapa | null;    // NUEVO: etapa actual
    semana?: number | null;     // NUEVO: semana actual
};

// Fila ligera para el modal de pendientes
type PendienteItem = {
    progreso_id?: string;
    persona_id?: string;
    id?: string;
    nombre: string | null;
    telefono: string | null;
    semana?: number | null;
    dia?: AppEstudioDia | null;
    etapa?: string | null;
    modulo?: number | null;
    observaciones?: string | null;
    creado_en?: string | null;
    created_at?: string | null;
    fecha?: string | null;
};

type Errores = { nombre?: string | null; telefono?: string | null; };

/** Claves válidas para la UI de Cultos (botones grandes) */
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
    destino: string[];
    cultoSeleccionado: string;
    observaciones: string;
    cultos: CultosMap;
    pendienteId?: string | null;
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

/* ========= Helpers ========= */
const toDbEstudio = (arr: string[]): AppEstudioDia =>
    arr.includes('DOMINGO') ? 'Domingo' :
    arr.includes('MARTES') ? 'Martes' :
    arr.includes('PENDIENTES') ? 'Pendientes' :
    arr.includes('VIRTUAL') ? 'Virtual' :
    'Virtual'; // fallback de seguridad


const normaliza = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Formatea a solo fecha (sin hora)
const soloFecha = (v?: string | null): string => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN((d as unknown) as number)) return v.slice(0, 10);
    try { return d.toLocaleDateString('es-ES'); } catch { return v.slice(0, 10); }
};

const claveDia = (d: string): DiaKey | null => {
    const t = normaliza(d.trim());
    if (t === 'domingo') return 'DOMINGO';
    if (t === 'miercoles') return 'MIÉRCOLES';
    if (t === 'viernes') return 'VIERNES';
    if (t === 'sabado') return 'SÁBADO';
    return null;
};

/** Extrae el culto de ingreso de las notas y devuelve las observaciones limpias (sin el rótulo). */
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

export default function PersonaNueva() {
    const observacionesRef = useRef<HTMLTextAreaElement | null>(null);
    const inputNombreRef = useRef<HTMLInputElement | null>(null);
    const inputBusquedaModalRef = useRef<HTMLInputElement | null>(null);

    const [form, setForm] = useState<FormState>({
        nombre: '', telefono: '', destino: [],
        cultoSeleccionado: '', observaciones: '',
        cultos: defaultCultos(),
        pendienteId: null,
    });

    const [errores, setErrores] = useState<Errores>({});
    const [mostrarErrorCulto, setMostrarErrorCulto] = useState(false);
    const [mostrarErrorDestino, setMostrarErrorDestino] = useState(false);
    const [bloquearCultos, setBloquearCultos] = useState(false);

    const [modoEdicion, setModoEdicion] = useState(false);
    const [indiceEdicion, setIndiceEdicion] = useState<string | null>(null);

    // Modal búsqueda
    const [modalBuscarVisible, setModalBuscarVisible] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [sugs, setSugs] = useState<Registro[]>([]);
    const [openSugs, setOpenSugs] = useState(false);
    const [active, setActive] = useState(0);
    const [loadingSug, setLoadingSug] = useState(false);
    const [modoSoloPendientes, setModoSoloPendientes] = useState(false);

    // Modal Pendientes
    const [modalPendVisible, setModalPendVisible] = useState(false);
    const [pendLoading, setPendLoading] = useState(false);
    const [pendientesRows, setPendientesRows] = useState<PendienteItem[]>([]);
    const [pendPage, setPendPage] = useState(0);
    const PEND_PAGE_SIZE = 7;


    const cacheSugs = useRef(new Map<string, { ts: number; data: Registro[] }>()).current;
    const TTL_MS = 60_000, MIN_CHARS = 3, DEBOUNCE_MS = 350;

    
    useEffect(() => { if (modalBuscarVisible) setTimeout(() => inputBusquedaModalRef.current?.focus(), 0); }, [modalBuscarVisible]);

    const toast = (msg: string) => {
        const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    };

    // Cargar un registro desde el modal de Pendientes al formulario
const selectDesdePendiente = (row: PendienteItem) => {
  const reg: Registro = {
    id: row.persona_id || '', // este se usa para lógica normal
    fecha: '',
    nombre: row.nombre || '',
    telefono: row.telefono || null,
    preferencias: null,
    cultosSeleccionados: null,
    observaciones: row.observaciones ?? null,
    estudioDia: 'PENDIENTES',
    etapa: (row.etapa as AppEtapa) ?? null,
    semana: typeof row.semana === 'number' ? row.semana : null,
  };

  setModalPendVisible(false);

  // 👇 Aquí garantizamos que el form.pendienteId sea el UUID real de la tabla pendientes
  selectPersona(reg, true);
  setForm(prev => ({ ...prev, pendienteId: row.id })); 
  setBloquearCultos(false);
};



    /* ===== Guardar / Actualizar / Reactivar ===== */
    const validar = (): boolean => {
        const err: Errores = {};
        if (!form.nombre.trim()) { err.nombre = 'Ingresa el Nombre y Apellido'; setErrores(err); return false; }
        if (!/\d{7,}/.test(form.telefono)) { err.telefono = 'Número inválido o incompleto'; setErrores(err); return false; }
        if (!form.cultoSeleccionado) { setMostrarErrorCulto(true); return false; }
        if (form.destino.length === 0) { setMostrarErrorDestino(true); return false; }
        setErrores({}); setMostrarErrorCulto(false); setMostrarErrorDestino(false); return true;
    };

    const construirNotas = () => {
        const [dia, hora] = form.cultoSeleccionado.split(' - ');
        const cultoLinea = dia && hora ? `Culto de ingreso: ${dia} - ${hora}` : null;
        const extra = (form.observaciones || '').trim();
        return [cultoLinea, extra].filter(Boolean).join(' | ') || null;
    };

    const resetForm = () => {
        setForm({ nombre: '', telefono: '', destino: [], cultoSeleccionado: '', observaciones: '', cultos: defaultCultos(), pendienteId: null });
        setErrores({}); setMostrarErrorCulto(false); setMostrarErrorDestino(false);
        setBloquearCultos(false); setModoEdicion(false); setIndiceEdicion(null);
        // limpiar estados de UI auxiliares
       
    };

    const handleGuardar = async () => {
  if (!validar()) return;

  const p_estudio: AppEstudioDia = toDbEstudio(form.destino);
  const p_notas = construirNotas();

  try {
    // 🔹 Caso especial: si viene de Pendientes, SIEMPRE registrar como nuevo
    if (form.pendienteId) {
      const { error } = await supabase.rpc('fn_registrar_persona', {
        p_nombre: form.nombre.trim(),
        p_telefono: form.telefono.trim(),
        p_culto: toDbEstudio(form.destino),
        p_estudio: toDbEstudio(form.destino),
        p_notas: construirNotas(),
      });
      if (error) throw error;

      // 👇 eliminar automáticamente de la tabla pendientes
      const { error: delError } = await supabase
        .from('pendientes')
        .delete()
        .eq('id', form.pendienteId);

      if (delError) {
        console.error(delError);
        toast('Guardado, pero no se pudo eliminar de pendientes');
      } else {
        toast('Persona registrada y eliminada de Pendientes');
      }

      setForm(prev => ({ ...prev, pendienteId: null }));

      // refrescar listado de pendientes si corresponde
      if (modalPendVisible) {
        try {
          const { data } = await supabase.rpc('fn_listar_pendientes');
          setPendientesRows((data || []) as PendienteItem[]);
        } catch {}
      }

      resetForm();
      return;
    }

    // 🔹 Si el destino es PENDIENTES, usar la nueva función de pendientes
    if (form.destino.includes('PENDIENTES')) {
      const { error } = await supabase.rpc('fn_registrar_pendiente', {
        p_nombre: form.nombre.trim(),
        p_telefono: form.telefono.trim(),
        p_destino: 'Pendientes',
        p_culto: form.cultoSeleccionado || null,
        p_observaciones: (form.observaciones || '').trim() || null,
      });
      if (error) throw error;
      toast('Registro guardado en Pendientes');
      resetForm();
      return;
    }

    // 🔹 Actualización normal
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
        p_culto: p_estudio, // si tu RPC lo usa
        p_estudio,
        p_notas,
      });
      if (error) throw error;
      toast('✅ Guardado. Enviado a Semillas 1 • Semana 1');
    }

    resetForm();
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
            resetForm();
        } catch (e) {
            console.error(e);
            toast('❌ Error al eliminar');
        }
    };

    /* ===== Búsqueda (modal) ===== */
    useEffect(() => {
        if (modoSoloPendientes) return; // No ejecutar búsqueda cuando es modo solo pendientes
        const q = busqueda.trim();
        if (q.length < MIN_CHARS) { setSugs([]); setOpenSugs(false); setActive(0); return; }

        const cached = cacheSugs.get(q);
        if (cached && Date.now() - cached.ts < TTL_MS) {
            setSugs(cached.data); setOpenSugs(cached.data.length > 0); setActive(0); return;
        }

        let cancel = false;
        setLoadingSug(true);

        const t = setTimeout(async () => {
            try {
                // 1) RPC de búsqueda por persona (nombre/teléfono)
                const { data, error } = await supabase.rpc('fn_buscar_persona', { q });
                if (error) throw error;

                // 2) Mapeo base (trae estudioDia y, si existieran, etapa/semana)
                let arr: Registro[] = (data || []).map((r: any) => ({
                    id: r.id,
                    fecha: '',
                    nombre: r.nombre,
                    telefono: r.telefono ?? null,
                    preferencias: null,
                    cultosSeleccionados: null,
                    observaciones: r.observaciones ?? null,
                    estudioDia: r.estudio_dia ?? null,
                    etapa: (r.etapa as AppEtapa) ?? null,
                    semana: (typeof r.semana === 'number' ? r.semana : null),
                }));

                // 3) Si la RPC no trajo etapa/semana, completar consultando 'progreso' activo
                const needStatus = arr.some(x => !x.etapa || x.semana == null);
                if (needStatus) {
                    const ids = arr.map(x => x.id).filter(Boolean);
                    if (ids.length > 0) {
                        const { data: estados, error: err2 } = await supabase
                            .from('progreso')
                            .select('persona_id, etapa, semana, creado_en')
                            .eq('activo', true)
                            .in('persona_id', ids)
                            .order('creado_en', { ascending: false });

                        if (!err2 && estados && estados.length) {
                            const map = new Map<string, { etapa: AppEtapa | null; semana: number | null }>();
                            for (const row of estados as any[]) {
                                if (!map.has(row.persona_id)) {
                                    map.set(row.persona_id, { etapa: row.etapa ?? null, semana: row.semana ?? null });
                                }
                            }
                            arr = arr.map(p => {
                                const m = map.get(p.id);
                                return m ? { ...p, etapa: p.etapa ?? m.etapa, semana: p.semana ?? m.semana } : p;
                            });
                        }
                    }
                }

                if (!cancel) {
                    cacheSugs.set(q, { ts: Date.now(), data: arr });
                    setSugs(arr); setOpenSugs(arr.length > 0); setActive(0);
                }
            } catch (e) {
                console.error('buscar sugerencias:', e);
                if (!cancel) { setSugs([]); setOpenSugs(false); }
            } finally {
                if (!cancel) setLoadingSug(false);
            }
        }, DEBOUNCE_MS);

        return () => { cancel = true; clearTimeout(t); };
    }, [busqueda, modoSoloPendientes]);

    /* ===== Inyectar datos al formulario desde búsqueda ===== */
    const selectPersona = (p: Registro, fromPendientes: boolean = false) => {
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
            observaciones: culto.clean || '',
            destino,
            cultos: cultosMap,
            cultoSeleccionado,
            pendienteId: fromPendientes ? (p.id || null) : null,
        }));

        setModoEdicion(true);
        setIndiceEdicion(p.id);
        setBloquearCultos(true);

        setBusqueda(''); setSugs([]); setOpenSugs(false); setModoSoloPendientes(false); setModalBuscarVisible(false);
        setTimeout(() => observacionesRef.current?.focus(), 0);
    };

    // Cargar un registro del modal de Pendientes como NUEVO
    const selectPendiente = (p: any) => {
        setForm(f => ({
            ...f,
            nombre: p?.nombre || '',
            telefono: p?.telefono || '',
            observaciones: (p?.observaciones ?? ''),
            destino: [],
            cultos: defaultCultos(),
            cultoSeleccionado: '',
            pendienteId: (p?.id ?? p?.progreso_id ?? p?.persona_id ?? null) || null,
        }));
        setModoEdicion(false);
        setIndiceEdicion(null);
        setBloquearCultos(false);
        setModalPendVisible(false);
        setModalBuscarVisible(false);
        setModoSoloPendientes(false);
        setBusqueda('');
        setSugs([]);
        setOpenSugs(false);
        setTimeout(() => observacionesRef.current?.focus(), 0);
    };

    const onKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (openSugs && sugs.length > 0) selectPersona(sugs[active] ?? sugs[0]);
            setBusqueda(''); setOpenSugs(false);
            return;
        }
        if (!openSugs || sugs.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, sugs.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Escape') { setOpenSugs(false); }
    };

    // Abrir el mismo modal de búsqueda pero mostrando solo "Pendientes"
    const abrirSoloPendientes = async () => {
        setModoSoloPendientes(true);
        setModalBuscarVisible(true);
        setBusqueda('');
        setSugs([]);
        setOpenSugs(false);
        setLoadingSug(true);

        try {
            const { data, error } = await supabase.rpc('fn_buscar_persona', { q: '' });
            if (error) throw error;

            let arr: Registro[] = (data || []).map((r: any) => ({
                id: r.id,
                nombre: r.nombre,
                telefono: r.telefono ?? null,
                estudioDia: r.estudio_dia ?? null,
                etapa: (r.etapa as AppEtapa) ?? null,
                semana: (typeof r.semana === 'number' ? r.semana : null),
                observaciones: r.observaciones ?? null,
                // campos adicionales del tipo Registro, no usados aquí
                fecha: '',
                preferencias: null,
                cultosSeleccionados: null,
            }));

            // 🔹 Filtrar solo pendientes
            arr = arr.filter(p => p.estudioDia?.toUpperCase() === 'PENDIENTES');

            setSugs(arr);
            setOpenSugs(arr.length > 0);
            setActive(0);
        } catch (e) {
            console.error(e);
            toast('Error cargando pendientes');
        } finally {
            setLoadingSug(false);
        }
    };

    // Modal Pendientes: abre y carga lista desde vista histórica
    const abrirPendientes = async () => {
        setModalPendVisible(true);
        setPendLoading(true);
        try {
            const { data, error } = await supabase.rpc('fn_listar_pendientes');
            if (error) throw error;
            setPendientesRows((data || []) as PendienteItem[]);
            setPendPage(0);
        } catch (e) {
            console.error(e);
            toast('Error cargando pendientes');
        } finally {
            setPendLoading(false);
        }
    };

    // Sugerencia de autocompletado fantasma para el buscador
    const ghost =
        openSugs && sugs[0] && (sugs[0].nombre ?? '').toLowerCase().startsWith(busqueda.toLowerCase())
            ? (sugs[0].nombre ?? '').slice(busqueda.length)
            : '';

    /* ===== UI ===== */
    return (
        <div className="pn-root">
            <div className="formulario-box" id="formulario1">
                <div className="form-title">Registro Persona Nueva</div>

                {/* Modal BUSCAR */}
                {modalBuscarVisible && (
                    <div className="modal-buscar" role="dialog" aria-modal="true">
                        <div className="modal-buscar__box">
                            <button className="modal-buscar__close" aria-label="Cerrar"
                                    onClick={() => { setBusqueda(''); setSugs([]); setOpenSugs(false); setModalBuscarVisible(false); setModoSoloPendientes(false); }}>×</button>

                            <h3 className="modal-buscar__heading">{modoSoloPendientes ? 'Registros Pendientes' : 'Buscar Registros en Base de Datos'}</h3>

                            <div className="search-wrap" onBlur={() => setTimeout(() => setOpenSugs(false), 120)}>
                                <div className="ghost" aria-hidden style={{ display: modoSoloPendientes ? 'none' : undefined }}>
                                    <span className="ghost-typed">{busqueda}</span>
                                    <span className="ghost-hint">{ghost}</span>
                                </div>
                                <input
                                    style={{ display: modoSoloPendientes ? 'none' : undefined }}
                                    type="text"
                                    placeholder="Buscar por nombre o teléfono…"
                                    value={busqueda}
                                    ref={inputBusquedaModalRef}
                                    onFocus={() => setOpenSugs(sugs.length > 0)}
                                    onChange={(e) => { const v = e.target.value; setBusqueda(v); setOpenSugs(v.trim().length >= MIN_CHARS); }}
                                    onKeyDown={onKeyDownSearch}
                                    role="combobox"
                                    aria-expanded={openSugs}
                                    aria-controls="sug-list-modal"
                                    aria-activedescendant={openSugs && sugs[active] ? `optm-${sugs[active].id}` : undefined}
                                />
                                {openSugs && (
                                    <div id="sug-list-modal" role="listbox" className="sug-list">
                                        {sugs.map((p, i) => (
                                            <button
                                                key={p.id}
                                                id={`optm-${p.id}`}
                                                role="option"
                                                aria-selected={i === active}
                                                onMouseEnter={() => setActive(i)}
                                                onMouseDown={(ev) => ev.preventDefault()}
                                                onClick={() => selectPersona(p)}
                                                className={`sug-item ${i === active ? 'active' : ''}`}
                                                title={`${p.nombre} • ${p.telefono ?? '—'}`}
                                            >
                                                <div className="sug-name">{p.nombre}</div>
                                                <div className="sug-sub">
                                                    {p.telefono ?? '—'}
                                                    <span className="sug-pill" style={{ marginLeft: 8 }}>
                            Grupo: {p.estudioDia ?? '—'}
                          </span>
                                                    <span className="sug-pill" style={{ marginLeft: 8 }}>
                            Etapa: {p.etapa ?? '—'}
                          </span>
                                                    <span className="sug-pill" style={{ marginLeft: 8 }}>
                            Semana: {p.semana ?? '—'}
                          </span>
                                                </div>
                                            </button>
                                        ))}
                                        {loadingSug && <div className="sug-loading">Buscando…</div>}
                                        {!loadingSug && sugs.length === 0 && <div className="sug-empty">Sin resultados</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {/* Fila: nombre / teléfono */}
                <div className="form-row first-row">
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
                            className={errores.nombre ? 'input-error' : ''}
                        />
                        {errores.nombre && <div className="error-msg">{errores.nombre}</div>}
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
                            className={errores.telefono ? 'input-error' : ''}
                        />
                        {errores.telefono && <div className="error-msg">{errores.telefono}</div>}
                    </div>
                </div>

                {/* Culto de ingreso (bloqueado tras selección) */}
                <div className="cultos-row">
                    <label className="Label-Culto">Culto:</label>
                    {Object.entries(form.cultos).map(([dia, valorActual]) => (
                        <div key={dia} className={`culto-box ${bloquearCultos && !valorActual.includes(dia) ? 'disabled' : ''}`}>
                            {valorActual}
                            {/* Desplegables sólo si NO está bloqueado */}
                            {!bloquearCultos && (
                                <ul className="culto-lista">
                                    {cultosOpciones[(dia as DiaKey)].map((opcion, index) => (
                                        <li key={index} onClick={() => {
                                            if (bloquearCultos) return;
                                            const key = dia as DiaKey;
                                            const full = `${dia} - ${opcion}`;
                                            const updated: CultosMap = { ...defaultCultos(), [key]: opcion } as CultosMap;
                                            setForm(prev => ({
                                                ...prev,
                                                cultoSeleccionado: full,
                                                cultos: updated,
                                            }));
                                            setMostrarErrorCulto(false);
                                            setBloquearCultos(true);
                                        }}>{opcion}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>

                {mostrarErrorCulto && (
                    <div className="error-msg" style={{ textAlign: 'center', marginBottom: '1rem', color: 'white' }}>
                        ¡Escoge por favor un horario del Culto!
                    </div>
                )}

                {/* Switches (día de estudio) + Observaciones */}
                <div className="form-group destinos-row">
                    <div className="switch-group">
                        {['DOMINGO', 'MARTES', 'VIRTUAL', 'PENDIENTES'].map((d) => (
                            <label key={d} className="switch-label">
                                <input
                                    type="checkbox"
                                    className="switch-input"
                                    value={d}
                                    onChange={(e) => {
                                        const { value, checked } = e.target;
                                        setMostrarErrorDestino(false);
                                        setForm(prev => ({ ...prev, destino: checked ? [value] : [] }));
                                    }}
                                    checked={form.destino.includes(d)}
                                />
                                <span className="switch-slider"></span> {d}
                            </label>
                        ))}
                    </div>

                    <div style={{ flex: 1 }}>
            <textarea
                ref={observacionesRef}
                id="observaciones"
                className="observaciones-estilo"
                placeholder="Escribe aquí las observaciones..."
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            />
                    </div>
                </div>

                {/* Modal PENDIENTES */}
                {modalPendVisible && (
                    <div className="modal-buscar" role="dialog" aria-modal="true">
                        <div className="modal-buscar__box">
                            <button className="modal-buscar__close" aria-label="Cerrar"
                                    onClick={() => setModalPendVisible(false)}>×</button>

                            <h3 className="modal-buscar__heading">Pendientes</h3>

                            <div className="tabla-archivo-wrap" style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
                                <table className="tabla-archivo" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Nombre</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Teléfono</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Día</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Semana</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Etapa</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {pendLoading && (
                                        <tr><td colSpan={5} style={{ padding: 12 }}>Cargando…</td></tr>
                                    )}
                                    {!pendLoading && pendientesRows.length === 0 && (
                                        <tr><td colSpan={5} style={{ padding: 12 }}>Sin pendientes</td></tr>
                                    )}
                                    {!pendLoading && pendientesRows
                                        .slice(pendPage * PEND_PAGE_SIZE, (pendPage + 1) * PEND_PAGE_SIZE)
                                        .map((row) => (
                                        <tr
                                            key={(row.progreso_id ?? row.persona_id ?? row.id ?? Math.random().toString())}
                                            className="arch-row"
                                            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                            title="Cargar en el formulario"
                                            onClick={() => selectPendiente(row)}
                                        >
                                            <td style={{ padding: '8px' }}>{row.nombre ?? ''}</td>
                                            <td style={{ padding: '8px' }}>{row.telefono ?? ''}</td>
                                            <td style={{ padding: '8px' }}>{soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? '')}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                {(!pendLoading && pendientesRows.length > PEND_PAGE_SIZE) && (
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8 }}>
                                    <button
                                      className="btn-minimal"
                                      onClick={() => setPendPage(p => Math.max(0, p - 1))}
                                      disabled={pendPage === 0}
                                    >Atrás</button>
                                    <div style={{ opacity:.8 }}>
                                      Página {pendPage + 1} de {Math.max(1, Math.ceil(pendientesRows.length / PEND_PAGE_SIZE))}
                                    </div>
                                    <button
                                      className="btn-minimal"
                                      onClick={() => setPendPage(p => Math.min(Math.ceil(pendientesRows.length / PEND_PAGE_SIZE) - 1, p + 1))}
                                      disabled={pendPage >= Math.ceil(pendientesRows.length / PEND_PAGE_SIZE) - 1}
                                    >Siguiente</button>
                                  </div>
                                )}
                                <style jsx global>{`
                                  .modal-buscar .tabla-archivo .arch-row { transition: transform .14s ease, background .2s ease, box-shadow .2s ease; }
                                  .modal-buscar .tabla-archivo .arch-row:hover {
                                    background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12));
                                    transform: translateY(-1px) scale(1.01);
                                    box-shadow: 0 6px 18px rgba(0,0,0,.18);
                                  }
                                  /* Mostrar solo 3 columnas y renombrar la tercera cabecera */
                                  .modal-buscar .tabla-archivo thead th:nth-child(3) { position: relative; color: transparent; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(3)::after { content: 'Fecha de creación'; position: absolute; left: 8px; color: inherit; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(n+4) { display: none; }
                                  .modal-buscar .tabla-archivo tbody td:nth-child(n+4) { display: none; }
                                `}</style>
                                <style jsx global>{`
                                  .modal-buscar .tabla-archivo thead th:nth-child(3){ position: relative !important; color: inherit !important; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(3)::after{ content: 'Fecha' !important; position: absolute; left: 8px; color: inherit !important; }
                                `}</style>
                                <style jsx global>{`
                                  /* Forzar encabezados limpios */
                                  .modal-buscar .tabla-archivo thead th:nth-child(2){ position: relative; font-size: 0 !important; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(2)::after{ content: 'Teléfono'; font-size: 14px; position: absolute; left: 8px; color: inherit; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(3){ position: relative; font-size: 0 !important; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(3)::after{ content: 'Fecha'; font-size: 14px; position: absolute; left: 8px; color: inherit; }
                                  .modal-buscar .tabla-archivo thead th:nth-child(n+4){ display:none; }
                                `}</style>
                            </div>
                        </div>
                    </div>
                )}

                {/* Botones */}
                <div className="btn-container" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn-minimal" onClick={handleGuardar} style={{ backgroundColor: (modoEdicion) ? 'orange' : '' }}>
                        {modoEdicion ? 'Actualizar' : 'Guardar'}
                    </button>

                    <button
                        className="btn-minimal btn-buscar"
                        onClick={() => {
                            setModoSoloPendientes(false);
                            setBusqueda(''); setSugs([]); setOpenSugs(false);
                            setModalBuscarVisible(true); setTimeout(() => inputBusquedaModalRef.current?.focus(), 0);
                        }}
                        title="Abrir panel de búsqueda"
                    >
                        Buscar
                    </button>

                    {/* Pendientes */}
                    <button
                        className="btn-minimal"
                        onClick={abrirPendientes}
                        title="Ver registros pendientes"
                    >
                        Pendientes
                    </button>

                    {/* Eliminar */}
                    <button
                        className="btn-minimal"
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
