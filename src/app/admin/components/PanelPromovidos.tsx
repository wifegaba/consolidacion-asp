'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { GlassCard, CardHeader, FormSelect, GLASS_STYLES, ModalTemplate } from '../page';
import { AnimatePresence, motion } from 'framer-motion';
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

interface PanelPromovidosProps {
    maestros: MaestroConCursos[];
    cursos: Curso[];
    estudiantes: Estudiante[];
    onDataUpdated: () => void;
    loading: boolean;
}

export default function PanelPromovidos({ maestros, cursos, estudiantes, onDataUpdated, loading }: PanelPromovidosProps) {
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
        promotedStudents.forEach(s => {
            if (!stats[s.nextCourseId]) {
                stats[s.nextCourseId] = { name: s.nextCourseName, count: 0 };
            }
            stats[s.nextCourseId].count++;
        });
        return stats;
    }, [promotedStudents]);

    const studentsForSelectedCourse = useMemo(() => {
        if (!selectedNextCourseId) return [];
        return promotedStudents.filter(s => s.nextCourseId === selectedNextCourseId && (!search || s.nombre.toLowerCase().includes(search.toLowerCase())));
    }, [selectedNextCourseId, promotedStudents, search]);

    const maestrosDisponibles = useMemo(() => {
        if (!selectedNextCourseId) return [];
        return maestros.filter(m => m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === selectedNextCourseId));
    }, [selectedNextCourseId, maestros]);


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
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex flex-col h-full"
                    >
                        <CardHeader Icon={GraduationCap} title="Estudiantes Promovidos" subtitle="Gestionar promoción al siguiente nivel." />

                        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
                            {fetching || loading ? <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div> :
                                promotedStudents.length === 0 ? <div className="col-span-full py-12 text-center text-gray-500">No hay estudiantes pendientes de promoción.</div> :
                                    Object.entries(groupedStats).map(([courseId, stat]) => (
                                        <motion.div
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setSelectedNextCourseId(parseInt(courseId))}
                                            key={courseId}
                                            className="cursor-pointer group relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br from-white/80 to-indigo-50/50 p-6 shadow-sm hover:shadow-lg transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl text-amber-700 shadow-sm border border-amber-200">
                                                    <GraduationCap size={24} />
                                                </div>
                                                <div className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/30">
                                                    {stat.count} pendientes
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{stat.name}</h3>
                                            <p className="text-sm text-gray-500 flex items-center gap-1 group-hover:gap-2 transition-all">
                                                Matricular alumnos <ChevronRight size={14} />
                                            </p>
                                        </motion.div>
                                    ))
                            }
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex flex-col h-full"
                    >
                        <div className="flex items-center gap-4 p-5 border-b border-white/50 bg-white/40 backdrop-blur-md">
                            <button onClick={() => setSelectedNextCourseId(null)} className="p-2 rounded-lg hover:bg-white/60 text-gray-600 transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <GraduationCap className="text-indigo-600" size={24} />
                                    {groupedStats[selectedNextCourseId]?.name}
                                </h2>
                                <p className="text-sm text-gray-500">Asigna un maestro para completar la promoción.</p>
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

                                <div className="flex-1 overflow-y-auto p-4 content-start grid gap-2">
                                    {studentsForSelectedCourse.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => setSelectedIds(p => ({ ...p, [s.id]: !p[s.id] }))}
                                            className={`p-4 rounded-xl bg-white/60 border hover:bg-white transition-all cursor-pointer flex items-center justify-between group ${selectedIds[s.id] ? 'ring-2 ring-indigo-500 border-transparent shadow-md' : 'border-white/60'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds[s.id] ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                                                    {selectedIds[s.id] && <Check size={14} className="text-white" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{s.nombre}</h4>
                                                    <p className="text-xs text-gray-500">C.C. {s.cedula} • Promovido de {s.oldCourseName}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
