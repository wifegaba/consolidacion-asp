'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { GlassCard, CardHeader, FormSelect, GLASS_STYLES, ModalTemplate } from '../page';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { UserPlus, Search } from 'lucide-react';
import type { MaestroConCursos, Curso, Estudiante, Inscripcion } from '../page';

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
    const [alertData, setAlertData] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'info' | 'success' } | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const c = cursos.find(c => c.nombre === 'Restauración 1');
        if (c) setCursoId(String(c.id));
    }, [cursos]);

    const mDisponibles = useMemo(() => !cursoId ? [] : maestros.filter(m => m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === parseInt(cursoId))), [cursoId, maestros]);
    const eDisponibles = useMemo(() => {
        if (!cursoId) return [];
        const inscritos = new Set(inscripciones.map(i => i.entrevista_id));
        return estudiantes.filter(e => !inscritos.has(e.id) && (!search || e.nombre.toLowerCase().includes(search.toLowerCase())));
    }, [cursoId, estudiantes, inscripciones, search]);

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
            <CardHeader Icon={UserPlus} title="Matricular Estudiantes" subtitle="Asignación de cursos y maestros." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 flex-1 min-h-0 overflow-hidden">
                <div className="space-y-4 overflow-visible md:overflow-y-auto md:max-h-full">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Configuración</label>
                        <FormSelect label="Curso" value={cursoId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setCursoId(e.target.value); setMaestroId(''); }}>
                            {cursos.filter(c => c.nombre === 'Restauración 1').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
                        {eDisponibles.length === 0 ? <div className="p-6 text-center text-gray-500">No hay estudiantes disponibles</div> : eDisponibles.map(e => (
                            <div key={e.id} onClick={() => setSelectedIds(p => ({ ...p, [e.id]: !p[e.id] }))} className={`flex items-center gap-3 p-3 cursor-pointer ${GLASS_STYLES.listItem} ${selectedIds[e.id] ? 'bg-blue-50/60' : ''}`}>
                                <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedIds[e.id] ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                                    {selectedIds[e.id] && <Check size={12} className="text-white" />}
                                </div>
                                <div><p className="text-sm font-medium">{e.nombre}</p><p className="text-xs text-gray-500">{e.cedula}</p></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Premium Modals */}
            <AnimatePresence>
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

function ModalAlert({ title, message, type, onClose }: { title: string, message: string, type: 'error' | 'info' | 'success', onClose: () => void }) {
    const isError = type === 'error';
    const isSuccess = type === 'success';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/50 animate-in fade-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm ${isError ? 'bg-red-100 text-red-600' : isSuccess ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
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
