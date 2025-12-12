/*
  ARCHIVO: app/admin/components/GestionServidores.tsx
  ROL: Gestión Avanzada de Servidores (Refactorizado Deep-Dive)
  ESTADO: PRODUCTION READY - Liquid Glass System
  
  CAMBIOS RECIENTES:
  1. UI: Botones de Roles simplificados (Solo Icono + Nombre).
  2. Fix: Modal "Configuración Académica" compactado.
  3. Fix: Hidratación correcta de roles en búsqueda.
*/

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
    Server, Search, Check, UserCheck, Loader2, List, Save, Trash2, X,
    ChevronDown, AlertTriangle, Calendar, Layers, User, ShieldAlert,
    ChevronLeft, ChevronRight, Filter, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. SISTEMA DE DISEÑO (Constantes Visuales) ---
const S = {
    // Superficies
    GLASS_PANEL: "bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl rounded-3xl",
    GLASS_INPUT: "w-full bg-white/30 backdrop-blur-md border border-white/50 focus:bg-white/60 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-gray-800 placeholder-gray-500 rounded-xl px-4 py-3 transition-all duration-200 shadow-inner",
    GLASS_INPUT_COMPACT: "w-full bg-white/30 backdrop-blur-md border border-white/50 focus:bg-white/60 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-gray-800 placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 shadow-inner",
    GLASS_CARD: "bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-lg border border-white/40 shadow-lg rounded-2xl hover:shadow-xl transition-all duration-300",

    // Tipografía
    LABEL: "block text-xs font-bold text-indigo-900/60 uppercase tracking-wider mb-2 ml-1",
    TITLE: "text-lg font-bold text-gray-900 tracking-tight",
    SUBTITLE: "text-sm text-gray-500 font-medium",

    // Botones
    BTN_PRIMARY: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 justify-center disabled:opacity-70 disabled:cursor-not-allowed",
    BTN_PRIMARY_COMPACT: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-3 py-1.5 rounded-lg font-bold text-sm transition-all active:scale-95 flex items-center gap-2 justify-center disabled:opacity-70 disabled:cursor-not-allowed",
    BTN_SECONDARY: "bg-white/50 hover:bg-white/80 text-gray-700 border border-white/60 shadow-sm px-6 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 justify-center",
    BTN_SECONDARY_COMPACT: "bg-white/50 hover:bg-white/80 text-gray-700 border border-white/60 shadow-sm px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center gap-2 justify-center",
    BTN_DANGER: "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2",
    BTN_DANGER_COMPACT: "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center gap-2",

    // Estados
    ERROR_RING: "ring-2 ring-rose-500/50 border-rose-400 bg-rose-50/30",

    // Animaciones
    ANIM_MODAL: {
        hidden: { opacity: 0, scale: 0.95, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", duration: 0.4, bounce: 0.3 } },
        exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
    }
};

// --- 2. TIPOS ---
type AppEstudioDia = 'Domingo' | 'Martes' | 'Virtual';
type Errores = { nombre?: string; telefono?: string; cedula?: string; rol?: string; etapa?: string; dia?: string; semana?: string; culto?: string; };
type DiaKey = 'DOMINGO' | 'MIÉRCOLES' | 'VIERNES' | 'SÁBADO';
type CultosMap = { [key in DiaKey]: string };
type FormState = { nombre: string; telefono: string; cedula: string; rol: string; destino: string[]; cultoSeleccionado: string; observaciones: string; cultos: CultosMap; };

type ServidorRow = {
    id: string;
    cedula: string;
    nombre: string;
    telefono: string | null;
    email?: string | null;
    activo: boolean;
    servidores_roles?: { rol: string; vigente: boolean }[];
    asignaciones_contacto?: any[];
    asignaciones_maestro?: any[];
};
type ObservacionRow = { id?: string | number; texto?: string; created_at?: string; };

// --- 3. LOGICA DE NEGOCIO (Helpers) ---
const ADMIN_PASSWORD = '1061355';
const MIN_SEARCH = 2;
const defaultCultos = (): CultosMap => ({ DOMINGO: 'DOMINGO', MIÉRCOLES: 'MIÉRCOLES', VIERNES: 'VIERNES', SÁBADO: 'SÁBADO' });
const cultosOpciones: Record<DiaKey, string[]> = {
    DOMINGO: ['7:00 AM', '9:00 AM', '11:00 AM', '5:30 PM'],
    MIÉRCOLES: ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '6:30 PM'],
    VIERNES: ['9:00 AM', '5:30 PM'],
    SÁBADO: ['Ayuno Familiar', 'Jóvenes'],
};
const ROLES_DEF = [
    { id: 'Logistica', label: 'Logística', desc: 'Servicio y orden', icon: Layers, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'Contactos', label: 'Timoteos', desc: 'Seguimiento y cuidado', icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'Maestros', label: 'Coordinadores', desc: 'Enseñanza y guia', icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'Maestro Ptm', label: 'Maestro PTM', desc: 'Academia y Cursos', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'Director', label: 'Director', desc: 'Liderazgo general', icon: Server, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'Administrador', label: 'Admin', desc: 'Control total', icon: ShieldAlert, color: 'text-slate-600', bg: 'bg-slate-50' },
];

// Helpers
const trim = (s: string) => (s ?? '').trim();
const rolEs = (rol: string, base: string) => rol === base || rol === `Timoteo - ${base}`;
// Mapea un id de rol (valor guardado en BD) a la etiqueta visible en UI.
// Acepta variantes como 'Timoteo - Contactos' o 'Timoteo - Maestros'.
const roleLabelFromId = (id?: string) => {
    if (!id) return '';
    const raw = id.trim();
    // Manejar variantes que incluyan la palabra base
    if (/contactos/i.test(raw)) return 'Timoteos';
    if (/maestro|maestros/i.test(raw)) return 'Coordinadores';
    // Buscar en definiciones normales
    const found = ROLES_DEF.find(r => r.id.toLowerCase() === raw.toLowerCase());
    if (found) return found.label;
    // Si viene en formato 'Timoteo - Contactos', devolver etiqueta amigable
    const parts = raw.split('-').map(p => p.trim());
    for (const p of parts) {
        const f = ROLES_DEF.find(r => r.id.toLowerCase() === p.toLowerCase());
        if (f) return f.label;
    }
    return raw;
};
const toEtapaDetFromUi = (nivelSel: string) => {
    const m = /^(semillas|devocionales|restauracion)\s+(\d+)/i.exec(nivelSel);
    if (!m) return null;
    const base = m[1].toLowerCase();
    return base === 'restauracion' ? `Restauracion ${m[2]}` : `${base.charAt(0).toUpperCase() + base.slice(1)} ${m[2]}`;
};

// --- 4. COMPONENTE PRINCIPAL ---
export default function GestionServidores() {
    // --- ESTADOS ---
    const [form, setForm] = useState<FormState>({ nombre: '', telefono: '', cedula: '', rol: '', destino: [], cultoSeleccionado: '', observaciones: '', cultos: defaultCultos() });
    const [errores, setErrores] = useState<Errores>({});
    const [busy, setBusy] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [cedulaUnlocked, setCedulaUnlocked] = useState(true);

    // Modales
    const [modalState, setModalState] = useState<{
        contactos: boolean; timoteo: boolean; buscar: boolean; admin: boolean; listado: boolean; detalle: boolean; premium: boolean; deleteConfirm: boolean;
    }>({ contactos: false, timoteo: false, buscar: false, admin: false, listado: false, detalle: false, premium: false, deleteConfirm: false });

    // Logica Contactos/Maestros
    const [contactosSemana, setContactosSemana] = useState('Semana 1');
    const [contactosDia, setContactosDia] = useState<AppEstudioDia | ''>('');
    const [nivelSel, setNivelSel] = useState('');
    // Indica desde qué botón se abrió el modal de "contactos" (timoteos|maestros|null)
    const [contactosOpenedFrom, setContactosOpenedFrom] = useState<'timoteos' | 'maestros' | null>(null);
    // Premium toast state (non-blocking)
    const [premiumMessage, setPremiumMessage] = useState('');
    const premiumTimerRef = useRef<number | null>(null);

    // Busqueda y Listado
    const [q, setQ] = useState('');
    const [results, setResults] = useState<ServidorRow[]>([]);
    const [listData, setListData] = useState<ServidorRow[]>([]);
    const [listPage, setListPage] = useState(1);
    const [listTotal, setListTotal] = useState(0);
    const [detalleSel, setDetalleSel] = useState<ServidorRow | null>(null);
    const [obsItems, setObsItems] = useState<ObservacionRow[]>([]);
    const [adminPass, setAdminPass] = useState('');

    const inputNombreRef = useRef<HTMLInputElement>(null);

    // --- HANDLERS PRINCIPALES ---

    const toggleModal = (key: keyof typeof modalState, val: boolean) => setModalState(prev => ({ ...prev, [key]: val }));

    const resetForm = () => {
        setForm({ nombre: '', telefono: '', cedula: '', rol: '', destino: [], cultoSeleccionado: '', observaciones: '', cultos: defaultCultos() });
        setErrores({}); setEditMode(false); setCedulaUnlocked(true);
        setContactosSemana('Semana 1'); setContactosDia(''); setNivelSel('');
        setModalState({ contactos: false, timoteo: false, buscar: false, admin: false, listado: false, detalle: false, premium: false, deleteConfirm: false });
        setContactosOpenedFrom(null);
    };

    const handleGuardar = async () => {
        // Validaciones
        const newErrors: Errores = {};
        if (!form.nombre) newErrors.nombre = 'Requerido';
        if (!form.cedula) newErrors.cedula = 'Requerido';
        if (!form.rol) newErrors.rol = 'Requerido';
        if ((rolEs(form.rol, 'Contactos') || rolEs(form.rol, 'Maestros'))) {
            if (!nivelSel) newErrors.etapa = 'Requerido';
            if (!contactosDia) newErrors.dia = 'Requerido';
        }
        if (Object.keys(newErrors).length > 0) { setErrores(newErrors); return; }

        setBusy(true);
        try {
            const { data: sid, error: err1 } = await supabase.rpc('fn_upsert_servidor', {
                p_cedula: trim(form.cedula), p_nombre: trim(form.nombre), p_telefono: trim(form.telefono), p_email: null
            });
            if (err1) throw err1;

            // Limpieza de asignaciones previas
            await Promise.all([
                supabase.from('asignaciones_contacto').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('asignaciones_maestro').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('asignaciones_logistica').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('asignaciones_academia').update({ vigente: false }).eq('servidor_id', sid)
            ]);

            // Nueva Asignación
            if (rolEs(form.rol, 'Contactos')) {
                await supabase.rpc('fn_asignar_contactos', {
                    p_cedula: trim(form.cedula), p_etapa: toEtapaDetFromUi(nivelSel), p_dia: contactosDia, p_semana: parseInt(contactosSemana.replace(/\D/g, ''))
                });
            } else if (rolEs(form.rol, 'Maestros')) {
                await supabase.rpc('fn_asignar_maestro', {
                    p_cedula: trim(form.cedula), p_etapa: toEtapaDetFromUi(nivelSel), p_dia: contactosDia
                });
            } else if (rolEs(form.rol, 'Logistica')) {
                const [dia, franja] = form.cultoSeleccionado.split(' - ');
                await supabase.rpc('fn_asignar_logistica', { p_cedula: trim(form.cedula), p_dia: dia, p_franja: franja });
            }

            await supabase.from('servidores_roles').upsert({ servidor_id: sid, rol: form.rol, vigente: true }, { onConflict: 'servidor_id' });
            if (form.observaciones) await supabase.from('observaciones_servidor').insert({ servidor_id: sid, texto: form.observaciones });

            // Mostrar mensaje premium (toast) tanto en creación como en actualización. Se autohide tras 5s.
            resetForm();
            showPremium('Guardado exitosamente');
        } catch (e: any) { alert(e.message); } finally { setBusy(false); }
    };

    // La eliminación confirmada se realiza desde el modal de confirmación
    const handleEliminarConfirmed = async () => {
        if (!form.cedula) { showPremium('No hay cédula seleccionada'); setModalState(prev => ({ ...prev, deleteConfirm: false })); return; }
        setModalState(prev => ({ ...prev, deleteConfirm: false }));
        setBusy(true);
        try {
            const ced = trim(form.cedula);
            // Buscar id del servidor por cédula
            const { data: servData, error: errServ } = await supabase.from('servidores').select('id').eq('cedula', ced).single();
            if (errServ || !servData) throw errServ || new Error('Servidor no encontrado');
            const sid = (servData as any).id;

            // Desactivar asignaciones y roles vigentes
            await Promise.all([
                supabase.from('asignaciones_contacto').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('asignaciones_maestro').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('asignaciones_logistica').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('asignaciones_academia').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('servidores_roles').update({ vigente: false }).eq('servidor_id', sid),
                supabase.from('servidores').update({ activo: false }).eq('id', sid),
            ]);

            showPremium('Servidor inhabilitado correctamente');
            resetForm();
            // recargar listado si está abierto
            if (modalState.listado) cargarListado(listPage);
        } catch (e: any) {
            showPremium(e?.message || 'Error al eliminar');
        } finally { setBusy(false); }
    };

    // Muestra un toast premium no bloqueante en la parte inferior
    const showPremium = (msg = '') => {
        // limpiar timeout previo
        if (premiumTimerRef.current) { clearTimeout(premiumTimerRef.current); premiumTimerRef.current = null; }
        setPremiumMessage(msg || 'Operación realizada con éxito');
        setModalState(prev => ({ ...prev, premium: true }));
        // auto-hide
        const t = window.setTimeout(() => {
            setModalState(prev => ({ ...prev, premium: false }));
            setPremiumMessage('');
            premiumTimerRef.current = null;
        }, 5000);
        premiumTimerRef.current = t as unknown as number;
    };

    const hidePremium = () => {
        if (premiumTimerRef.current) { clearTimeout(premiumTimerRef.current); premiumTimerRef.current = null; }
        setModalState(prev => ({ ...prev, premium: false }));
        setPremiumMessage('');
    };

    // limpiar timeout al desmontar
    useEffect(() => {
        return () => { if (premiumTimerRef.current) { clearTimeout(premiumTimerRef.current); premiumTimerRef.current = null; } };
    }, []);

    const handleBuscar = async () => {
        if (q.length < MIN_SEARCH) return;

        // JOIN con servidores_roles
        const { data } = await supabase.from('servidores')
            .select(`
                id, cedula, nombre, telefono, email, activo, 
                asignaciones_contacto(vigente, etapa, dia, semana), 
                asignaciones_maestro(vigente, etapa, dia),
                servidores_roles(rol, vigente)
            `)
            .or(`nombre.ilike.%${q}%,cedula.ilike.%${q}%`)
            .limit(10);

        setResults((data as any[]) || []);
        // DEBUG: mostrar en consola los resultados de la búsqueda para inspección
        // Abre la consola del navegador (F12) y busca 'buscar resultados' cuando uses Buscar
        // Esto ayuda a verificar el valor real de `servidores_roles` y por qué no aparece 'Timoteos'.
        // Nota: elimina este log una vez depurado.
        // eslint-disable-next-line no-console
        console.log('buscar resultados:', data);
    };

    const cargarListado = async (page: number) => {
        setBusy(true);
        const from = (page - 1) * 8;
        const to = from + 7;
        // Traer también la relación `servidores_roles` para mostrar el rol en la tabla
        const { data, count } = await supabase.from('servidores')
            .select('*, servidores_roles(rol, vigente)', { count: 'exact' })
            .range(from, to)
            .order('nombre');
        setListData((data as any[]) || []);
        setListTotal(count || 0);
        setListPage(page);
        setBusy(false);
    };

    // --- RENDER UI ---
    return (
        <div className="space-y-4 animate-in fade-in duration-500">

            {/* 2. FORMULARIO PRINCIPAL (Incluye Cabezera compacta para unificación) */}
            <div className={`p-6 ${S.GLASS_PANEL} relative overflow-hidden`}>
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-300/20">
                            <Server size={20} />
                        </div>
                        <div>
                            <h2 className={S.TITLE}>Gestión de Servidores</h2>
                            <p className={S.SUBTITLE}>Administración centralizada de recursos humanos.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setQ(''); setResults([]); toggleModal('buscar', true); }} className={S.BTN_SECONDARY_COMPACT}>
                            <Search size={16} /> Buscar
                        </button>
                        <button onClick={() => { cargarListado(1); toggleModal('listado', true); }} className={S.BTN_SECONDARY_COMPACT}>
                            <List size={16} /> Listado
                        </button>
                    </div>
                </div>
                {/* Fondo Decorativo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

                <form onSubmit={e => e.preventDefault()} className="space-y-6">
                    {/* Sección Datos Personales */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <User className="text-indigo-600" size={20} />
                            <h3 className="text-lg font-bold text-gray-800">Información Personal</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <input aria-label="Nombre Completo" ref={inputNombreRef} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={`${S.GLASS_INPUT} ${errores.nombre ? S.ERROR_RING : ''}`} placeholder="Nombre completo" />
                                {errores.nombre && <span className="text-xs text-rose-500 mt-1 ml-1 font-bold">{errores.nombre}</span>}
                            </div>
                            <div>
                                <input aria-label="Teléfono / Celular" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={S.GLASS_INPUT} placeholder="Teléfono / Celular" />
                            </div>
                            <div className="relative">

                                <div className="relative">
                                    <input
                                        value={form.cedula}
                                        onChange={e => setForm({ ...form, cedula: e.target.value })}
                                        readOnly={editMode && !cedulaUnlocked}
                                        onClick={() => editMode && !cedulaUnlocked && toggleModal('admin', true)}
                                        className={`${S.GLASS_INPUT} ${editMode && !cedulaUnlocked ? 'opacity-60 cursor-not-allowed' : ''} ${errores.cedula ? S.ERROR_RING : ''}`}
                                        aria-label="Cédula de Ciudadanía"
                                        placeholder="Cédula de ciudadanía"
                                    />
                                    {editMode && !cedulaUnlocked && <span className="absolute right-4 top-3 text-gray-400"><ShieldAlert size={18} /></span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/40" />

                    {/* Sección Roles (Botones Simplificados) */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Layers className="text-indigo-600" size={20} />
                            <h3 className="text-lg font-bold text-gray-800">Asignación de Rol</h3>
                        </div>
                        {errores.rol && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold flex items-center gap-2"><AlertTriangle size={16} /> Selecciona un rol para continuar</div>}

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {ROLES_DEF.map((role) => {
                                const isSelected = rolEs(form.rol, role.id);
                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => {
                                            if (role.id === 'Timoteo') {
                                                toggleModal('timoteo', true);
                                                setContactosOpenedFrom(null);
                                            } else if (role.id === 'Contactos') {
                                                setForm(f => ({ ...f, rol: role.id }));
                                                setContactosOpenedFrom('timoteos');
                                                toggleModal('contactos', true);
                                            } else if (role.id === 'Maestros') {
                                                setForm(f => ({ ...f, rol: role.id }));
                                                setContactosOpenedFrom('maestros');
                                                toggleModal('contactos', true);
                                            } else {
                                                setForm(f => ({ ...f, rol: role.id }));
                                                setContactosOpenedFrom(null);
                                            }
                                        }}
                                        // ESTILO MODIFICADO: Flex Row para layout compacto (Icono + Nombre)
                                        className={`relative group p-3 rounded-xl border transition-all duration-300 flex items-center gap-3 ${isSelected ? `bg-white/80 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500` : 'bg-white/40 border-white/50 hover:bg-white/60 hover:border-white/80'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-700' : `${role.bg} ${role.color}`}`}>
                                            <role.icon size={18} />
                                        </div>
                                        <span className={`font-bold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{role.label}</span>

                                        {/* Indicador minimalista */}
                                        {isSelected && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Configuración Logística */}
                    <AnimatePresence>
                        {rolEs(form.rol, 'Logistica') && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="p-6 bg-orange-50/50 border border-orange-100 rounded-2xl">
                                    <h4 className="text-orange-800 font-bold mb-4 flex items-center gap-2"><Calendar size={18} /> Turnos de Servicio</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {Object.keys(cultosOpciones).map((dia) => (
                                            <div key={dia} className="space-y-2">
                                                <span className="text-xs font-bold text-orange-700/70 uppercase">{dia}</span>
                                                <div className="relative">
                                                    <select
                                                        className="w-full appearance-none bg-white border border-orange-200 text-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                        onChange={e => setForm(f => ({ ...f, cultoSeleccionado: `${dia} - ${e.target.value}` }))}
                                                    >
                                                        <option value="">Seleccionar Horario...</option>
                                                        {cultosOpciones[dia as DiaKey].map(op => <option key={op} value={op}>{op}</option>)}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-2.5 text-orange-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Observaciones */}
                    <div>
                        <label className={S.LABEL}>Notas / Observaciones</label>
                        <textarea
                            rows={2}
                            value={form.observaciones}
                            onChange={e => setForm({ ...form, observaciones: e.target.value })}
                            className={S.GLASS_INPUT_COMPACT + " resize-y max-h-[96px]"}
                            placeholder="Información adicional relevante..."
                        />
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex flex-col md:flex-row justify-end gap-3 pt-4 border-t border-white/40">
                        <button onClick={resetForm} className={S.BTN_SECONDARY_COMPACT}>Cancelar</button>
                        {editMode && (
                            <button onClick={() => setModalState(prev => ({ ...prev, deleteConfirm: true }))} className={S.BTN_DANGER_COMPACT}><Trash2 size={14} /> Eliminar</button>
                        )}
                        <button onClick={handleGuardar} disabled={busy} className={S.BTN_PRIMARY_COMPACT}>
                            {busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            {editMode ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>

            {/* --- 5. MODALES --- */}

            {/* Modal Configuración Académica (COMPACTO) */}
            <AnimatePresence>
                {modalState.contactos && (
                    <ModalBase onClose={() => toggleModal('contactos', false)} maxWidth="max-w-lg">
                        <div className="p-5">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Configuración Académica</h3>
                                    <p className="text-xs text-gray-500">Detalles del rol {rolEs(form.rol, 'Maestros') ? 'Coordinador' : 'Timoteo'}</p>
                                </div>
                                <button onClick={() => { toggleModal('contactos', false); setContactosOpenedFrom(null); }} className="p-2 hover:bg-gray-100 rounded-full"><X size={18} /></button>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[80vh] pr-1">
                                {/* Seleccion Dia */}
                                <div className="space-y-2">
                                    <label className={S.LABEL}>Día de Servicio</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Domingo', 'Martes', 'Virtual'].map(d => (
                                            <button key={d} onClick={() => setContactosDia(d as any)}
                                                className={`px-3 py-1.5 text-sm rounded-xl border font-medium transition-all ${contactosDia === d ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Seleccion Etapa (Pills Grid Compacto) */}
                                <div className="space-y-2">
                                    <label className={S.LABEL}>Nivel Asignado</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {['Semillas', 'Devocionales', 'Restauracion'].map(grupo => (
                                            <div key={grupo} className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block">{grupo}</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {[1, 2, 3, 4].map(n => {
                                                        if (grupo === 'Restauracion' && n > 1) return null;
                                                        const val = `${grupo} ${n}`;
                                                        const isSel = nivelSel === val;
                                                        return (
                                                            <button key={n} onClick={() => setNivelSel(val)}
                                                                className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${isSel ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                                                                {n}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Semana (Solo contactos) */}
                                {rolEs(form.rol, 'Contactos') && contactosOpenedFrom !== 'timoteos' && (
                                    <div className="space-y-2">
                                        <label className={S.LABEL}>Semana de Turno</label>
                                        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                                            {[1, 2, 3].map(s => (
                                                <button key={s} onClick={() => setContactosSemana(`Semana ${s}`)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${contactosSemana === `Semana ${s}` ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                                    Semana {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 mt-4 border-t flex justify-end">
                                <button onClick={() => { toggleModal('contactos', false); setContactosOpenedFrom(null); }} className={S.BTN_PRIMARY_COMPACT}>Confirmar</button>
                            </div>
                        </div>
                    </ModalBase>
                )}
            </AnimatePresence>

            {/* Modal Buscar */}
            <AnimatePresence>
                {modalState.buscar && (
                    <ModalBase onClose={() => toggleModal('buscar', false)}>
                        <div className="p-4">
                            <div className="relative mb-6">
                                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                    autoFocus
                                    value={q}
                                    onChange={e => { setQ(e.target.value); if (e.target.value.length > 1) handleBuscar(); }}
                                    placeholder="Buscar por nombre o cédula..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto space-y-2">
                                {results.length === 0 && q.length > 2 && <div className="text-center text-gray-400 py-8">No se encontraron resultados</div>}
                                {results.map(r => (
                                    <button key={r.id} onClick={() => {
                                        // LOGICA DE HIDRATACIÓN COMPLETA
                                        const rolActivo = r.servidores_roles?.find(sr => sr.vigente)?.rol || '';
                                        const datosContacto = r.asignaciones_contacto?.find(ac => ac.vigente);
                                        const datosMaestro = r.asignaciones_maestro?.find(am => am.vigente);

                                        setForm(prev => ({
                                            ...prev,
                                            nombre: r.nombre,
                                            cedula: r.cedula,
                                            telefono: r.telefono || '',
                                            rol: rolActivo
                                        }));

                                        // Hidratar estados auxiliares
                                        if (rolActivo === 'Contactos' && datosContacto) {
                                            setContactosDia(datosContacto.dia as AppEstudioDia);
                                            setContactosSemana(`Semana ${datosContacto.semana}`);
                                            setNivelSel(datosContacto.etapa);
                                        } else if (rolActivo === 'Maestros' && datosMaestro) {
                                            setContactosDia(datosMaestro.dia as AppEstudioDia);
                                            setNivelSel(datosMaestro.etapa);
                                        }

                                        setEditMode(true);
                                        setCedulaUnlocked(false);
                                        toggleModal('buscar', false);
                                    }}
                                        className="w-full text-left p-4 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100 group">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-gray-900 group-hover:text-indigo-700">{r.nombre}</span>
                                            <div className="flex items-center gap-2">
                                                {r.servidores_roles?.find(sr => sr.vigente) && (
                                                    <span
                                                        title={r.servidores_roles.find(sr => sr.vigente)?.rol || JSON.stringify(r.servidores_roles) || ''}
                                                        className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide whitespace-nowrap"
                                                    >
                                                        {roleLabelFromId(r.servidores_roles.find(sr => sr.vigente)?.rol)}
                                                    </span>
                                                )}
                                                <span className={`text-xs px-2 py-1 rounded-full ${r.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.activo ? 'Activo' : 'Inactivo'}</span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1 flex gap-3">
                                            <span className="flex items-center gap-1"><User size={12} /> {r.cedula}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ModalBase>
                )}
            </AnimatePresence>

            {/* Modal Listado General */}
            <AnimatePresence>
                {modalState.listado && (
                    <ModalBase onClose={() => toggleModal('listado', false)} maxWidth="max-w-4xl">
                        <div className="flex flex-col h-[64vh]">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900">Directorio de Servidores</h3>
                                <button onClick={() => toggleModal('listado', false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                            </div>
                            <div className="flex-1 overflow-auto bg-gray-50/50">
                                <table className="w-full">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            {['Nombre', 'Cédula', 'Teléfono', 'Rol Actual', 'Estado'].map(h => (
                                                <th key={h} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {listData.map(s => (
                                            <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900">{s.nombre}</td>
                                                <td className="px-6 py-4 text-gray-500 font-mono text-sm">{s.cedula}</td>
                                                <td className="px-6 py-4 text-gray-500">{s.telefono || '—'}</td>
                                                <td className="px-6 py-4">
                                                    <span title={s.servidores_roles?.find(sr => sr.vigente)?.rol || ''} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                        {roleLabelFromId(s.servidores_roles?.find(sr => sr.vigente)?.rol) || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{s.activo ? <span className="text-green-600 text-xs font-bold">● Activo</span> : <span className="text-red-500 text-xs">● Inactivo</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t bg-white flex justify-between items-center">
                                <span className="text-sm text-gray-500">Total: {listTotal} registros</span>
                                <div className="flex gap-2">
                                    <button onClick={() => cargarListado(Math.max(1, listPage - 1))} disabled={listPage === 1} className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                                    <span className="px-4 py-2 font-mono text-sm bg-gray-100 rounded">{listPage}</span>
                                    <button onClick={() => cargarListado(listPage + 1)} disabled={listPage * 8 >= listTotal} className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        </div>
                    </ModalBase>
                )}
            </AnimatePresence>

            {/* Modal Password Admin */}
            <AnimatePresence>
                {modalState.admin && (
                    <ModalBase onClose={() => toggleModal('admin', false)} maxWidth="max-w-sm">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldAlert size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Acceso Restringido</h3>
                            <p className="text-sm text-gray-500 mb-6">Ingresa la clave maestra para editar documentos sensibles.</p>
                            <input
                                type="password"
                                autoFocus
                                value={adminPass}
                                onChange={e => setAdminPass(e.target.value)}
                                className="w-full text-center text-2xl tracking-widest border-b-2 border-gray-300 focus:border-amber-500 focus:outline-none pb-2 mb-6 bg-transparent"
                                placeholder="••••••"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => toggleModal('admin', false)} className="flex-1 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button
                                    onClick={() => { if (adminPass === ADMIN_PASSWORD) { setCedulaUnlocked(true); toggleModal('admin', false); setAdminPass(''); } else { alert('Clave incorrecta'); } }}
                                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-lg shadow-amber-500/20"
                                >
                                    Autorizar
                                </button>
                            </div>
                        </div>
                    </ModalBase>
                )}
            </AnimatePresence>

            {/* Modal Premium de confirmación de eliminación */}
            <AnimatePresence>
                {modalState.deleteConfirm && (
                    <ModalBase onClose={() => setModalState(prev => ({ ...prev, deleteConfirm: false }))} maxWidth="max-w-md">
                        <div className="p-6 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-200 rounded-2xl">
                            <div className="text-center">
                                <div className="text-lg font-bold text-indigo-900 mb-2">¿Confirmar inhabilitación?</div>
                                <div className="text-sm text-indigo-800 mb-4">Se inhabilitarán las asignaciones y el rol del servidor seleccionado.</div>
                                <div className="text-sm text-indigo-700 font-medium mb-6">{form.nombre || form.cedula}</div>
                                <div className="flex justify-center gap-3">
                                    <button onClick={() => setModalState(prev => ({ ...prev, deleteConfirm: false }))} className={S.BTN_SECONDARY_COMPACT}>Cancelar</button>
                                    <button onClick={handleEliminarConfirmed} className={S.BTN_DANGER_COMPACT}>Confirmar</button>
                                </div>
                            </div>
                        </div>
                    </ModalBase>
                )}
            </AnimatePresence>

            {/* Premium toast (no bloqueante) */}
            <AnimatePresence>
                {modalState.premium && (
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        className="fixed bottom-6 right-6 z-[70]"
                    >
                        <div onClick={hidePremium} className="max-w-sm bg-gradient-to-r from-blue-50 via-blue-100 to-blue-200 shadow-lg rounded-2xl p-4 flex items-start gap-3 cursor-pointer">
                            <div className="w-10 h-10 bg-white/70 text-indigo-600 rounded-lg flex items-center justify-center">
                                <UserCheck size={20} />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-indigo-900">{premiumMessage || 'Operación realizada con éxito'}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}

// --- COMPONENTE BASE MODAL (Reutilizable) ---
function ModalBase({ children, onClose, maxWidth = "max-w-2xl" }: { children: React.ReactNode, onClose: () => void, maxWidth?: string }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                onClick={e => e.stopPropagation()}
                className={`w-full ${maxWidth} bg-white rounded-3xl shadow-2xl overflow-hidden`}
            >
                {children}
            </motion.div>
        </motion.div>
    );
}