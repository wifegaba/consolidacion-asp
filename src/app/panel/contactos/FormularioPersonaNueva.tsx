// File: FormularioPersonaNueva.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Trash2, Phone, FileText, FileSpreadsheet } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
// MEJORA 1: Eliminados imports estáticos pesados para Lazy Loading
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import * as XLSX from 'xlsx';

/* ========= Tipos ========= */
type AppEstudioDia = 'Domingo' | 'Martes' | 'Virtual' | 'Pendientes';
type AppEtapa = 'Semillas' | 'Devocionales' | 'Restauracion' | string;

type Registro = {
    id: string;
    fecha: string;
    nombre: string;
    telefono: string | null;
    cedula?: string | null; // Agregamos cédula
    preferencias: string | null;
    cultosSeleccionados: string | null;
    observaciones?: string | null;
    estudioDia?: string | null;
    etapa?: AppEtapa | null;
    semana?: number | null;
};

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
    culto_seleccionado?: string | null;
    creado_en?: string | null;
    created_at?: string | null;
    fecha?: string | null;
    creado_por_nombre?: string | null;
};

type Errores = { nombre?: string | null; telefono?: string | null; };
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
    DOMINGO: ['7:00 AM', '9:00 AM', '11:00 AM', '5:30 PM'],
    MIÉRCOLES: ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '6:30 PM'],
    VIERNES: ['9:AM', '6:30 PM'],
    SÁBADO: ['Ayuno Familiar', 'Jovenes'],
};

/* ========= Helpers ========= */
const toDbEstudio = (arr: string[]): AppEstudioDia =>
    arr.includes('DOMINGO') ? 'Domingo' :
        arr.includes('MARTES') ? 'Martes' :
            arr.includes('PENDIENTES') ? 'Pendientes' :
                arr.includes('VIRTUAL') ? 'Virtual' :
                    'Virtual';

const normalizaTelefono = (v: string) => (v || '').replace(/\D+/g, '');

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

const soloFecha = (v?: string | null): string => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN((d as unknown) as number)) {
        const parts = v.slice(0, 10).split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
        }
        return v.slice(0, 10);
    }
    try {
        return d.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: '2-digit'
        });
    } catch {
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

const extraerCulto = (
    cultoDirecto?: string | null,
    txtObservaciones?: string | null
): { diaKey: DiaKey | null; hora: string | null; full: string | null; clean: string } => {

    let diaKey: DiaKey | null = null;
    let hora: string | null = null;
    let full: string | null = null;
    let cleanObs: string = txtObservaciones || '';

    if (cultoDirecto) {
        const parts = cultoDirecto.split(' - ');
        if (parts.length === 2) {
            diaKey = claveDia(parts[0] || '');
            hora = (parts[1] || '').trim();
            full = cultoDirecto;
        }
    }

    if (!full && txtObservaciones) {
        const parts = txtObservaciones.split('|').map(s => s.trim()).filter(Boolean);
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
        full = diaKey && hora ? `${diaKey[0] + diaKey.slice(1).toLowerCase()} - ${hora}` : null;
        cleanObs = resto.join(' | ');
    }
    return { diaKey, hora, full, clean: cleanObs };
};

// MEJORA 2: Componente Memoizado para Filas de Pendientes (Evita re-renders masivos)
const PendienteRowItem = memo(({
    row,
    onSelect,
    onDelete
}: {
    row: PendienteItem;
    onSelect: (p: PendienteItem) => void;
    onDelete: (p: PendienteItem) => void
}) => {
    return (
        <div
            title="Cargar en el formulario"
            onClick={() => onSelect(row)}
            className="flex items-center w-full cursor-pointer transition-colors hover:bg-neutral-600/5 border-b border-neutral-200/70"
        >
            <div className="flex-1 px-3 py-3">
                <div className="hidden sm:flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-800">
                        {row.nombre ?? ""}
                    </span>
                </div>
                <div className="flex sm:hidden items-center justify-between">
                    <span className="text-sm font-medium text-neutral-800">
                        {row.nombre ?? ""}
                    </span>
                    <span className="text-xs text-neutral-600 ml-2 flex-shrink-0">
                        {soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? "")}
                    </span>
                </div>
                <div className="sm:hidden text-sm text-neutral-700 mt-0.5">
                    {row.telefono ?? ""}
                </div>
                <div className="sm:hidden text-xs text-indigo-600 mt-0.5">
                    Servidor: {row.creado_por_nombre ?? "Sistema"}
                </div>
            </div>

            <div className="hidden sm:block px-4 py-3 text-sm text-neutral-700 text-center">
                {row.telefono ?? ""}
            </div>
            <div className="hidden sm:block px-4 py-3 text-sm text-neutral-600 text-center">
                {soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? "")}
            </div>
            <div className="hidden sm:block px-4 py-3 text-sm text-neutral-700 text-center" title={row.creado_por_nombre ?? ''}>
                {row.creado_por_nombre ?? "Sistema"}
            </div>
            <div className="px-4 py-3 text-center flex items-center justify-end gap-1">
                <a
                    href={`tel:${normalizaTelefono(row.telefono ?? '')}`}
                    onClick={(e) => {
                        if (!row.telefono) e.preventDefault();
                        e.stopPropagation();
                    }}
                    title={`Llamar a ${row.nombre ?? ''}`}
                    className={`grid place-items-center w-7 h-7 rounded-full text-white transition-all hover:scale-110 shadow-sm ${row.telefono ? 'bg-blue-500 hover:bg-blue-600' : 'bg-neutral-400 cursor-not-allowed'
                        }`}
                >
                    <Phone size={13} strokeWidth={2.5} />
                </a>
                <button
                    aria-label="Eliminar pendiente"
                    title="Eliminar pendiente"
                    onClick={(e) => { e.stopPropagation(); onDelete(row); }}
                    className="inline-grid place-items-center w-7 h-7 rounded-full transition-all hover:scale-105 bg-red-100/80 hover:bg-red-200/90"
                >
                    <Trash2 size={15} className="text-red-600" />
                </button>
            </div>
        </div>
    );
});
PendienteRowItem.displayName = 'PendienteRowItem';

// MEJORA 3: Componente Memoizado para Resultados de Búsqueda
const SearchResultItem = memo(({
    p,
    isActive,
    onSelect,
    onHover
}: {
    p: Registro;
    isActive: boolean;
    onSelect: (p: Registro) => void;
    onHover: () => void
}) => {
    return (
        <button
            id={`optm-${p.id}`}
            role="option"
            aria-selected={isActive}
            onMouseEnter={onHover}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onSelect(p)}
            className={`sug-item ${isActive ? 'active' : ''}`}
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
    );
});
SearchResultItem.displayName = 'SearchResultItem';


export default function PersonaNueva({ servidorId }: { servidorId: string | null }) {
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

    const [modalBuscarVisible, setModalBuscarVisible] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [sugs, setSugs] = useState<Registro[]>([]);
    const [openSugs, setOpenSugs] = useState(false);
    const [active, setActive] = useState(0);
    const [loadingSug, setLoadingSug] = useState(false);
    const [modoSoloPendientes, setModoSoloPendientes] = useState(false);

    const [modalPendVisible, setModalPendVisible] = useState(false);
    const [pendLoading, setPendLoading] = useState(false);
    const [pendientesRows, setPendientesRows] = useState<PendienteItem[]>([]);
    const [pendPage, setPendPage] = useState(0);
    const PEND_PAGE_SIZE = 7;

    const [modoListado, setModoListado] = useState(false);
    const [listadoPersonas, setListadoPersonas] = useState<Registro[]>([]);
    const [listadoPage, setListadoPage] = useState(0);
    const [totalPersonas, setTotalPersonas] = useState(0);
    const [listadoLoading, setListadoLoading] = useState(false);
    const LISTADO_PAGE_SIZE = 10;

    const cacheSugs = useRef(new Map<string, { ts: number; data: Registro[] }>()).current;
    const TTL_MS = 60_000, MIN_CHARS = 3, DEBOUNCE_MS = 350;

    useEffect(() => { if (modalBuscarVisible) setTimeout(() => inputBusquedaModalRef.current?.focus(), 0); }, [modalBuscarVisible]);

    const toast = useCallback((msg: string) => {
        const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    }, []);

    const ensurePremiumToastStyles = useCallback(() => {
        if (document.getElementById('premium-toast-styles')) return;
        const s = document.createElement('style');
        s.id = 'premium-toast-styles';
        s.textContent = `
            .premium-toast-wrap {
                position: fixed; right: 20px; bottom: 26px; z-index: 99999;
                backdrop-filter: blur(8px) saturate(120%); -webkit-backdrop-filter: blur(8px) saturate(120%);
                transition: transform .32s cubic-bezier(.22,.9,.3,1), opacity .28s ease;
                transform-origin: bottom right; opacity: 0; transform: translateY(18px) scale(.98); pointer-events: none;
            }
            .premium-toast-wrap.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
            .premium-toast-card {
                display: flex; align-items: center; gap: 12px; min-width: 320px; max-width: 420px; padding: 12px 14px;
                border-radius: 14px; box-shadow: 0 10px 32px rgba(20,20,40,0.08), inset 0 1px 0 rgba(255,255,255,0.6);
                background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(245,246,250,0.86));
                border: 1px solid rgba(60,60,90,0.06); font-family: Inter, system-ui, sans-serif;
            }
            .premium-toast-card.ok { border-color: rgba(16,185,129,0.12); }
            .premium-toast-card.err { border-color: rgba(239,68,68,0.12); }
            .premium-toast-icon {
                flex: 0 0 44px; height: 44px; border-radius: 10px; display: grid; place-items: center;
                font-weight: 700; font-size: 18px; color: white;
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
    }, []);

    const showPremiumToast = useCallback((success: boolean, tipo: 'PDF' | 'Excel') => {
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

        requestAnimationFrame(() => wrap.classList.add('visible'));
        setTimeout(() => {
            wrap.classList.remove('visible');
            setTimeout(() => wrap.remove(), 340);
        }, 4200);
    }, [ensurePremiumToastStyles]);

    // Funciones encapsuladas con useCallback para uso en Memo
    const selectPersona = useCallback((p: Registro, fromPendientes: boolean = false, cultoDirecto?: string | null) => {
        const culto = extraerCulto(cultoDirecto, p.observaciones);
        let cultosMap: CultosMap = defaultCultos();
        let cultoSeleccionado = '';
        let cultoFueCargado = false;

        if (culto.diaKey && culto.hora) {
            const key = culto.diaKey as DiaKey;
            const diaBonito = key[0] + key.slice(1).toLowerCase();
            cultosMap = { ...defaultCultos(), [key]: culto.hora! };
            cultoSeleccionado = `${diaBonito} - ${culto.hora}`;
            cultoFueCargado = true;
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

        setModoEdicion(!fromPendientes);
        setIndiceEdicion(fromPendientes ? null : p.id);
        setBloquearCultos(cultoFueCargado);

        setBusqueda(''); setSugs([]); setOpenSugs(false); setModoSoloPendientes(false); setModalBuscarVisible(false);
        setTimeout(() => observacionesRef.current?.focus(), 0);
    }, []);

    const selectPendiente = useCallback((p: PendienteItem) => {
        const culto = extraerCulto(p.culto_seleccionado, p.observaciones);
        let cultosMap: CultosMap = defaultCultos();
        let cultoSeleccionado = '';
        let cultoFueCargado = false;

        if (culto.diaKey && culto.hora) {
            const key = culto.diaKey as DiaKey;
            const diaBonito = key[0] + key.slice(1).toLowerCase();
            cultosMap = { ...defaultCultos(), [key]: culto.hora! };
            cultoSeleccionado = `${diaBonito} - ${culto.hora}`;
            cultoFueCargado = true;
        }

        setForm(f => ({
            ...f,
            nombre: p?.nombre || '',
            telefono: p?.telefono || '',
            observaciones: culto.clean || '',
            destino: [],
            cultos: cultosMap,
            cultoSeleccionado,
            pendienteId: (p?.id ?? p?.progreso_id ?? p?.persona_id ?? null) || null,
        }));

        setModoEdicion(false);
        setIndiceEdicion(null);
        setBloquearCultos(cultoFueCargado);

        setModalPendVisible(false);
        setModalBuscarVisible(false);
        setModoSoloPendientes(false);
        setBusqueda('');
        setSugs([]);
        setOpenSugs(false);
        setTimeout(() => observacionesRef.current?.focus(), 0);
    }, []);

    const handleEliminarPendiente = useCallback(async (row: PendienteItem) => {
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
    }, [toast]);

    // Funciones de formulario principales
    const selectDesdePendiente = (row: PendienteItem) => {
        const reg: Registro = {
            id: row.persona_id || '',
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
        selectPersona(reg, true, row.culto_seleccionado);
        setForm(prev => ({ ...prev, pendienteId: row.id }));
    };

    const validar = (): boolean => {
        const err: Errores = {};
        if (!form.nombre.trim()) { err.nombre = 'Ingresa el Nombre y Apellido'; setErrores(err); return false; }
        if (!/\d{7,}/.test(form.telefono)) { err.telefono = 'Número inválido o incompleto'; setErrores(err); return false; }
        if (!form.cultoSeleccionado) { setMostrarErrorCulto(true); return false; }
        if (form.destino.length === 0) { setMostrarErrorDestino(true); return false; }
        setErrores({}); setMostrarErrorCulto(false); setMostrarErrorDestino(false); return true;
    };

    const construirNotasNormales = () => {
        const [dia, hora] = form.cultoSeleccionado.split(' - ');
        const cultoLinea = dia && hora ? `Culto de ingreso: ${dia} - ${hora}` : null;
        const extra = (form.observaciones || '').trim();
        return [cultoLinea, extra].filter(Boolean).join(' | ') || null;
    };

    const resetForm = () => {
        setForm({ nombre: '', telefono: '', destino: [], cultoSeleccionado: '', observaciones: '', cultos: defaultCultos(), pendienteId: null });
        setErrores({}); setMostrarErrorCulto(false); setMostrarErrorDestino(false);
        setBloquearCultos(false); setModoEdicion(false); setIndiceEdicion(null);
    };

    const handleGuardar = async () => {
        if (!validar()) return;
        const p_estudio: AppEstudioDia = toDbEstudio(form.destino);
        try {
            if (form.pendienteId) {
                const p_notas_registro_normal = construirNotasNormales();
                const { error } = await supabase.rpc('fn_registrar_persona', {
                    p_nombre: form.nombre.trim(),
                    p_telefono: form.telefono.trim(),
                    p_culto: toDbEstudio(form.destino),
                    p_estudio: toDbEstudio(form.destino),
                    p_notas: p_notas_registro_normal,
                });
                if (error) throw error;
                const { error: delError } = await supabase.from('pendientes').delete().eq('id', form.pendienteId);
                if (delError) {
                    console.error(delError);
                    toast('Guardado, pero no se pudo eliminar de pendientes');
                } else {
                    toast('Persona registrada y eliminada de Pendientes');
                }
                setForm(prev => ({ ...prev, pendienteId: null }));
                if (modalPendVisible) {
                    try {
                        const { data } = await supabase.rpc('fn_listar_pendientes');
                        setPendientesRows((data || []) as PendienteItem[]);
                    } catch { }
                }
                resetForm();
                return;
            }

            if (form.destino.includes('PENDIENTES')) {
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
                if (!servidorId) {
                    toast('❌ Error: No se pudo identificar al servidor.');
                    return;
                }
                try {
                    const { error } = await supabase.rpc('fn_registrar_pendiente', {
                        p_nombre: form.nombre.trim(),
                        p_telefono: telNorm,
                        p_destino: 'Pendientes',
                        p_culto: form.cultoSeleccionado || null,
                        p_observaciones: (form.observaciones || '').trim() || null,
                        p_creado_por: servidorId
                    });
                    if (error) throw error;
                    toast('Registro guardado en Pendientes');
                    if (modalPendVisible) {
                        try {
                            const { data } = await supabase.rpc('fn_listar_pendientes');
                            setPendientesRows((data || []) as PendienteItem[]);
                        } catch (e) { }
                    }
                    resetForm();
                    return;
                } catch (e: any) {
                    toast('❌ Error guardando pendiente: ' + (e?.message ?? e));
                    return;
                }
            }

            if (form.destino.some(d => ['DOMINGO', 'MARTES', 'VIRTUAL'].includes(d))) {
                const telNorm = normalizaTelefono(form.telefono);
                const { count, error } = await supabase.from('persona').select('id', { count: 'exact' }).eq('telefono', telNorm).limit(1);
                if (error) throw error;
                let isDup = false;
                if (count && count > 0) {
                    if (modoEdicion && indiceEdicion) {
                        const { data: personaData } = await supabase.from('persona').select('id').eq('telefono', telNorm).limit(1);
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

            const p_notas_normal = construirNotasNormales();
            if (modoEdicion && indiceEdicion) {
                const { error } = await supabase.rpc('fn_actualizar_persona', {
                    p_id: indiceEdicion,
                    p_nombre: form.nombre.trim(),
                    p_telefono: form.telefono.trim(),
                    p_estudio,
                    p_notas: p_notas_normal,
                });
                if (error) throw error;
                toast('✅ Registro actualizado');
            } else {
                const { error } = await supabase.rpc('fn_registrar_persona', {
                    p_nombre: form.nombre.trim(),
                    p_telefono: form.telefono.trim(),
                    p_culto: p_estudio,
                    p_estudio,
                    p_notas: p_notas_normal,
                });
                if (error) throw error;
                toast('✅ Guardado. Enviado a Semillas 1 • Semana 1');
            }
            resetForm();
        } catch (e: any) {
            console.error(e);
            if (e?.code === '23505' || e?.message?.includes('duplicate key') || e?.details?.includes('already exists')) {
                toast('⚠️ Error: Este teléfono ya está registrado (puede estar en lista de eliminados/inactivos).');
            } else {
                toast('❌ Error al guardar/actualizar: ' + (e?.message || 'Error desconocido'));
            }
        } finally {
            // Limpiar caché de búsqueda para que se reflejen los cambios inmediatamente
            cacheSugs.clear();
        }
    };

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
                fecha: '',
                preferencias: null,
                cultosSeleccionados: null,
            }));
            setListadoPersonas(arr);
            setTotalPersonas(arr.length);
        } catch (e) {
            toast('❌ Error al cargar el listado');
        } finally {
            setListadoLoading(false);
        }
    };

    useEffect(() => {
        if (modoSoloPendientes) return;
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
                const { data, error } = await supabase.rpc('fn_buscar_persona', { q });
                if (error) throw error;
                let arr: Registro[] = (data || []).map((r: any) => ({
                    id: r.id,
                    fecha: '',
                    nombre: r.nombre,
                    telefono: r.telefono || null,
                    cedula: r.cedula || null, // Agregamos cédula
                    preferencias: null,
                    cultosSeleccionados: null,
                    observaciones: r.observaciones || null,
                    estudioDia: r.estudio_dia || null,
                    etapa: (r.etapa as AppEtapa) || null,
                    semana: (typeof r.semana === 'number' ? r.semana : null),
                }));
                // Helper para normalizar teléfonos (eliminar espacios, guiones, paréntesis y prefijos de país)
                const normalizePhone = (phone: string | null): string | null => {
                    if (!phone) return null;
                    const digits = phone.replace(/\D/g, ''); // Solo dígitos
                    // Si tiene más de 10 dígitos (ej: 573001234567), tomamos los últimos 10
                    return digits.length > 10 ? digits.slice(-10) : digits;
                };

                const needStatus = arr.some(x => !x.etapa || x.semana == null);
                if (needStatus) {
                    const ids = arr.map(x => x.id).filter(Boolean);
                    if (ids.length > 0) {
                        const cedulas = arr.map(x => x.cedula).filter(Boolean) as string[];
                        const phones = arr.map(x => x.telefono).filter(Boolean) as string[];

                        // Crear lista de teléfonos normalizados + originales para búsqueda amplia
                        const phonesNormalized = phones.map(p => normalizePhone(p)).filter(Boolean) as string[];
                        const allPhones = [...new Set([...phones, ...phonesNormalized])];

                        // Hacer consultas por separado para evitar errores de sintaxis SQL
                        const [resProgreso, resEntrevistasByCedula, resEntrevistasByPhone] = await Promise.all([
                            supabase
                                .from('progreso')
                                .select('persona_id, etapa, semana, creado_en')
                                .in('persona_id', ids)
                                .order('creado_en', { ascending: false }),
                            // Buscar por CÉDULA
                            cedulas.length > 0
                                ? supabase.from('entrevistas').select('id, cedula, telefono').in('cedula', cedulas)
                                : Promise.resolve({ data: [] }),
                            // Buscar por TELÉFONO
                            allPhones.length > 0
                                ? supabase.from('entrevistas').select('id, cedula, telefono').in('telefono', allPhones)
                                : Promise.resolve({ data: [] })
                        ]);

                        // Combinar resultados de entrevistas (cedula + phone)
                        const entrevistasMap = new Map();
                        const resEntrevistas = { data: [] as any[] };

                        if (resEntrevistasByCedula.data) {
                            resEntrevistasByCedula.data.forEach((e: any) => {
                                if (!entrevistasMap.has(e.id)) {
                                    entrevistasMap.set(e.id, e);
                                    resEntrevistas.data.push(e);
                                }
                            });
                        }

                        if (resEntrevistasByPhone.data) {
                            resEntrevistasByPhone.data.forEach((e: any) => {
                                if (!entrevistasMap.has(e.id)) {
                                    entrevistasMap.set(e.id, e);
                                    resEntrevistas.data.push(e);
                                }
                            });
                        }

                        const map = new Map<string, { etapa: string | null; semana: number | null; inscripcion_id?: number }>();
                        const cedulaToEntrevistaId = new Map<string, string>();
                        const phoneToEntrevistaId = new Map<string, string>();

                        console.log('🔍 DEBUG - Cédulas buscadas:', cedulas);
                        console.log('🔍 DEBUG - Phones buscados:', { original: phones, normalized: phonesNormalized, all: allPhones });
                        console.log('🔍 DEBUG - Entrevistas encontradas:', resEntrevistas.data?.length || 0);

                        // Crear mapas por cédula Y por teléfono
                        if (resEntrevistas.data) {
                            resEntrevistas.data.forEach((e: any) => {
                                // Mapear por cédula (prioridad 1)
                                if (e.cedula) {
                                    cedulaToEntrevistaId.set(e.cedula, e.id);
                                    console.log(`🆔 Mapeando por cédula: ${e.cedula} -> ID: ${e.id}`);
                                }
                                // Mapear por teléfono (fallback)
                                const normPhone = normalizePhone(e.telefono);
                                if (normPhone) {
                                    phoneToEntrevistaId.set(normPhone, e.id);
                                    console.log(`📞 Mapeando por teléfono: ${e.telefono} -> ${normPhone} -> ID: ${e.id}`);
                                }
                            });
                        }

                        console.log('🗺️ DEBUG - cedulaToEntrevistaId Map size:', cedulaToEntrevistaId.size);
                        console.log('🗺️ DEBUG - phoneToEntrevistaId Map size:', phoneToEntrevistaId.size);

                        const entrevistaIds = [...new Set([...Array.from(cedulaToEntrevistaId.values()), ...Array.from(phoneToEntrevistaId.values())])];
                        console.log('🎯 DEBUG - entrevistaIds (combinados):', entrevistaIds);

                        // 1. Llenar con Progreso (base usando persona_id) - Lógica mejorada para buscar última etapa conocida
                        if (!resProgreso.error && resProgreso.data) {
                            for (const row of resProgreso.data as any[]) {
                                const current = map.get(row.persona_id);
                                if (!current) {
                                    // Primer registro encontrado (el más reciente)
                                    map.set(row.persona_id, { etapa: row.etapa ?? null, semana: row.semana ?? null });
                                } else {
                                    // Si ya tenemos un registro pero le falta información (etapa o semana son null),
                                    // y este registro histórico SÍ tiene el dato, lo usamos (backfilling).
                                    const improvedEtapa = current.etapa || row.etapa;
                                    const improvedSemana = current.semana ?? row.semana; // Nullish coalescing para respetar semana 0

                                    if (improvedEtapa !== current.etapa || improvedSemana !== current.semana) {
                                        map.set(row.persona_id, { etapa: improvedEtapa, semana: improvedSemana });
                                        console.log(`✨ Recuperada etapa/semana histórica para ${row.persona_id}:`, { from: current, to: { etapa: improvedEtapa, semana: improvedSemana } });
                                    }
                                }
                            }
                        }

                        // 2. Buscar Inscripciones usando ENTREVISTA ID (no persona_id)
                        const inscripcionesIds: number[] = [];
                        const entrevistaToInscripcion = new Map<string, { etapa: string; inscripcion_id: number, created_at: string }>();

                        if (entrevistaIds.length > 0) {
                            console.log('🔎 Buscando inscripciones para:', entrevistaIds);
                            const { data: resInscripciones } = await supabase
                                .from('inscripciones')
                                .select('id, entrevista_id, curso:cursos(nombre), created_at')
                                .in('entrevista_id', entrevistaIds)
                                .order('created_at', { ascending: false });

                            console.log('📚 Inscripciones encontradas:', resInscripciones?.length || 0);

                            if (resInscripciones) {
                                for (const row of resInscripciones) {
                                    const cursoNombre = Array.isArray(row.curso) ? row.curso[0]?.nombre : (row.curso as any)?.nombre;
                                    if (cursoNombre && !entrevistaToInscripcion.has(row.entrevista_id)) {
                                        entrevistaToInscripcion.set(row.entrevista_id, {
                                            etapa: cursoNombre,
                                            inscripcion_id: row.id,
                                            created_at: row.created_at
                                        });
                                        inscripcionesIds.push(row.id);
                                        console.log(`🎓 Inscripción: Entrevista ${row.entrevista_id} -> Curso: ${cursoNombre} (ID: ${row.id})`);
                                    }
                                }
                            }
                        }

                        // 3. Buscar asistencias para calcular Semana (Academia)
                        const inscripcionToSemana = new Map<number, number>();
                        if (inscripcionesIds.length > 0) {
                            const { data: resAsistencias } = await supabase
                                .from('asistencias_academia')
                                .select('inscripcion_id, asistencias')
                                .in('inscripcion_id', inscripcionesIds);

                            console.log('📊 Asistencias encontradas:', resAsistencias?.length || 0);

                            if (resAsistencias) {
                                resAsistencias.forEach((r: any) => {
                                    let count = 0;
                                    const grades = r.asistencias?.['1'] || {};
                                    Object.values(grades).forEach(v => { if (v === 'si') count++; });
                                    inscripcionToSemana.set(r.inscripcion_id, count);
                                    console.log(`📈 Asistencia inscripción ${r.inscripcion_id}: ${count} clases`);
                                });
                            }
                        }

                        // 4. Fusionar datos
                        arr = arr.map(p => {
                            // Datos de progreso directo (Persona)
                            let info = map.get(p.id) || { etapa: p.etapa, semana: p.semana };

                            // Intentar enriquecer con Academia (vía cédula primero, teléfono como fallback)
                            let entId: string | null = null;

                            // Prioridad 1: Buscar por cédula
                            if (p.cedula) {
                                entId = cedulaToEntrevistaId.get(p.cedula) || null;
                                console.log(`🔄 Procesando ${p.nombre} - Cédula: ${p.cedula} -> Entrevista ID: ${entId || 'NO ENCONTRADO'}`);
                            }

                            // Prioridad 2: Si no se encontró por cédula, intentar por teléfono
                            if (!entId && p.telefono) {
                                const normPhone = normalizePhone(p.telefono) ?? null;
                                entId = normPhone ? phoneToEntrevistaId.get(normPhone) ?? null : null;
                                console.log(`🔄 Intentando por teléfono ${p.nombre} - Tel: ${p.telefono} -> Normalizado: ${normPhone} -> Entrevista ID: ${entId || 'NO ENCONTRADO'}`);
                            }

                            if (entId) {
                                const insc = entrevistaToInscripcion.get(entId);
                                console.log(`  ➡️ Inscripción encontrada:`, insc || 'NINGUNA');
                                if (insc) {
                                    const semanaCalc = inscripcionToSemana.get(insc.inscripcion_id) ?? 0;
                                    // Priorizar info de academia si existe
                                    info = {
                                        etapa: insc.etapa,
                                        semana: Math.max(semanaCalc, 1) // Mostrar al menos semana 1 si está matriculado
                                    };
                                    console.log(`  ✅ ASIGNADO - Etapa: ${info.etapa}, Semana: ${info.semana}`);
                                }
                            } else {
                                console.log(`  ❌ NO se encontró entrevista para este teléfono`);
                            }

                            return { ...p, etapa: info.etapa || null, semana: info.semana ?? null };
                        });
                    }
                }
                if (!cancel) {
                    cacheSugs.set(q, { ts: Date.now(), data: arr });
                    setSugs(arr); setOpenSugs(arr.length > 0); setActive(0);
                }
            } catch (e) {
                if (!cancel) { setSugs([]); setOpenSugs(false); }
            } finally {
                if (!cancel) setLoadingSug(false);
            }
        }, DEBOUNCE_MS);
        return () => { cancel = true; clearTimeout(t); };
    }, [busqueda, modoSoloPendientes, cacheSugs]);

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

    const abrirPendientes = async () => {
        setModalPendVisible(true);
        setPendLoading(true);
        try {
            const { data, error } = await supabase.rpc('fn_listar_pendientes');
            if (error) throw error;
            setPendientesRows((data || []) as PendienteItem[]);
            setPendPage(0);
        } catch (e) {
            toast('Error cargando pendientes');
        } finally {
            setPendLoading(false);
        }
    };

    const ghost = openSugs && sugs[0] && (sugs[0].nombre ?? '').toLowerCase().startsWith(busqueda.toLowerCase())
        ? (sugs[0].nombre ?? '').slice(busqueda.length)
        : '';

    // MEJORA 1: Lazy Loading en exports
    const handleExportPDF = async () => {
        if (!pendientesRows.length) { toast('No hay datos para exportar'); return; }
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;
            const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text(`Listado de Contactos pendientes del Mes ${mesActual.charAt(0).toUpperCase() + mesActual.slice(1)}`, 14, 20);

            const headers = [["Nombre", "Teléfono", "Fecha", "Culto de Ingreso"]];
            const body = pendientesRows.map(row => {
                const culto = extraerCulto(row.culto_seleccionado, row.observaciones);
                return [
                    row.nombre || '',
                    row.telefono || '',
                    soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? ""),
                    culto.full || 'N/A'
                ];
            });
            autoTable(doc, {
                startY: 28,
                head: headers,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] }
            });
            doc.save(`pendientes_${mesActual}.pdf`);
            showPremiumToast(true, 'PDF');
        } catch (err) {
            console.error('Error exportando PDF:', err);
            showPremiumToast(false, 'PDF');
        }
    };

    const handleExportExcel = async () => {
        if (!pendientesRows.length) { toast('No hay datos para exportar'); return; }
        try {
            const XLSX = await import('xlsx');
            const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });
            const title = [`Listado de Contactos pendientes del Mes ${mesActual.charAt(0).toUpperCase() + mesActual.slice(1)}`];
            const headers = ["Nombre", "Teléfono", "Fecha", "Culto de Ingreso"];
            const data = pendientesRows.map(row => {
                const culto = extraerCulto(row.culto_seleccionado, row.observaciones);
                return [
                    row.nombre || '',
                    row.telefono || '',
                    soloFecha(row.creado_en ?? row.created_at ?? row.fecha ?? ""),
                    culto.full || 'N/A'
                ];
            });
            const allRows = [title, [], headers, ...data];
            const ws = XLSX.utils.aoa_to_sheet(allRows);
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Pendientes ${mesActual}`);
            XLSX.writeFile(wb, `pendientes_${mesActual}.xlsx`);
            showPremiumToast(true, 'Excel');
        } catch (err) {
            console.error('Error exportando Excel:', err);
            showPremiumToast(false, 'Excel');
        }
    };

    return (
        <div className="pn-root">
            <div className="formulario-box" id="formulario1">
                <div className="form-title" style={{ marginBottom: '6px', fontSize: '1.08rem' }}>Registro Persona Nueva</div>

                {modalBuscarVisible && (
                    <div className="modal-buscar2-backdrop fixed inset-0 z-40 bg-[rgba(80,70,229,0.10)] backdrop-blur-md" style={{ overflow: 'hidden' }}></div>
                )}
                {modalBuscarVisible && (
                    <div className="modal-buscar2 fixed top-0 left-0 right-0 z-50 flex items-start justify-center pt-6" role="dialog" aria-modal="true">
                        <div className="modal-buscar2__box sm:max-w-[540px] max-w-[90vw] w-full mx-auto" style={{ width: '100%', maxWidth: '90vw', boxSizing: 'border-box', background: 'linear-gradient(135deg, #e0e7ff 0%, #f3f4f6 60%, #c7d2fe 100%)', boxShadow: '0 8px 32px rgba(80,70,229,0.18)', borderRadius: '22px', border: '1.5px solid #e0e7ff' }}>
                            <button
                                className="modal-buscar2__close"
                                aria-label="Cerrar"
                                style={{ transition: 'background 0.18s, color 0.18s', position: 'absolute', top: 12, right: 12, zIndex: 100, width: 40, height: 40, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', border: 'none', background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', cursor: 'pointer' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#ff4d4f'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.color = ''; }}
                                onClick={() => {
                                    setBusqueda(''); setSugs([]); setOpenSugs(false); setModalBuscarVisible(false); setModoSoloPendientes(false); setModoListado(false); setListadoPage(0);
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
                                            {/* MEJORA 3: Uso de componente memoizado para items de búsqueda */}
                                            {sugs.map((p, i) => (
                                                <SearchResultItem
                                                    key={p.id}
                                                    p={p}
                                                    isActive={i === active}
                                                    onSelect={selectPersona}
                                                    onHover={() => setActive(i)}
                                                />
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

                <div className="form-row first-row" style={{ marginBottom: '4px' }}>
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

                <div className="cultos-row" style={{ marginBottom: '4px' }}>
                    <label className="Label-Culto">Culto:</label>
                    {Object.entries(form.cultos).map(([dia, valorActual]) => (
                        <div key={dia} className={`culto-box ${bloquearCultos && !valorActual.includes(dia) ? 'disabled' : ''}`}>
                            {valorActual}
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
                <div style={{ textAlign: 'left', margin: '18px 0 18px 0' }}>
                    <label className="Label-Culto" style={{ fontSize: '1.1rem', display: 'block', marginBottom: '14px' }}>
                        Proceso Transformacional:
                    </label>
                </div>

                {mostrarErrorCulto && (
                    <div className="error-msg" style={{ textAlign: 'center', marginBottom: '1rem', color: 'white' }}>
                        ¡Escoge por favor un horario del Culto!
                    </div>
                )}

                <div className="form-group destinos-row" style={{ marginBottom: '4px', marginTop: '12px' }}>
                    <div className="switch-group" style={{ marginBottom: '24px' }}>
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
                            style={{ minHeight: '48px', maxHeight: '72px', height: '48px', resize: 'vertical', fontSize: '1rem', padding: '4px 8px', marginBottom: '10px' }}
                        />
                    </div>
                </div>

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
                            className="w-auto max-w-[90vw] lg:max-w-5xl rounded-[20px] overflow-hidden border border-neutral-200/50 shadow-2xl bg-white/90 backdrop-blur-xl"
                        >
                            <div className="sticky top-0 flex items-center justify-between py-3.5 px-5 bg-white/70 backdrop-blur-sm border-b border-neutral-300/80">
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

                                <h3 id="pend-title" className="font-semibold tracking-tight text-lg text-neutral-900 absolute left-1/2 -translate-x-1/2">
                                    Pendientes
                                </h3>

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

                            <div className="px-3 pb-3 pt-2">
                                <div className="w-full text-black">
                                    <div className="flex w-full border-b border-neutral-300/80 px-3 py-2 bg-neutral-100/70">
                                        <div className="flex-1 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Nombre</div>
                                        <div className="hidden sm:block px-4 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">Teléfono</div>
                                        <div className="hidden sm:block px-4 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">Día</div>
                                        <div className="hidden sm:block px-4 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">Creado por</div>
                                        <div className="px-4 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">Acciones</div>
                                    </div>

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
                                                    /* MEJORA 2: Uso de componente memoizado */
                                                    <PendienteRowItem
                                                        key={(row.progreso_id ?? row.persona_id ?? row.id ?? Math.random().toString())}
                                                        row={row}
                                                        onSelect={selectPendiente}
                                                        onDelete={handleEliminarPendiente}
                                                    />
                                                ))}
                                    </div>
                                </div>

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

                <div className="btn-container" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
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

                    <button
                        className="btn-minimal"
                        onClick={abrirPendientes}
                        title="Ver registros pendientes"
                    >
                        Pendientes
                    </button>

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