// File: PersonaNueva.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
// Iconos actualizados: PDF, Excel y Teléfono
import { Trash2, Phone, FileText, FileSpreadsheet } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';

// Importaciones para exportar archivos
import jsPDF from 'jspdf';
// Importar 'autoTable' como una función nombrada
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


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

// Normaliza teléfono a solo dígitos
const normalizaTelefono = (v: string) => (v || '').replace(/\D+/g, '');

// Chequea duplicado SOLO en pendientes
const existePendienteConTelefono = async (tel: string, excluirId?: string | null) => {
    const query = supabase
        .from('pendientes')
        .select('id', { count: 'exact' })
        .eq('telefono', tel)
        .limit(1);
    if (excluirId) query.neq('id', excluirId);
    const { count, error } = await query;
    if (error) throw error;
    return (count || 0) > 0;
};


const normaliza = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Formatea a solo fecha (dd/mm/aa) */
const soloFecha = (v?: string | null): string => {
    if (!v) return '';
    const d = new Date(v);
    
    // Si la fecha es inválida, intenta formatear el string YYYY-MM-DD
    if (isNaN((d as unknown) as number)) {
        const parts = v.slice(0, 10).split('-');
        if (parts.length === 3 && parts[0].length === 4) {
             // Formato YYYY-MM-DD -> DD/MM/YY
             return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
        }
        return v.slice(0, 10); // Fallback si el formato es desconocido
    }
    
    // Si la fecha es válida, usa toLocaleDateString con año de 2 dígitos
    try { 
        return d.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit' 
        }); 
    } catch { 
        // Fallback manual en caso de error
        const year = d.getFullYear().toString().slice(-2);
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${day}/${month}/${year}`;
    }
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
    
    // CORRECCIÓN: Asegurar que 'clean' siempre sea string
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

    // Estados para el modo listado en el modal de búsqueda
    const [modoListado, setModoListado] = useState(false);
    const [listadoPersonas, setListadoPersonas] = useState<Registro[]>([]);
    const [listadoPage, setListadoPage] = useState(0);
    const [totalPersonas, setTotalPersonas] = useState(0);
    const [listadoLoading, setListadoLoading] = useState(false);
    const LISTADO_PAGE_SIZE = 10;


    const cacheSugs = useRef(new Map<string, { ts: number; data: Registro[] }>()).current;
    const TTL_MS = 60_000, MIN_CHARS = 3, DEBOUNCE_MS = 350;
    
    useEffect(() => { if (modalBuscarVisible) setTimeout(() => inputBusquedaModalRef.current?.focus(), 0); }, [modalBuscarVisible]);

    const toast = (msg: string) => {
        const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    };

    // --- INICIO: Premium "Cupertino 2025" toast/modal para descargas ---
    const ensurePremiumToastStyles = () => {
        if (document.getElementById('premium-toast-styles')) return;
        const s = document.createElement('style');
        s.id = 'premium-toast-styles';
        s.textContent = `
            .premium-toast-wrap {
                position: fixed;
                right: 20px;
                bottom: 26px;
                z-index: 99999;
                backdrop-filter: blur(8px) saturate(120%);
                -webkit-backdrop-filter: blur(8px) saturate(120%);
                transition: transform .32s cubic-bezier(.22,.9,.3,1), opacity .28s ease;
                transform-origin: bottom right;
                opacity: 0;
                transform: translateY(18px) scale(.98);
                pointer-events: none;
            }
            .premium-toast-wrap.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
            .premium-toast-card {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 320px;
                max-width: 420px;
                padding: 12px 14px;
                border-radius: 14px;
                box-shadow: 0 10px 32px rgba(20,20,40,0.08), inset 0 1px 0 rgba(255,255,255,0.6);
                background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(245,246,250,0.86));
                border: 1px solid rgba(60,60,90,0.06);
                font-family: Inter, system-ui, -apple-system, "SF Pro Text", "Helvetica Neue", Arial;
            }
            .premium-toast-card.ok { border-color: rgba(16,185,129,0.12); }
            .premium-toast-card.err { border-color: rgba(239,68,68,0.12); }
            .premium-toast-icon {
                flex: 0 0 44px;
                height: 44px;
                border-radius: 10px;
                display: grid;
                place-items: center;
                font-weight: 700;
                font-size: 18px;
                color: white;
            }
            .premium-toast-icon.ok { background: linear-gradient(135deg,#10b981,#059669); box-shadow: 0 6px 20px rgba(16,185,129,0.18); }
            .premium-toast-icon.err { background: linear-gradient(135deg,#ef4444,#dc2626); box-shadow: 0 6px 20px rgba(239,68,68,0.18); }
            .premium-toast-body { display:flex; flex-direction:column; gap:3px; min-width:0; }
            .premium-toast-title { font-weight:700; font-size:14px; color:#0f172a; line-height:1; }
            .premium-toast-sub { font-size:13px; color:#475569; opacity:.95; line-height:1.1; }
            .premium-toast-close { margin-left:8px; background:transparent; border:none; color:#64748b; cursor:pointer; font-size:14px; padding:6px; border-radius:8px; }
            @media (max-width:420px){ .premium-toast-wrap{ left:12px; right:12px; bottom:18px } .premium-toast-card{min-width:unset;width:100%} }
        `;
        document.head.appendChild(s);
    };

    const showPremiumToast = (success: boolean, tipo: 'PDF'|'Excel') => {
        ensurePremiumToastStyles();
        const id = `premium-toast-${Date.now()}`;
        const wrap = document.createElement('div');
        wrap.className = 'premium-toast-wrap';
        wrap.id = id;

        const card = document.createElement('div');
        card.className = `premium-toast-card ${success ? 'ok' : 'err'}`;

        const icon = document.createElement('div');
        icon.className = `premium-toast-icon ${success ? 'ok' : 'err'}`;
        icon.textContent = success ? '✓' : '✕';

        const body = document.createElement('div');
        body.className = 'premium-toast-body';
        const title = document.createElement('div');
        title.className = 'premium-toast-title';
        title.textContent = success ? 'Descarga completada' : 'Descarga fallida';
        const sub = document.createElement('div');
        sub.className = 'premium-toast-sub';
        sub.textContent = success
            ? `Archivo ${tipo} descargado exitosamente`
            : `No se pudo descargar el archivo ${tipo}`;

        const close = document.createElement('button');
        close.className = 'premium-toast-close';
        close.innerText = 'Cerrar';
        close.onclick = (ev) => {
            ev.stopPropagation();
            wrap.classList.remove('visible');
            setTimeout(() => wrap.remove(), 320);
        };

        body.appendChild(title);
        body.appendChild(sub);
        card.appendChild(icon);
        card.appendChild(body);
        card.appendChild(close);
        wrap.appendChild(card);
        document.body.appendChild(wrap);

        // Animate in
        requestAnimationFrame(() => wrap.classList.add('visible'));
        // Auto remove
        setTimeout(() => {
            wrap.classList.remove('visible');
            setTimeout(() => wrap.remove(), 340);
        }, 4200);
    };
    // --- FIN: Premium toast ---

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
            // ...existing code...
            // No modificar lógica de pendientes
            const { error } = await supabase.rpc('fn_registrar_persona', {
                p_nombre: form.nombre.trim(),
                p_telefono: form.telefono.trim(),
                p_culto: toDbEstudio(form.destino),
                p_estudio: toDbEstudio(form.destino),
                p_notas: construirNotas(),
            });
            if (error) throw error;
            // ...existing code...
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
            // ...existing code...
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
            // ...existing code...
            // No modificar lógica de pendientes
            const telNorm = normalizaTelefono(form.telefono);
            if (telNorm.length < 7) {
                setErrores(prev => ({ ...prev, telefono: 'Número inválido o incompleto' }));
                toast('Número inválido o incompleto');
                return;
            }
            const dup = await existePendienteConTelefono(telNorm, form.pendienteId ?? null);
            if (dup) {
                setErrores(prev => ({ ...prev, telefono: 'Ya existe un pendiente con este teléfono' }));
                toast('⚠️ Ya existe un pendiente con este teléfono');
                return;
            }
            const { error } = await supabase.rpc('fn_registrar_pendiente', {
                p_nombre: form.nombre.trim(),
                p_telefono: telNorm,
                p_destino: 'Pendientes',
                p_culto: form.cultoSeleccionado || null,
                p_observaciones: (form.observaciones || '').trim() || null,
            });
            if (error) throw error;
            toast('Registro guardado en Pendientes');
            if (modalPendVisible) {
                const { data } = await supabase.rpc('fn_listar_pendientes');
                setPendientesRows((data || []) as PendienteItem[]);
            }
            resetForm();
            return;
        }

        // 🔹 Validar duplicado para switches DOMINGO, MARTES, VIRTUAL
        if (form.destino.some(d => ['DOMINGO', 'MARTES', 'VIRTUAL'].includes(d))) {
            const telNorm = normalizaTelefono(form.telefono);
            // Buscar duplicado en la tabla persona (no pendientes)
            const { count, error } = await supabase
                .from('persona')
                .select('id', { count: 'exact' })
                .eq('telefono', telNorm)
                .limit(1);
            if (error) throw error;
            // Si está editando, excluir el mismo registro
            let isDup = false;
            if (count && count > 0) {
                if (modoEdicion && indiceEdicion) {
                    // Buscar si el duplicado es el mismo registro
                    const { data: personaData, error: personaError } = await supabase
                        .from('persona')
                        .select('id')
                        .eq('telefono', telNorm)
                        .limit(1);
                    if (personaError) throw personaError;
                    if (personaData && personaData.length > 0 && personaData[0].id !== indiceEdicion) {
                        isDup = true;
                    }
                } else {
                    isDup = true;
                }
            }
            if (isDup) {
                setErrores(prev => ({ ...prev, telefono: 'Ya existe una persona con este teléfono' }));
                toast('⚠️ Ya existe una persona con este teléfono.');
                return;
            }
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

    /* ===== Listado de Personas (desde el modal de búsqueda) ===== */
    const fetchListado = async () => {
        setListadoLoading(true);
        try {
            const { data, error } = await supabase.rpc('fn_buscar_persona', { q: '' });

            if (error) throw error;

            const arr: Registro[] = (data || []).map((r: any) => ({
                id: r.id,
                nombre: r.nombre,
                telefono: r.telefono ?? null,
                estudioDia: r.estudio_dia ?? null,
                observaciones: r.observaciones ?? null,
                etapa: r.etapa as AppEtapa | null,
                semana: typeof r.semana === 'number' ? r.semana : null,
                // Rellenar campos para mantener consistencia con el tipo Registro
                fecha: '',
                preferencias: null,
                cultosSeleccionados: null,
            }));

            setListadoPersonas(arr);
            setTotalPersonas(arr.length);

        } catch (e) {
            console.error('Error cargando listado:', e);
            toast('❌ Error al cargar el listado');
        } finally {
            setListadoLoading(false);
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
            const diaBonito = key[0] + key.slice(1).toLowerCase();
            cultosMap = { ...defaultCultos(), [key]: culto.hora! } as CultosMap; // Asegurarse que es una hora no nula
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
        const culto = extraerCultoDesdeNotas(p.observaciones);
        let cultosMap: CultosMap = defaultCultos();
        let cultoSeleccionado = '';

        // Si el pendiente tiene un culto asociado, establecerlo en el formulario
        if (culto.diaKey && culto.hora) {
            const key = culto.diaKey as DiaKey;
            const diaBonito = key[0] + key.slice(1).toLowerCase();
            cultosMap = { ...defaultCultos(), [key]: culto.hora! } as CultosMap; // Asegurarse que es una hora no nula
            cultoSeleccionado = `${diaBonito} - ${culto.hora}`;
        }

        setForm(f => ({
            ...f,
            nombre: p?.nombre || '',
            telefono: p?.telefono || '',
            observaciones: culto.clean || '', // Usar las observaciones limpias
            destino: [],
            cultos: cultosMap, // Establecer el culto mapeado
            cultoSeleccionado, // Establecer el string de culto seleccionado
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

    // Eliminar pendiente desde el modal
    const handleEliminarPendiente = async (row: PendienteItem) => {
      if (!row?.id) { toast('No se encontró el ID del pendiente'); return; }
      const ok = window.confirm(`¿Eliminar el pendiente de "${row.nombre ?? ''}"?`);
      if (!ok) return;
      try {
          const { error } = await supabase.from('pendientes').delete().eq('id', row.id);
          if (error) throw error;
          setPendientesRows(prev => prev.filter(r => r.id !== row.id));
          toast('🗑️ Pendiente eliminado');
      } catch (e) {
          console.error(e);
          toast('❌ Error eliminando pendiente');
      }
    };

    
    /* ===== FUNCIONES DE EXPORTACIÓN ===== */

    const handleExportPDF = () => {
        if (!pendientesRows.length) {
            toast('No hay datos para exportar');
            return;
        }

        const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Listado de Contactos pendientes del Mes ${mesActual.charAt(0).toUpperCase() + mesActual.slice(1)}`, 14, 20);

        const headers = [["Nombre", "Teléfono", "Fecha", "Culto de Ingreso"]];
        const body = pendientesRows.map(row => {
            const culto = extraerCultoDesdeNotas(row.observaciones);
            return [
                row.nombre || '',
                row.telefono || '',
                soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? ""),
                culto.full || 'N/A' // 'full' tiene el formato "Domingo - 7:00 AM"
            ];
        });

        // =================================================================
        // ======================= INICIO DE LA CORRECCIÓN =======================
        // =================================================================
        try {
            // Llamar a autoTable como una función, pasando el 'doc'
            autoTable(doc, {
                startY: 28,
                head: headers,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] } // Indigo color
            });

            doc.save(`pendientes_${mesActual}.pdf`);
            // Notificación premium de éxito
            try { showPremiumToast(true, 'PDF'); } catch { /* ignore */ }
        } catch (err) {
            console.error('Error exportando PDF:', err);
            // Notificación premium de error
            try { showPremiumToast(false, 'PDF'); } catch { /* ignore */ }
        }
    };

    const handleExportExcel = () => {
        if (!pendientesRows.length) {
            toast('No hay datos para exportar');
            return;
        }

        const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });
        
        // Fila de Título
        const title = [`Listado de Contactos pendientes del Mes ${mesActual.charAt(0).toUpperCase() + mesActual.slice(1)}`];
        
        // Fila de Encabezados
        const headers = ["Nombre", "Teléfono", "Fecha", "Culto de Ingreso"];
        
        // Filas de Datos
        const data = pendientesRows.map(row => {
            const culto = extraerCultoDesdeNotas(row.observaciones);
            return [
                row.nombre || '',
                row.telefono || '',
                soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? ""),
                culto.full || 'N/A'
            ];
        });

        // Combinar todo
        const allRows = [title, [], headers, ...data]; // Fila vacía para espaciado
        
        // Crear hoja de cálculo
        const ws = XLSX.utils.aoa_to_sheet(allRows);
        
        // Unir celdas del título (A1 a D1)
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
        
        try {
            // Crear libro y añadir hoja
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Pendientes ${mesActual}`);

            // Guardar archivo
            XLSX.writeFile(wb, `pendientes_${mesActual}.xlsx`);
            // Notificación premium de éxito
            try { showPremiumToast(true, 'Excel'); } catch { /* ignore */ }
        } catch (err) {
            console.error('Error exportando Excel:', err);
            try { showPremiumToast(false, 'Excel'); } catch { /* ignore */ }
        }
    };
    
    /* ===== UI ===== */
    return (
        <div className="pn-root">
            <div className="formulario-box" id="formulario1">
                <div className="form-title">Registro Persona Nueva</div>

                {/* Modal BUSCAR */}
                {modalBuscarVisible && (
                    <div className="modal-buscar2-backdrop fixed inset-0 z-40 bg-[rgba(80,70,229,0.10)] backdrop-blur-md" style={{ overflow: 'hidden' }}></div>
                )}
                {modalBuscarVisible && (
                    <div className="modal-buscar2 fixed top-0 left-0 right-0 z-50 flex items-start justify-center pt-6" role="dialog" aria-modal="true">
                        <div className="modal-buscar2__box sm:max-w-[540px] max-w-[90vw] w-full mx-auto" style={{ width: '100%', maxWidth: '90vw', boxSizing: 'border-box', background: 'linear-gradient(135deg, #e0e7ff 0%, #f3f4f6 60%, #c7d2fe 100%)', boxShadow: '0 8px 32px rgba(80,70,229,0.18)', borderRadius: '22px', border: '1.5px solid #e0e7ff' }}>
                            <button
                                className="modal-buscar2__close"
                                aria-label="Cerrar"
                                style={{
                                    transition: 'background 0.18s, color 0.18s',
                                    position: 'absolute',
                                    top: 12,
                                    right: 12,
                                    zIndex: 100,
                                    width: 40,
                                    height: 40,
                                    padding: 0,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.7rem',
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.85)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#ff4d4f'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.color = ''; }}
                                onClick={() => {
                                    setBusqueda('');
                                    setSugs([]);
                                    setOpenSugs(false);
                                    setModalBuscarVisible(false);
                                    setModoSoloPendientes(false);
                                    setModoListado(false);
                                    setListadoPage(0);
                                    // Optimizacion: No limpiamos listadoPersonas para que sirva de caché
                                    // si el usuario vuelve a abrir el modal en la misma sesión.
                                    // Si prefieres que siempre recargue, descomenta la linea de abajo
                                    // setListadoPersonas([]);
                                }}
                            >×</button>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <h3 className="modal-buscar2__heading" style={{ textAlign: 'center', width: '100%', fontFamily: 'serif', fontWeight: 800, fontSize: '1.55rem', color: '#3b2f7f', letterSpacing: '0.03em', textShadow: '0 2px 8px #c7d2fe' }}>
                                        {modoSoloPendientes ? 'Registros Pendientes' : (modoListado ? 'Listado General' : 'Buscar Registros')}
                                    </h3>
                                    {!modoSoloPendientes && (
                                        <button 
                                            className="btn-minimal px-1 py-0.5 text-xs rounded-md flex items-center justify-center"
                                            style={{ position: 'relative', zIndex: 1, minWidth: 60, height: 28, fontWeight: 600, letterSpacing: '0.01em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onClick={() => {
                                                const entrandoEnModoListado = !modoListado;
                                                setModoListado(entrandoEnModoListado);
                                                if (entrandoEnModoListado && listadoPersonas.length === 0) {
                                                    fetchListado();
                                                }
                                            }}
                                        >
                                            {modoListado ? 'Buscar' : 'Listado'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {modoListado ? (
                                <>
                                    <table className="w-full border-collapse text-black rounded-xl overflow-hidden shadow-lg">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 text-white border-b border-indigo-300">
                                                <th className="text-left font-extrabold px-4 py-3 tracking-wide text-lg drop-shadow">Nombre</th>
                                                <th className="text-left font-extrabold px-4 py-3 tracking-wide text-lg drop-shadow">Teléfono</th>
                                                <th className="text-left font-extrabold px-4 py-3 tracking-wide text-lg drop-shadow">Grupo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listadoLoading && <tr><td colSpan={3} className="text-center py-4">Cargando...</td></tr>}
                                            {!listadoLoading && listadoPersonas.length === 0 && <tr><td colSpan={3} className="text-center py-4">No hay registros</td></tr>}
                                            {!listadoLoading && listadoPersonas
                                                .slice(listadoPage * 7, (listadoPage + 1) * 7)
                                                .map(p => (
                                                <tr key={p.id} onClick={() => selectPersona(p)} className="cursor-pointer transition-colors hover:bg-indigo-50">
                                                    <td className="px-2 py-3">{p.nombre}</td>
                                                    <td className="px-2 py-3">{p.telefono}</td>
                                                    <td className="px-2 py-3">{p.estudioDia || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                     <div className="mt-3 flex items-center justify-between text-white gap-4">
                                            <button
                                                onClick={() => setListadoPage(p => Math.max(0, p - 1))}
                                                disabled={listadoPage === 0}
                                                className="px-3 py-1.5 rounded-lg font-semibold border border-indigo-300 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 text-white shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:bg-gradient-to-r hover:from-pink-400 hover:to-indigo-500 sm:px-3 sm:py-1.5 px-2 py-1 text-sm"
                                            >
                                                ◀ Atrás
                                            </button>
                                            <div className="opacity-90 text-lg font-semibold drop-shadow">
                                                Página {listadoPage + 1} de {Math.ceil(totalPersonas / LISTADO_PAGE_SIZE)}
                                            </div>
                                            <button
                                                onClick={() => setListadoPage(p => Math.min(Math.ceil(totalPersonas / LISTADO_PAGE_SIZE) - 1, p + 1))}
                                                disabled={listadoPage >= Math.ceil(totalPersonas / LISTADO_PAGE_SIZE) - 1}
                                                className="px-3 py-1.5 rounded-lg font-semibold border border-indigo-300 bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500 text-white shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-pink-400 sm:px-3 sm:py-1.5 px-2 py-1 text-sm"
                                            >
                                                Siguiente ▶
                                            </button>
                                        </div>
                                </>
                            ) : (
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
                            )}
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

                                {/* ========= INICIO: Modal PENDIENTES (Estilo Cupertino) ========= */}
                                {modalPendVisible && (
                                    <div
                                        id="modal-pendientes"
                                        role="dialog"
                                        aria-modal="true"
                                        aria-labelledby="pend-title"
                                        onKeyDown={(e) => e.key === "Escape" && setModalPendVisible(false)}
                                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md"
                                    >
                                        <div
                                            tabIndex={-1}
                                            className="w-[min(600px,92vw)] rounded-[20px] overflow-hidden border border-neutral-200/50 shadow-2xl bg-white/90 backdrop-blur-xl"
                                        >
                                            
                                            {/* Header sticky con Iconos de Exportación */}
                                            <div className="sticky top-0 flex items-center justify-between py-3.5 px-5 bg-white/70 backdrop-blur-sm border-b border-neutral-300/80">
                                                {/* Iconos Izquierda */}
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={handleExportPDF} 
                                                        className="grid place-items-center w-7 h-7 rounded-full text-red-600 bg-red-100/80 transition-all hover:bg-red-200/90" 
                                                        title="Exportar PDF"
                                                    >
                                                        <FileText size={15} />
                                                    </button>
                                                    <button 
                                                        onClick={handleExportExcel} 
                                                        className="grid place-items-center w-7 h-7 rounded-full text-green-700 bg-green-100/80 transition-all hover:bg-green-200/90" 
                                                        title="Exportar Excel"
                                                    >
                                                        <FileSpreadsheet size={15} />
                                                    </button>
                                                </div>

                                                {/* Título Centrado */}
                                                <h3 
                                                    id="pend-title" 
                                                    className="font-semibold tracking-tight text-lg text-neutral-900 absolute left-1/2 -translate-x-1/2"
                                                >
                                                    Pendientes
                                                </h3>

                                                {/* Botón Cerrar Derecha */}
                                                <button
                                                    aria-label="Cerrar"
                                                    onClick={() => setModalPendVisible(false)}
                                                    className="relative z-10 grid place-items-center w-8 h-8 rounded-full bg-neutral-200/80 text-neutral-600 transition-all hover:bg-neutral-300/90 hover:text-neutral-900"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>


                                            {/* Body: Reemplazamos <table> con una lista de divs */}
                                            <div className="px-3 pb-3 pt-2">
                                                <div className="w-full text-black">
                                                    
                                                    {/* Encabezado del listado (Responsivo) */}
                                                    <div className="flex w-full border-b border-neutral-300/80 px-3 py-2">
                                                        <div className="flex-1 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Nombre</div>
                                                        <div className="hidden sm:block w-32 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Teléfono</div>
                                                        <div className="hidden sm:block w-28 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Día</div>
                                                        <div className="w-[84px] sm:w-[100px] text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">Acciones</div>
                                                    </div>


                                                    {/* Contenedor de la lista con scroll */}
                                                    <div className="list-body max-h-[60vh] overflow-y-auto">
                                                        {pendLoading && (
                                                            <div className="text-center text-neutral-600 px-2 py-10">Cargando…</div>
                                                        )}

                                                        {!pendLoading && pendientesRows.length === 0 && (
                                                            <div className="text-center text-neutral-600 px-2 py-10">Sin pendientes</div>
                                                        )}

                                                        {!pendLoading &&
                                                            pendientesRows
                                                                .slice(pendPage * PEND_PAGE_SIZE, (pendPage + 1) * PEND_PAGE_SIZE)
                                                                .map((row) => (
                                                                    
                                                                    // Fila de Pendiente (Responsiva)
                                                                    <div
                                                                        key={(row.progreso_id ?? row.persona_id ?? row.id ?? Math.random().toString())}
                                                                        title="Cargar en el formulario"
                                                                        onClick={() => selectPendiente(row)}
                                                                        className="flex items-center w-full cursor-pointer transition-colors hover:bg-neutral-600/5 border-b border-neutral-200/70"
                                                                    >
                                                                        {/* Columna Principal (Contiene Nombre, Fecha y Teléfono en móvil) */}
                                                                        <div className="flex-1 px-3 py-3 truncate">
                                                                            {/* Fila 1: Nombre (Desktop) */}
                                                                            <div className="hidden sm:flex items-center justify-between">
                                                                                <span className="text-sm font-medium text-neutral-800 truncate">
                                                                                    {row.nombre ?? ""}
                                                                                </span>
                                                                            </div>

                                                                            {/* Fila 1: Nombre + Fecha (Móvil) */}
                                                                            <div className="flex sm:hidden items-center justify-between">
                                                                                <span className="text-sm font-medium text-neutral-800 truncate">
                                                                                    {row.nombre ?? ""}
                                                                                </span>
                                                                                {/* Fecha (Solo visible en móvil, al lado del nombre) */}
                                                                                <span className="text-xs text-neutral-600 ml-2 flex-shrink-0">
                                                                                    {soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? "")}
                                                                                </span>
                                                                            </div>
                                                                            
                                                                            {/* Fila 2: Teléfono (Solo visible en móvil) */}
                                                                            <div className="sm:hidden text-sm text-neutral-700 truncate mt-0.5">
                                                                                {row.telefono ?? ""}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Columna Teléfono (Solo visible en Desktop) */}
                                                                        <div className="hidden sm:block w-32 px-3 py-3 text-sm text-neutral-700 truncate">
                                                                            {row.telefono ?? ""}
                                                                        </div>

                                                                        {/* Columna Día (Solo visible en Desktop) */}
                                                                        <div className="hidden sm:block w-28 px-3 py-3 text-sm text-neutral-600 truncate">
                                                                            {soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? "")}
                                                                        </div>
                                                                        
                                                                        {/* Columna Acciones (Llamar + Eliminar) (Visible en ambos) */}
                                                                        <div className="w-[84px] sm:w-[100px] px-3 py-3 text-center flex items-center justify-end gap-1">
                                                                            <a
                                                                                href={`tel:${normalizaTelefono(row.telefono ?? '')}`}
                                                                                onClick={(e) => {
                                                                                    if (!row.telefono) e.preventDefault();
                                                                                    e.stopPropagation(); // Evita que se active el selectPendiente del div padre
                                                                                }}
                                                                                title={`Llamar a ${row.nombre ?? ''}`}
                                                                                className={`grid place-items-center w-7 h-7 rounded-full text-white transition-all hover:scale-110 shadow-sm ${
                                                                                    row.telefono ? 'bg-blue-500 hover:bg-blue-600' : 'bg-neutral-400 cursor-not-allowed'
                                                                                }`}
                                                                            >
                                                                                <Phone size={13} strokeWidth={2.5} />
                                                                            </a>
                                                                            <button
                                                                                aria-label="Eliminar pendiente"
                                                                                title="Eliminar pendiente"
                                                                                onClick={(e) => { e.stopPropagation(); handleEliminarPendiente(row); }}
                                                                                className="inline-grid place-items-center w-7 h-7 rounded-full transition-all hover:scale-105 bg-red-100/80 hover:bg-red-200/90"
                                                                            >
                                                                                <Trash2 size={15} className="text-red-600" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                    </div>
                                                </div>

                                                {/* Paginación (Estilo Cupertino) */}
                                                {!pendLoading && pendientesRows.length > PEND_PAGE_SIZE && (
                                                    <div className="mt-2 pt-3 flex items-center justify-between text-neutral-800 border-t border-neutral-300/80">
                                                        <button
                                                            onClick={() => setPendPage((p) => Math.max(0, p - 1))}
                                                            disabled={pendPage === 0}
                                                            className="px-2 py-1.5 text-sm font-medium text-blue-600 rounded-lg disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors hover:bg-neutral-100 sm:px-4"
                                                        >
                                                            Atrás
                                                        </button>
                                                        <div className="text-sm text-neutral-600">
                                                            Página {pendPage + 1} de {Math.max(1, Math.ceil(pendientesRows.length / PEND_PAGE_SIZE))}
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                setPendPage((p) =>
                                                                    Math.min(Math.ceil(pendientesRows.length / PEND_PAGE_SIZE) - 1, p + 1)
                                                                )
                                                            }
                                                            disabled={pendPage >= Math.ceil(pendientesRows.length / PEND_PAGE_SIZE) - 1}
                                                            className="px-2 py-1.5 text-sm font-medium text-blue-600 rounded-lg disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors hover:bg-neutral-100 sm:px-4"
                                                        >
                                                            Siguiente
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* ========= FIN: Modal PENDIENTES (Estilo Cupertino) ========= */}


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



