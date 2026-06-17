'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { GlassCard, CardHeader, FormSelect, GLASS_STYLES, ModalTemplate } from '../page';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { AlertTriangle, Check, Loader2, GraduationCap, ChevronRight, UserCheck, ArrowLeft, Search } from 'lucide-react';
import type { MaestroConCursos, Curso, Estudiante } from '../page';
import { getNextCourse } from '../../restauracion/estudiante/components/academia.utils';

// Tipos locales
type PromotedStudent = Estudiante & {
    oldInscriptionId: string;
    oldCourseId: number;
    oldCourseName: string;
    nextCourseId: number;
    nextCourseName: string;
};

// Temas premium con gradientes frescos tipo Mac
const MAC_THEMES = [
    {
        cardBg: "bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-white/90",
        border: "border-blue-100/80 hover:border-blue-300/80",
        iconBg: "bg-gradient-to-tr from-blue-500 to-indigo-600",
        iconColor: "text-white",
        badgeBg: "bg-gradient-to-r from-blue-600 to-indigo-600",
        badgeShadow: "shadow-indigo-500/25",
        textColor: "text-slate-800 group-hover:text-indigo-950",
        subtextColor: "text-indigo-600/80 group-hover:text-indigo-700",
        glowColor: "from-blue-200/30 to-indigo-300/30"
    },
    {
        cardBg: "bg-gradient-to-br from-amber-50/90 via-rose-50/70 to-white/90",
        border: "border-rose-100/80 hover:border-rose-300/80",
        iconBg: "bg-gradient-to-tr from-amber-500 to-rose-500",
        iconColor: "text-white",
        badgeBg: "bg-gradient-to-r from-amber-500 to-rose-500",
        badgeShadow: "shadow-rose-500/25",
        textColor: "text-slate-800 group-hover:text-rose-950",
        subtextColor: "text-rose-600/80 group-hover:text-rose-700",
        glowColor: "from-amber-200/30 to-rose-300/30"
    },
    {
        cardBg: "bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-white/90",
        border: "border-emerald-100/80 hover:border-emerald-300/80",
        iconBg: "bg-gradient-to-tr from-emerald-500 to-teal-600",
        iconColor: "text-white",
        badgeBg: "bg-gradient-to-r from-emerald-600 to-teal-600",
        badgeShadow: "shadow-teal-500/25",
        textColor: "text-slate-800 group-hover:text-emerald-950",
        subtextColor: "text-emerald-600/80 group-hover:text-emerald-700",
        glowColor: "from-emerald-200/30 to-teal-300/30"
    },
    {
        cardBg: "bg-gradient-to-br from-purple-50/90 via-fuchsia-50/70 to-white/90",
        border: "border-purple-100/80 hover:border-purple-300/80",
        iconBg: "bg-gradient-to-tr from-purple-500 to-fuchsia-600",
        iconColor: "text-white",
        badgeBg: "bg-gradient-to-r from-purple-600 to-fuchsia-600",
        badgeShadow: "shadow-fuchsia-500/25",
        textColor: "text-slate-800 group-hover:text-purple-950",
        subtextColor: "text-purple-600/80 group-hover:text-purple-700",
        glowColor: "from-purple-200/30 to-fuchsia-300/30"
    }
];

const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const PAGE_VARIANTS = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1, 
        transition: { 
            duration: 0.25, 
            ease: EASE_SMOOTH,
            when: "beforeChildren"
        } 
    },
    exit: { opacity: 0, transition: { duration: 0.15 } }
};

const FORM_VARIANTS = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1, 
        transition: { 
            duration: 0.25, 
            ease: EASE_SMOOTH,
            when: "beforeChildren"
        } 
    },
    exit: { opacity: 0, transition: { duration: 0.15 } }
};

const LIST_WRAPPER_VARIANTS: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.05, delayChildren: 0.05 }
    }
};

const LIST_ITEM_VARIANTS: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.45, ease: EASE_SMOOTH }
    }
};

interface PanelPromovidosProps {
    maestros: MaestroConCursos[];
    cursos: Curso[];
    estudiantes: Estudiante[];
    onDataUpdated: () => void;
    loading: boolean;
    currentUser: { rol?: string; diaAcceso?: string; cursosAcceso?: string[] };
}

export default function PanelPromovidos({ maestros, cursos, estudiantes, onDataUpdated, loading, currentUser }: PanelPromovidosProps) {
    const [promotedStudents, setPromotedStudents] = useState<PromotedStudent[]>([]);
    const [fetching, setFetching] = useState(true);

    // State for Navigation
    const [selectedNextCourseId, setSelectedNextCourseId] = useState<number | null>(null);

    // Enrollment State
    const [maestroId, setMaestroId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
    const [processing, setProcessing] = useState(false);
    const [alertData, setAlertData] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' } | null>(null);
    const [search, setSearch] = useState('');

    // Fetch logic
    useEffect(() => {
        const fetchPromoted = async () => {
            setFetching(true);
            try {
                const { data, error } = await supabase
                    .from('inscripciones')
                    .select('id, entrevista_id, curso_id, cursos(nombre)')
                    .eq('estado', 'promovido');

                if (error) throw error;

                const list: PromotedStudent[] = [];

                for (const record of data as any[]) {
                    const student = estudiantes.find(e => e.id === record.entrevista_id);
                    if (student) {
                        const next = getNextCourse(record.curso_id);
                        if (next) {
                            list.push({
                                ...student,
                                oldInscriptionId: record.id,
                                oldCourseId: record.curso_id,
                                oldCourseName: record.cursos?.nombre || '',
                                nextCourseId: next.id,
                                nextCourseName: next.name
                            });
                        }
                    }
                }
                setPromotedStudents(list);
            } catch (e) {
                console.error("Error fetching promoted:", e);
            } finally {
                setFetching(false);
            }
        };

        fetchPromoted();
    }, [estudiantes, loading]); // Reload when global students reload

    // Mapped Data
    const groupedStats = useMemo(() => {
        const stats: Record<number, { name: string; count: number }> = {};

        const isDirector = !currentUser.rol || currentUser.rol === 'Director';
        const cursosPermitidos = currentUser.cursosAcceso || [];

        promotedStudents.forEach(s => {
            // Filtrar por curso de destino si el usuario no es Director
            if (!isDirector && cursosPermitidos.length > 0 && !cursosPermitidos.includes(s.nextCourseName)) return;

            if (!stats[s.nextCourseId]) {
                stats[s.nextCourseId] = { name: s.nextCourseName, count: 0 };
            }
            stats[s.nextCourseId].count++;
        });
        return stats;
    }, [promotedStudents, currentUser]);

    const studentsForSelectedCourse = useMemo(() => {
        if (!selectedNextCourseId) return [];
        return promotedStudents.filter(s => s.nextCourseId === selectedNextCourseId && (!search || s.nombre.toLowerCase().includes(search.toLowerCase())));
    }, [selectedNextCourseId, promotedStudents, search]);

    const maestrosDisponibles = useMemo(() => {
        if (!selectedNextCourseId) return [];
        return maestros.filter(m => m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === selectedNextCourseId));
    }, [selectedNextCourseId, maestros]);

    const selectedTheme = useMemo(() => {
        if (!selectedNextCourseId) return null;
        const entries = Object.entries(groupedStats);
        const index = entries.findIndex(([courseId]) => parseInt(courseId) === selectedNextCourseId);
        if (index === -1) return MAC_THEMES[0];
        return MAC_THEMES[index % MAC_THEMES.length];
    }, [selectedNextCourseId, groupedStats]);


    // Handler
    const handleMatricular = async () => {
        if (!selectedNextCourseId || !maestroId) return;
        setProcessing(true);
        const idsToProcess = Object.keys(selectedIds).filter(k => selectedIds[k]);

        try {
            const studentsToEnroll = promotedStudents.filter(s => idsToProcess.includes(s.id));

            for (const s of studentsToEnroll) {
                // 1. Update Old Inscription to 'finalizado'
                await supabase
                    .from('inscripciones')
                    .update({ estado: 'finalizado' })
                    .eq('id', s.oldInscriptionId);

                // 2. Create New Inscription
                const { data: newInsc, error: encError } = await supabase
                    .from('inscripciones')
                    .insert({
                        entrevista_id: s.id,
                        curso_id: s.nextCourseId,
                        servidor_id: maestroId,
                        estado: 'activo'
                    })
                    .select('id')
                    .single();

                if (encError) throw encError;

                // 3. Init Attendance
                if (newInsc) {
                    await supabase
                        .from('asistencias_academia')
                        .insert({ inscripcion_id: newInsc.id, asistencias: '{}' });
                }
            }

            setAlertData({ isOpen: true, title: 'Matrícula Exitosa', message: `${idsToProcess.length} estudiantes matriculados en ${studentsForSelectedCourse[0].nextCourseName}`, type: 'success' });
            setSelectedIds({});
            // Refresh
            onDataUpdated();
            // Remove handled from local state to avoid flicker before reload
            setPromotedStudents(prev => prev.filter(s => !idsToProcess.includes(s.id)));

        } catch (e: any) {
            setAlertData({ isOpen: true, title: 'Error', message: e.message, type: 'error' });
        } finally {
            setProcessing(false);
        }
    };


    return (
        <GlassCard className="h-full flex flex-col relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <AnimatePresence mode="wait">
                {!selectedNextCourseId ? (
                    <motion.div
                        key="list"
                        variants={PAGE_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="flex flex-col h-full"
                    >
                        <CardHeader Icon={GraduationCap} title="Estudiantes Promovidos" subtitle="Gestionar promoción al siguiente nivel." />

                        <motion.div 
                            key={`cursos-lista-${fetching}-${loading}-${Object.keys(groupedStats).length}`}
                            variants={LIST_WRAPPER_VARIANTS}
                            initial="hidden"
                            animate="visible"
                            className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto"
                        >
                            {fetching || loading ? <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div> :
                                promotedStudents.length === 0 ? <div className="col-span-full py-12 text-center text-gray-500">No hay estudiantes pendientes de promoción.</div> :
                                    Object.entries(groupedStats).map(([courseId, stat], index) => {
                                        const theme = MAC_THEMES[index % MAC_THEMES.length];
                                        return (
                                            <motion.div
                                                key={courseId}
                                                variants={LIST_ITEM_VARIANTS}
                                            >
                                                <motion.div
                                                    whileHover={{ 
                                                        scale: 0.995,
                                                        boxShadow: "inset 3px 3px 8px rgba(0,0,0,0.05), inset -3px -3px 8px rgba(255,255,255,0.85)"
                                                    }}
                                                    whileTap={{ 
                                                        scale: 0.985,
                                                        boxShadow: "inset 4px 4px 12px rgba(0,0,0,0.08), inset -4px -4px 12px rgba(255,255,255,0.95)"
                                                    }}
                                                    onClick={() => setSelectedNextCourseId(parseInt(courseId))}
                                                    className={`cursor-pointer group relative overflow-hidden rounded-3xl border ${theme.border} ${theme.cardBg} p-7 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.03),_inset_-2px_-2px_6px_rgba(255,255,255,0.7),_0_2px_8px_rgba(0,0,0,0.01)] backdrop-blur-md transition-all duration-300 h-full`}
                                                >
                                                    {/* Brillo ambiental en hover */}
                                                    <div className={`absolute -right-10 -bottom-10 w-32 h-32 bg-gradient-to-br ${theme.glowColor} rounded-full blur-2xl opacity-70 group-hover:scale-150 transition-all duration-500 pointer-events-none`} />
                                                    
                                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                                        <div className={`p-3 bg-gradient-to-tr ${theme.iconBg} rounded-2xl ${theme.iconColor} shadow-md shadow-black/5 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
                                                            <GraduationCap size={22} className="stroke-[2.2]" />
                                                        </div>
                                                        <div className={`px-3.5 py-1.5 rounded-full ${theme.badgeBg} text-white text-[11px] font-bold tracking-wide uppercase shadow-sm ${theme.badgeShadow} transform group-hover:scale-105 transition-transform duration-300`}>
                                                            {stat.count} {stat.count === 1 ? 'pendiente' : 'pendientes'}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="relative z-10">
                                                        <h3 className={`text-xl font-extrabold tracking-tight mb-2 transition-colors ${theme.textColor}`}>{stat.name}</h3>
                                                        <p className={`text-sm font-semibold ${theme.subtextColor} flex items-center gap-1.5 transition-all duration-300`}>
                                                            <span>Matricular alumnos</span> 
                                                            <ChevronRight size={15} className="transform group-hover:translate-x-1 transition-transform stroke-[2.5]" />
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            </motion.div>
                                        );
                                    })
                            }
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        variants={FORM_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="flex flex-col h-full"
                    >
                        <div className={`flex items-center gap-4 p-5 border-b border-white/50 backdrop-blur-md relative overflow-hidden transition-all duration-500 ${selectedTheme?.cardBg || 'bg-white/40'}`}>
                            {/* Brillo ambiental de fondo */}
                            {selectedTheme && (
                                <div className={`absolute -right-10 -bottom-10 w-48 h-48 bg-gradient-to-br ${selectedTheme.glowColor} rounded-full blur-2xl opacity-60 pointer-events-none`} />
                            )}
                            <button 
                                onClick={() => setSelectedNextCourseId(null)} 
                                className="p-2 rounded-xl bg-white/40 hover:bg-white/70 text-gray-700 transition-all border border-white/40 hover:shadow-sm relative z-10"
                            >
                                <ArrowLeft size={20} className="stroke-[2.5]" />
                            </button>
                            <div className="relative z-10 flex items-center gap-3">
                                <div className={`p-2.5 bg-gradient-to-tr ${selectedTheme?.iconBg || 'bg-indigo-600'} rounded-xl ${selectedTheme?.iconColor || 'text-white'} shadow-sm flex items-center justify-center`}>
                                    <GraduationCap size={20} className="stroke-[2.2]" />
                                </div>
                                <div>
                                    <h2 className={`text-lg font-extrabold tracking-tight ${selectedTheme?.textColor || 'text-gray-900'}`}>
                                        {groupedStats[selectedNextCourseId]?.name}
                                    </h2>
                                    <p className={`text-xs font-semibold ${selectedTheme?.subtextColor || 'text-gray-500'}`}>
                                        Asigna un maestro para completar la promoción.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Sidebar Config */}
                            <div className="w-full md:w-80 p-6 border-r border-white/30 bg-white/20 flex flex-col gap-6 overflow-y-auto">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Maestro Asignado</label>
                                    <FormSelect label="" value={maestroId} onChange={(e: any) => setMaestroId(e.target.value)}>
                                        <option value="">Seleccionar Maestro...</option>
                                        {maestrosDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                    </FormSelect>
                                    {maestrosDisponibles.length === 0 && <p className="text-xs text-rose-500 mt-2">No hay maestros para este curso.</p>}
                                </div>

                                <div className="mt-auto">
                                    <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 mb-4">
                                        <div className="text-2xl font-bold text-indigo-700">{Object.keys(selectedIds).length}</div>
                                        <div className="text-xs text-indigo-600 font-medium uppercase">Estudiantes Seleccionados</div>
                                    </div>
                                    <button
                                        onClick={handleMatricular}
                                        disabled={processing || !maestroId || Object.keys(selectedIds).length === 0}
                                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                    >
                                        {processing ? <Loader2 className="animate-spin" /> : <UserCheck size={20} />}
                                        <span>Finalizar Matrícula</span>
                                    </button>
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 flex flex-col overflow-hidden bg-white/30">
                                <div className="p-4 border-b border-white/30 flex gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar estudiante..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl ${GLASS_STYLES.input} border-white/60`}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const all = studentsForSelectedCourse.reduce((acc, s) => ({ ...acc, [s.id]: true }), {});
                                            setSelectedIds(all);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                    >
                                        Todos
                                    </button>
                                </div>

                                <motion.div 
                                    key={`estudiantes-lista-${selectedNextCourseId}-${search}-${studentsForSelectedCourse.length}`}
                                    variants={LIST_WRAPPER_VARIANTS}
                                    initial="hidden"
                                    animate="visible"
                                    className="flex-1 overflow-y-auto p-4 content-start grid gap-2"
                                >
                                    {studentsForSelectedCourse.map(s => (
                                        <motion.div
                                            key={s.id}
                                            variants={LIST_ITEM_VARIANTS}
                                            onClick={() => setSelectedIds(p => ({ ...p, [s.id]: !p[s.id] }))}
                                            className={`p-4 rounded-xl bg-white/60 border hover:bg-white transition-all cursor-pointer flex items-center justify-between group ${selectedIds[s.id] ? 'ring-2 ring-indigo-500 border-transparent shadow-md' : 'border-white/60'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds[s.id] ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                                                    {selectedIds[s.id] && <Check size={14} className="text-white" />}
                                                </div>
                                                <div className="flex flex-wrap items-baseline gap-2">
                                                    <h4 className="font-bold text-gray-900">{s.nombre}</h4>
                                                    <span className="text-xs text-gray-500">• Promovido de {s.oldCourseName}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Alerts */}
            {alertData && (
                <ModalAlert
                    title={alertData.title}
                    message={alertData.message}
                    type={alertData.type}
                    onClose={() => setAlertData(null)}
                />
            )}
        </GlassCard>
    );
}

function ModalAlert({ title, message, type, onClose }: { title: string, message: string, type: 'error' | 'success', onClose: () => void }) {
    const isError = type === 'error';
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/50 animate-in fade-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm ${isError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
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
