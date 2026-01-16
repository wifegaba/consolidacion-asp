'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { GlassCard, CardHeader, FormSelect, GLASS_STYLES, ModalTemplate } from '../page';
import { UserPlus, Search, Plus, ChevronDown, X, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import type { MaestroConCursos, Curso, Estudiante, Inscripcion } from '../page';

// Animaciones premium para la lista de estudiantes
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const LIST_WRAPPER_VARIANTS: Variants = {
    hidden: {
        transition: { staggerChildren: 0.035, staggerDirection: -1 }
    },
    visible: {
        transition: { delayChildren: 0.12, staggerChildren: 0.055 }
    }
};

const LIST_ITEM_VARIANTS: Variants = {
    hidden: { opacity: 0, x: 28, y: 14, scale: 0.97 },
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: { duration: 0.5, ease: EASE_SMOOTH }
    }
};

interface PanelMatricularProps {
    maestros: MaestroConCursos[];
    cursos: Curso[];
    estudiantes: Estudiante[];
    inscripciones: Inscripcion[];
    onMatriculaExitosa: () => void;
    loading: boolean;
}

export default function PanelMatricular({ maestros, cursos, estudiantes, inscripciones, onMatriculaExitosa, loading }: PanelMatricularProps) {
    const [cursoId, setCursoId] = useState('');
    const [maestroId, setMaestroId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [alertData, setAlertData] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'info' | 'success' | 'warning' } | null>(null);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);

    // No longer auto-select a default course, course will be set when student is selected
    useEffect(() => {
        // If no students selected yet and cursoId is empty, default to Restauración 1
        if (Object.keys(selectedIds).length === 0 && !cursoId && cursos.length > 0) {
            const c = cursos.find(c => c.nombre === 'Restauración 1');
            if (c) setCursoId(String(c.id));
        }
    }, [cursos, cursoId, selectedIds]);

    const mDisponibles = useMemo(() => !cursoId ? [] : maestros.filter(m => m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === parseInt(cursoId))), [cursoId, maestros]);

    // Enhanced student data with suspension info
    const estudiantesConMetadata = useMemo(() => {
        const activeIds = new Set(inscripciones.filter(i => (i as any).estado === 'activo' || (i as any).estado === 'promovido').map(i => i.entrevista_id));
        const suspendedMap = new Map<string, number>();

        inscripciones.forEach(i => {
            if ((i as any).estado === 'inactivo') {
                suspendedMap.set(i.entrevista_id, i.curso_id);
            }
        });

        return estudiantes.map(e => ({
            ...e,
            isActive: activeIds.has(e.id),
            suspendedCourseId: suspendedMap.get(e.id)
        }));
    }, [estudiantes, inscripciones]);

    const eDisponibles = useMemo(() => {
        // Show ALL students that are not currently active (this includes suspended and never-enrolled)
        return estudiantesConMetadata.filter(e =>
            !e.isActive && (!search || e.nombre.toLowerCase().includes(search.toLowerCase()))
        );
    }, [estudiantesConMetadata, search]);

    // Get allowed courses for selected students
    const cursosPermitidos = useMemo(() => {
        const selectedStudents = eDisponibles.filter(e => selectedIds[e.id]);
        if (selectedStudents.length === 0) {
            // No students selected, allow all courses (default behavior)
            return cursos;
        }

        // Check if all selected students have the same restriction
        const suspendedCourses = selectedStudents.map(s => s.suspendedCourseId).filter(Boolean);

        if (suspendedCourses.length === 0) {
            // No suspended students, default to Restauración 1 only
            return cursos.filter(c => c.nombre === 'Restauración 1');
        }

        // If all have same suspended course, show only that one
        const uniqueCourses = [...new Set(suspendedCourses)];
        if (uniqueCourses.length === 1) {
            const courseId = uniqueCourses[0];
            return cursos.filter(c => c.id === courseId);
        }

        // Mixed: some suspended from different courses - show warning or allow admin choice
        return cursos.filter(c => suspendedCourses.includes(c.id));
    }, [selectedIds, eDisponibles, cursos]);

    // Auto-select course when students are selected
    useEffect(() => {
        if (cursosPermitidos.length === 1 && cursosPermitidos[0].id !== parseInt(cursoId)) {
            setCursoId(String(cursosPermitidos[0].id));
            setMaestroId(''); // Reset maestro when course changes
        }
    }, [cursosPermitidos, cursoId]);

    // Check for level conflicts when selecting students
    const handleStudentToggle = (studentId: string) => {
        const newSelectedIds = { ...selectedIds, [studentId]: !selectedIds[studentId] };

        // Filter only truly selected ones
        const selectedStudents = eDisponibles.filter(e => newSelectedIds[e.id]);

        if (selectedStudents.length <= 1) {
            setSelectedIds(newSelectedIds);
            return;
        }

        // Identify target course for each student
        // If suspended -> suspendedCourseId
        // If new -> Restauración 1 ID
        const rest1 = cursos.find(c => c.nombre === 'Restauración 1');
        const rest1Id = rest1 ? rest1.id : -1;

        const targetCourses = selectedStudents.map(s => s.suspendedCourseId || rest1Id);
        const uniqueTargets = [...new Set(targetCourses)];

        // If multiple different courses, show warning
        if (uniqueTargets.length > 1) {
            const courseNames = uniqueTargets.map(id => cursos.find(c => c.id === id)?.nombre || 'Desconocido').join(', ');

            setAlertData({
                isOpen: true,
                title: '⚠️ Niveles Incompatibles',
                message: `No puedes matricular estudiantes de diferentes niveles simultáneamente.\n\nNiveles detectados: ${courseNames}.\n\nPor favor, selecciona estudiantes que vayan al mismo nivel.`,
                type: 'warning'
            });
            return; // Block selection
        }

        setSelectedIds(newSelectedIds);
    };

    const handleMatricular = async () => {
        setIsSaving(true);
        const ids = Object.keys(selectedIds).filter(k => selectedIds[k]);

        try {
            // Upsert Logic: 
            // Para cada estudiante seleccionado, intentamos insertar o actualizar si hay conflicto.
            // onConflict: 'entrevista_id, curso_id' (la constraint clave)
            // Si existe, actualizamos servidor_id y ponemos estado = 'activo'.

            const payload = ids.map(id => ({
                entrevista_id: id,
                curso_id: parseInt(cursoId),
                servidor_id: maestroId,
                estado: 'activo' // Reactivar si estaba inactivo
            }));

            const { data, error } = await supabase
                .from('inscripciones')
                .upsert(payload, { onConflict: 'entrevista_id, curso_id' })
                .select('id');

            if (error) throw error;

            // Para asistencias, podemos intentar insertar ignore duplicates o checkear.
            // Si es un re-ingreso, ya tiene asistencias. Si es nuevo, insertamos.
            // La forma mas segura es iterar los IDs retornados. Si ya existia, el ID es el mismo.
            // Asumiremos que si se reactiva, mantenemos las asistencias viejas. Si es nuevo, creamos row.
            // Supabase upsert retorna los rows afectados.

            if (data && data.length > 0) {
                // Insertar asistencias solo si NO existen para esa inscripción.
                // Una forma simple es 'insert ignore' style. 
                // O usar upsert con ignoreDuplicates si la PK es inscripcion_id.
                // asistencias_academia PK es id, inscripcion_id es FK unique?
                // Si inscripcion_id es unique en asistencias_academia, podemos usar upsert on conflict inscripcion_id do nothing.

                const asistenciasPayload = data.map((d: { id: number }) => ({
                    inscripcion_id: d.id,
                    asistencias: '{}'
                }));

                await supabase
                    .from('asistencias_academia')
                    .upsert(asistenciasPayload, { onConflict: 'inscripcion_id', ignoreDuplicates: true });
            }

            // Obtener nombres de los estudiantes matriculados para el mensaje
            const nombres = estudiantes.filter(e => selectedIds[e.id]).map(e => e.nombre).join(', ');
            const mensaje = ids.length === 1
                ? `El estudiante ${nombres} ha sido matriculado exitosamente.`
                : `Los estudiantes fueron Matriculados exitosamente.`;

            setAlertData({ isOpen: true, title: 'Matrícula Exitosa', message: mensaje, type: 'success' });
            setSelectedIds({});
            onMatriculaExitosa();
        } catch (e: any) {
            setAlertData({ isOpen: true, title: 'Error', message: e.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <GlassCard className="h-full flex flex-col">
            <CardHeader Icon={UserPlus} title="Matricular Estudiantes" subtitle="Asignación de cursos y maestros.">
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-white/30 hover:bg-white/50 text-indigo-900 border border-white/50 px-4 py-2 rounded-xl text-sm font-bold flex items-center backdrop-blur-md transition-all shadow-sm active:scale-95"
                >
                    <Plus size={18} className="mr-2" />
                    <span className="hidden sm:inline">Agregar Estudiante</span>
                </button>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 flex-1 min-h-0 overflow-hidden">
                <div className="space-y-4 overflow-visible md:overflow-y-auto md:max-h-full">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Configuración</label>
                        <FormSelect label="Curso" value={cursoId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setCursoId(e.target.value); setMaestroId(''); }}>
                            {cursosPermitidos.length === 0 ? (
                                <option value="">Seleccione estudiantes...</option>
                            ) : cursosPermitidos.length === 1 ? (
                                <option value={cursosPermitidos[0].id}>{cursosPermitidos[0].nombre}</option>
                            ) : (
                                <>
                                    <option value="">Seleccionar Curso...</option>
                                    {cursosPermitidos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </>
                            )}
                        </FormSelect>
                        <FormSelect label="Maestro" value={maestroId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMaestroId(e.target.value)} disabled={!cursoId}>
                            <option value="">Seleccionar...</option>
                            {mDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </FormSelect>
                    </div>
                    <button onClick={handleMatricular} disabled={isSaving || !maestroId || Object.keys(selectedIds).length === 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50">
                        {isSaving ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={20} /> Procesando...</span> : "Confirmar Matrícula"}
                    </button>
                </div>

                <div className="md:col-span-2 flex flex-col min-h-0 h-full">
                    <div className="mb-2 relative shrink-0">
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar estudiantes..." className={`w-full rounded-lg pl-9 py-2 ${GLASS_STYLES.input}`} />
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                    <div className={`flex-1 overflow-y-auto rounded-xl ${GLASS_STYLES.input} p-0 border-2 border-white/50`}>
                        {eDisponibles.length === 0 ? <div className="p-6 text-center text-gray-500">No hay estudiantes disponibles</div> : (
                            <motion.div
                                variants={LIST_WRAPPER_VARIANTS}
                                initial="hidden"
                                animate="visible"
                            >
                                {eDisponibles.map(e => (
                                    <motion.div
                                        key={e.id}
                                        variants={LIST_ITEM_VARIANTS}
                                        onClick={() => handleStudentToggle(e.id)}
                                        className={`flex items-center gap-3 p-3 cursor-pointer ${GLASS_STYLES.listItem} ${selectedIds[e.id] ? 'bg-blue-50/60' : ''}`}
                                    >
                                        <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedIds[e.id] ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                                            {selectedIds[e.id] && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium">{e.nombre}</p>
                                                {e.suspendedCourseId && (
                                                    <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                                        Susp. {cursos.find(c => c.id === e.suspendedCourseId)?.nombre}
                                                    </span>
                                                )}
                                                {e.dia && (
                                                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg shadow-sm ${e.dia === 'Domingo' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                            e.dia === 'Martes' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                                'bg-pink-100 text-pink-700 border border-pink-200'
                                                        }`}>
                                                        {e.dia}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">{e.telefono || 'Sin teléfono'}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
            {/* Premium Modals */}
            <AnimatePresence>
                {showModal && (
                    <ModalNuevoEstudiante
                        cursos={cursos}
                        maestros={maestros}
                        onClose={() => setShowModal(false)}
                        onSuccess={() => {
                            setShowModal(false);
                            onMatriculaExitosa();
                            setAlertData({ isOpen: true, title: 'Éxito', message: 'Estudiante creado y matriculado correctamente.', type: 'success' });
                        }}
                    />
                )}
                {alertData && (
                    <ModalAlert
                        key="alert-modal"
                        title={alertData.title}
                        message={alertData.message}
                        type={alertData.type}
                        onClose={() => setAlertData(null)}
                    />
                )}
            </AnimatePresence>
        </GlassCard>
    );
}


function PremiumSelect({ label, value, onChange, options, placeholder = "Seleccionar..." }: { label: string, value: string, onChange: (val: string) => void, options: { value: string, label: string }[], placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5 ml-1">{label}</label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full text-left bg-white/40 border border-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 flex justify-between items-center text-gray-800 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all hover:bg-white/50"
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute z-50 mt-1 w-full bg-white/95 backdrop-blur-xl border border-white/60 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                        >
                            {options.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`px-3 py-2 text-xs cursor-pointer transition-colors ${opt.value === value ? 'bg-indigo-100/50 text-indigo-700 font-bold' : 'text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600'}`}
                                >
                                    {opt.label}
                                </div>
                            ))}
                            {options.length === 0 && (
                                <div className="px-3 py-2 text-xs text-gray-400 italic text-center">No hay opciones</div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function ModalNuevoEstudiante({ cursos, maestros, onClose, onSuccess }: { cursos: Curso[], maestros: MaestroConCursos[], onClose: () => void, onSuccess: () => void }) {
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [cedula, setCedula] = useState('');
    const [cursoId, setCursoId] = useState('');
    const [maestroId, setMaestroId] = useState('');
    const [loading, setLoading] = useState(false);

    const maestrosDisponibles = useMemo(() => {
        if (!cursoId) return [];
        return maestros.filter(m => m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === parseInt(cursoId)));
    }, [cursoId, maestros]);

    const handleSubmit = async () => {
        if (!nombre || !cedula || !cursoId || !maestroId) {
            alert("Por favor complete todos los campos requeridos.");
            return;
        }

        setLoading(true);
        try {
            // 1. Verificar o Crear Estudiante en 'entrevistas'
            const { data: existing } = await supabase.from('entrevistas').select('id').eq('cedula', cedula).maybeSingle();
            let entrevistaId = existing?.id;

            if (!entrevistaId) {
                const { data: newStudent, error: errStudent } = await supabase
                    .from('entrevistas')
                    .insert({ nombre, cedula, telefono })
                    .select('id')
                    .single();

                if (errStudent) throw errStudent;
                entrevistaId = newStudent.id;
            }

            // 2. Matricular (Inscripción)
            const { error: errInsc } = await supabase
                .from('inscripciones')
                .upsert({
                    entrevista_id: entrevistaId,
                    curso_id: parseInt(cursoId),
                    servidor_id: maestroId,
                    estado: 'activo'
                }, { onConflict: 'entrevista_id, curso_id' }); // Conflict key syntax check: might need to be explicit constraint name if defined, but column list often works in JS client

            if (errInsc) throw errInsc;

            // 3. Inicializar Asistencias (si es necesario)
            const { data: inscData } = await supabase.from('inscripciones').select('id').eq('entrevista_id', entrevistaId).eq('curso_id', parseInt(cursoId)).single();
            if (inscData) {
                await supabase
                    .from('asistencias_academia')
                    .upsert({ inscripcion_id: inscData.id, asistencias: '{}' }, { onConflict: 'inscripcion_id', ignoreDuplicates: true });
            }

            onSuccess();
        } catch (e: any) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-lg bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full"
            >
                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-3 border-b border-white/50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 leading-none">Nuevo Estudiante</h3>
                        <p className="text-[10px] text-gray-500 mt-1">Ingresa los datos para matricular</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/50 rounded-full text-gray-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 px-4 py-4 space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5 ml-1">Nombre Completo</label>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} className={`w-full rounded-lg px-3 py-1.5 text-sm ${GLASS_STYLES.input} transition-all focus:ring-1 focus:ring-indigo-500/50`} placeholder="Ej: Juan Pérez" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5 ml-1">Cédula</label>
                            <input value={cedula} onChange={e => setCedula(e.target.value)} className={`w-full rounded-lg px-3 py-1.5 text-sm ${GLASS_STYLES.input}`} placeholder="123456789" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5 ml-1">Teléfono</label>
                            <input value={telefono} onChange={e => setTelefono(e.target.value)} className={`w-full rounded-lg px-3 py-1.5 text-sm ${GLASS_STYLES.input}`} placeholder="300 123 4567" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/40">
                        <PremiumSelect
                            label="Nivel / Curso"
                            value={cursoId}
                            onChange={(val) => { setCursoId(val); setMaestroId(''); }}
                            options={cursos.map(c => ({ value: String(c.id), label: c.nombre }))}
                            placeholder="Nivel..."
                        />

                        <PremiumSelect
                            label="Maestro"
                            value={maestroId}
                            onChange={setMaestroId}
                            options={maestrosDisponibles.map(m => ({ value: m.id, label: m.nombre }))}
                            placeholder="Seleccionar..."
                        />
                    </div>
                </div>

                <div className="px-4 py-3 bg-white/40 border-t border-white/50 flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-gray-600 font-bold hover:bg-white/50 transition-colors text-xs">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !nombre || !cedula || !cursoId || !maestroId}
                        className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-1.5 rounded-lg font-bold shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center text-xs"
                    >
                        {loading ? <Loader2 className="animate-spin mr-1.5" size={12} /> : null}
                        Registrar
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function ModalAlert({ title, message, type, onClose }: { title: string, message: string, type: 'error' | 'info' | 'success' | 'warning', onClose: () => void }) {
    const isError = type === 'error';
    const isSuccess = type === 'success';
    const isWarning = type === 'warning';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/50 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm ${isError ? 'bg-red-100 text-red-600' : isSuccess ? 'bg-green-100 text-green-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isError ? <AlertTriangle size={24} /> : <Check size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">{message}</p>
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold shadow-lg hover:bg-gray-800 text-sm">Entendido</button>
                </div>
            </div>
        </div>
    );
}
