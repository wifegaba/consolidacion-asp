'use client';

import React, { useState, useMemo } from 'react';
import { ClipboardList, Search, UserX, UserCheck2, UserCog, UserMinus, Check, AlertTriangle, Loader2, Phone, MessageCircle, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { supabase } from '../../../lib/supabaseClient';
import { GlassCard, CardHeader, FormSelect, GLASS_STYLES, ModalTemplate } from '../page';
import type { MaestroConCursos, Curso, Estudiante, Inscripcion, EstudianteInscrito } from '../page';

// Animaciones premium para las listas de pendientes y matriculados
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

// Helper local
function generateAvatar(name: string): string {
    const initials = (name || 'NN').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `https://placehold.co/100x100/AED6F1/4A4A4A?text=${initials}`;
}

interface PanelConsultarProps {
    maestros: MaestroConCursos[];
    cursos: Curso[];
    estudiantes: Estudiante[];
    inscripciones: (Inscripcion & { estado?: string })[]; // Fix type error: estado is optional in base type but present in query
    loading: boolean;
    fotoUrls: Record<string, string>;
    onDataUpdated: () => void;
    currentUser: { rol?: string; diaAcceso?: string; cursosAcceso?: string[] };
}

export default function PanelConsultarEstudiantes({ maestros, cursos, estudiantes, inscripciones, loading, fotoUrls, onDataUpdated, currentUser }: PanelConsultarProps) {
    const [search, setSearch] = useState('');
    const [selectedMaestroId, setSelectedMaestroId] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<EstudianteInscrito | null>(null);

    const procesados = useMemo(() => {
        const mSet = new Map<string, MaestroConCursos>(maestros.map(m => [m.id, m]));
        const cSet = new Map<number, Curso>(cursos.map(c => [c.id, c]));
        // We want ONLY active inscriptions to verify "Matriculado" status
        // But we want to know if there's an inactive one to show history in Pendientes.

        const iSet = new Map<string, Inscripcion & { estado?: string }>(inscripciones.map(i => [i.entrevista_id, i]));

        return estudiantes.map(e => {
            const ins = iSet.get(e.id);
            // If status is 'inactivo', treat as NOT matriculado (so it goes to Pendientes),
            // but keep the suspended course info.
            const isActive = ins && ins.estado === 'activo';

            return {
                ...e,
                maestro: (isActive && ins.servidor_id) ? mSet.get(ins.servidor_id) || null : null,
                curso: (ins && ins.curso_id) ? cSet.get(ins.curso_id) || null : null,
                inscripcion_id: isActive ? ins.id : null,
                suspended_course: (!isActive && ins && ins.estado === 'inactivo') ? cSet.get(ins.curso_id) || null : null
            };
        });
    }, [estudiantes, inscripciones, maestros, cursos]);

    const { pendientes, matriculados } = useMemo(() => {
        const q = search.toLowerCase();
        const match = (e: Estudiante) => !q || e.nombre.toLowerCase().includes(q) || e.cedula?.includes(q);

        const isDirector = !currentUser.rol || currentUser.rol === 'Director';
        const cursosPermitidos = currentUser.cursosAcceso || [];
        const diaAcceso = currentUser.diaAcceso;

        // Parsear días del usuario
        const diasUsuario = diaAcceso && diaAcceso !== 'Todos'
            ? diaAcceso.split(',').map(d => d.trim())
            : [];

        return {
            pendientes: procesados.filter(e => !e.inscripcion_id && match(e)),
            matriculados: procesados.filter(e => {
                // Debe tener inscripción activa
                if (!e.inscripcion_id) return false;

                // Filtro por curso según permisos
                if (!isDirector && cursosPermitidos.length > 0) {
                    if (!e.curso || !cursosPermitidos.includes(e.curso.nombre)) return false;
                }

                // Filtro por maestro seleccionado
                if (selectedMaestroId && e.maestro?.id !== selectedMaestroId) return false;

                // Filtro por curso seleccionado
                if (selectedCourseId && e.curso?.id !== parseInt(selectedCourseId)) return false;

                // Filtro por búsqueda
                if (!match(e)) return false;

                // Filtro por día del maestro
                if (!isDirector && diasUsuario.length > 0) {
                    // Si el maestro no tiene día asignado, mostrar el estudiante
                    if (!e.maestro?.dia_asignado) return true;

                    // Solo mostrar si el día del maestro está en los días del usuario
                    return diasUsuario.includes(e.maestro.dia_asignado);
                }

                return true;
            })
        };
    }, [procesados, search, selectedMaestroId, selectedCourseId, currentUser]);

    return (
        <GlassCard className="h-full flex flex-col relative">
            <CardHeader Icon={ClipboardList} title="Estudiantes" subtitle="Base de datos de matrículas." />

            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                <div className="relative md:col-span-2">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estudiante..." className={`w-full rounded-lg px-4 py-2.5 pl-10 ${GLASS_STYLES.input}`} />
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <div className={cursos.length <= 1 ? "hidden md:block" : ""}>
                    <FormSelect value={selectedCourseId} onChange={(e: any) => setSelectedCourseId(e.target.value)} label="">
                        <option value="">Todos los Niveles</option>
                        {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </FormSelect>
                </div>
                <FormSelect value={selectedMaestroId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMaestroId(e.target.value)} label="">
                    <option value="">Todos los Maestros</option>
                    {maestros.filter(m => m.rol === 'Maestro Ptm').map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </FormSelect>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 pb-4 md:px-6 md:pb-6 flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-col h-full min-h-0">
                    <div className="mb-2 flex items-center gap-2 text-rose-700 font-semibold shrink-0"><UserX size={18} /> Pendientes ({pendientes.length})</div>
                    <div className={`flex-1 overflow-y-auto rounded-xl ${GLASS_STYLES.input} p-0 border-2 border-white/50`}>
                        {loading ? <div className="p-4 text-center">Cargando...</div> : pendientes.length === 0 ? <div className="p-8 text-center text-gray-500">No hay pendientes</div> : (
                            <motion.div
                                key={`pendientes-${search}-${pendientes.length}`}
                                variants={LIST_WRAPPER_VARIANTS}
                                initial="hidden"
                                animate="visible"
                            >
                                {pendientes.map(e => (
                                    <motion.div key={e.id} variants={LIST_ITEM_VARIANTS}>
                                        <EstudianteRow e={e} onClick={() => setSelectedStudent(e)} />
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col h-full min-h-0">
                    <div className="mb-2 flex items-center gap-2 text-blue-700 font-semibold shrink-0"><UserCheck2 size={18} /> Matriculados ({matriculados.length})</div>
                    <div className={`flex-1 overflow-y-auto rounded-xl ${GLASS_STYLES.input} p-0 border-2 border-white/50`}>
                        {loading ? <div className="p-4 text-center">Cargando...</div> : matriculados.length === 0 ? <div className="p-8 text-center text-gray-500">No hay matriculados</div> : (
                            <motion.div
                                key={`matriculados-${search}-${matriculados.length}`}
                                variants={LIST_WRAPPER_VARIANTS}
                                initial="hidden"
                                animate="visible"
                            >
                                {matriculados.map(e => (
                                    <motion.div key={e.id} variants={LIST_ITEM_VARIANTS}>
                                        <EstudianteRow e={e} matriculado fotoUrl={e.foto_path ? fotoUrls[e.foto_path] : undefined} onClick={() => setSelectedStudent(e)} />
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {selectedStudent && (
                    <ModalDetalleEstudiante
                        key="modal-detalle"
                        estudiante={selectedStudent}
                        maestros={maestros}
                        fotoUrl={selectedStudent.foto_path ? fotoUrls[selectedStudent.foto_path] : undefined}
                        onClose={() => setSelectedStudent(null)}
                        onSuccess={() => { setSelectedStudent(null); onDataUpdated(); }}
                    />
                )}
            </AnimatePresence>
        </GlassCard>
    );
}

// Update EstudianteRow to show suspended tag
function EstudianteRow({ e, matriculado, fotoUrl, onClick }: { e: EstudianteInscrito & { suspended_course?: Curso | null }, matriculado?: boolean, fotoUrl?: string, onClick: () => void }) {
    const avatar = fotoUrl || generateAvatar(e.nombre);
    return (
        <div onClick={onClick} className={`p-3 flex justify-between items-center cursor-pointer ${GLASS_STYLES.listItem}`}>
            <div className="flex items-center gap-3">
                {matriculado && <img src={avatar} alt={e.nombre} className="h-10 w-10 rounded-full object-cover border border-white/60 shadow-sm bg-gray-200" />}
                <div>
                    <p className="font-medium text-gray-900 text-sm flex items-center gap-2">
                        {e.nombre}
                        {!matriculado && e.suspended_course && (
                            <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                Susp. {e.suspended_course.nombre}
                            </span>
                        )}
                    </p>
                    <p className="text-xs text-gray-500">{e.telefono || e.cedula}</p>
                </div>
            </div>
            {matriculado ? (
                <div className="text-right">
                    <span className="block text-xs font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-full truncate max-w-[120px]">{e.curso?.nombre}</span>
                    <span className="text-[10px] text-gray-500">{e.maestro?.nombre}</span>
                </div>
            ) : (
                <span className="text-xs font-medium text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded-full">Pendiente</span>
            )}
        </div>
    );
}

function ModalDetalleEstudiante({ estudiante, maestros, fotoUrl, onClose, onSuccess }: { estudiante: EstudianteInscrito, maestros: MaestroConCursos[], fotoUrl?: string, onClose: () => void, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [selectedMaestro, setSelectedMaestro] = useState(estudiante.maestro?.id || '');
    const [isActiveState, setIsActiveState] = useState(!!estudiante.inscripcion_id);

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
    const [secureConfirmData, setSecureConfirmData] = useState<{ isOpen: boolean; studentName: string; onConfirm: () => void } | null>(null);
    const [alertData, setAlertData] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'info' } | null>(null);

    // Filtrar maestros disponibles (mismo rol 'Maestro Ptm')
    const maestrosDisponibles = useMemo(() => maestros.filter(m => m.rol === 'Maestro Ptm'), [maestros]);

    const handleToggleStatus = async () => {
        if (isActiveState) {
            setConfirmData({
                isOpen: true,
                title: 'Desactivar Matrícula',
                message: "¿Desea desactivar la matrícula de este estudiante? Pasará a 'Pendientes'.",
                onConfirm: async () => {
                    setLoading(true);
                    try {
                        const { error } = await supabase.from('inscripciones').update({ estado: 'inactivo' }).eq('id', estudiante.inscripcion_id!);
                        if (error) throw error;
                        setIsActiveState(false);
                        onSuccess();
                    } catch (e: any) {
                        setAlertData({ isOpen: true, title: 'Error', message: e.message, type: 'error' });
                    } finally { setLoading(false); setConfirmData(null); }
                }
            });
        } else {
            setAlertData({ isOpen: true, title: 'Acción Requerida', message: "Para activar la matrícula, por favor utilice la pestaña 'Matricular' para asignar el curso y entrevista formalmente.", type: 'info' });
        }
    };

    const handleUpdateMaestro = async () => {
        setLoading(true);
        try {
            if (!estudiante.inscripcion_id) {
                setAlertData({ isOpen: true, title: 'Acción Requerida', message: "El estudiante debe estar matriculado primero para asignar maestro desde este panel. Use la pestaña 'Matricular'.", type: 'info' });
                return;
            }

            const { error } = await supabase
                .from('inscripciones')
                .update({ servidor_id: selectedMaestro || null })
                .eq('id', estudiante.inscripcion_id!);

            if (error) throw error;
            onSuccess();
        } catch (e: any) {
            setAlertData({ isOpen: true, title: 'Error', message: "Error al actualizar: " + e.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDesasignar = async () => {
        setSelectedMaestro('');
    };

    const handleEliminar = () => {
        const executeDelete = async () => {
            setLoading(true);
            try {
                const { error } = await supabase.from('entrevistas').delete().eq('id', estudiante.id);
                if (error) throw error;
                onSuccess();
            } catch (e: any) {
                setAlertData({ isOpen: true, title: 'Error', message: "No se pudo eliminar: " + e.message, type: 'error' });
            } finally {
                setLoading(false);
                setSecureConfirmData(null);
                setConfirmData(null);
            }
        };

        if (isActiveState) {
            setSecureConfirmData({
                isOpen: true,
                studentName: estudiante.nombre,
                onConfirm: executeDelete
            });
        } else {
            setConfirmData({
                isOpen: true,
                title: 'Eliminar Registro',
                message: `¿Estás seguro de que deseas eliminar permanentemente a ${estudiante.nombre}?`,
                onConfirm: executeDelete
            });
        }
    };

    const avatar = fotoUrl || generateAvatar(estudiante.nombre);

    return (
        <ModalTemplate onClose={onClose} title="Detalle del Estudiante">
            <div className="flex flex-col h-full bg-slate-50/50">
                {/* Header Premium Compacto */}
                <div className="p-4 flex flex-col items-center justify-center bg-white/60 border-b border-white/50 space-y-1 relative">
                    {/* Switch Premium: Solo visible si ya está matriculado (para desactivar) */}
                    {estudiante.inscripcion_id && (
                        <div className="absolute top-3 right-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={isActiveState} onChange={handleToggleStatus} className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 shadow-inner"></div>
                            </label>
                        </div>
                    )}

                    <div className="h-16 w-16 rounded-full p-1 bg-gradient-to-tr from-blue-400 to-indigo-500 shadow-lg mb-1">
                        <img src={avatar} alt={estudiante.nombre} className="h-full w-full rounded-full object-cover border-2 border-white" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 text-center leading-tight">{estudiante.nombre}</h3>

                    {/* ID / Estado */}
                    <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-600 mb-2">
                        {!estudiante.cedula.startsWith('TEMP') ? (
                            <span className="bg-gray-200/60 px-2 py-0.5 rounded shadow-sm border border-white/50">{estudiante.cedula}</span>
                        ) : (
                            <span className="bg-amber-100/80 text-amber-700 px-2 py-0.5 rounded shadow-sm border border-amber-200 font-medium">Pendiente por Entrevista</span>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 mt-1">
                        {estudiante.telefono && (
                            <>
                                <a href={`tel:${estudiante.telefono}`} className="flex items-center justify-center w-10 h-10 rounded-full bg-white text-sky-500 hover:bg-sky-50 hover:scale-110 transition-all shadow-sm border border-sky-100" title="Llamar">
                                    <Phone size={20} />
                                </a>
                                <a href={`https://wa.me/57${estudiante.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:scale-110 transition-all shadow-sm border border-emerald-200" title="Enviar Mensaje">
                                    <MessageCircle size={18} />
                                </a>
                            </>
                        )}
                        <button onClick={handleEliminar} className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 hover:scale-110 transition-all shadow-sm border border-rose-200" title="Eliminar del Sistema">
                            <Trash2 size={18} />
                        </button>
                    </div>
                    {estudiante.telefono && <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 shadow-sm mt-1">{estudiante.telefono}</span>}
                </div>

                <div className="p-3 flex-1 overflow-y-auto space-y-2">
                    <div className="bg-white/60 rounded-xl p-3 border border-white/60 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><UserCog size={14} /> Gestión Académica</h4>

                        <div className="space-y-2">
                            {isActiveState ? (
                                <>
                                    <div className="p-2 bg-blue-50/50 rounded-lg border border-blue-100 flex justify-between items-center">
                                        <span className="text-xs text-blue-900 font-medium">Curso Actual</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{estudiante.curso?.nombre || 'Sin curso'}</span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Maestro Asignado ({maestrosDisponibles.length})</label>
                                        <div className="relative">
                                            <select
                                                value={selectedMaestro}
                                                onChange={(e) => setSelectedMaestro(e.target.value)}
                                                className={`w-full appearance-none rounded-xl bg-white border border-gray-200 text-gray-700 py-2 px-3 pr-8 text-sm leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 transition-all`}
                                            >
                                                <option value="">-- Sin Asignar --</option>
                                                {maestrosDisponibles.map(m => (
                                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-3 bg-blue-50/60 backdrop-blur-sm text-blue-900 rounded-xl text-xs border border-blue-100 flex items-start gap-2 shadow-sm">
                                    <div className="bg-blue-100 p-1 rounded-full shrink-0 mt-0.5">
                                        <AlertTriangle size={12} className="text-blue-600" />
                                    </div>
                                    <p className="leading-relaxed">Este estudiante no está matriculado. Para asignarle un maestro y curso, por favor utilice la pestaña <b className="text-blue-700">Matricular</b>.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white/40 border-t border-white/50 flex gap-3 mt-auto shrink-0">
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                        {isActiveState ? 'Cancelar' : 'Cerrar'}
                    </button>
                    {isActiveState ? (
                        <button
                            onClick={handleUpdateMaestro}
                            disabled={loading || selectedMaestro === (estudiante.maestro?.id || '')} // Disable if no change
                            className="flex-[2] py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin" size={16} />}
                            {selectedMaestro ? 'Actualizar' : 'Desasignar Maestro'}
                        </button>
                    ) : (
                        <button
                            onClick={handleEliminar}
                            className="flex-[2] py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            Eliminar Registro
                        </button>
                    )}
                </div>
            </div>
            {/* Modales de Confirmación y Alerta dentro del Modal de Estudiante para layering correcto */}
            <AnimatePresence>

                {confirmData && (
                    <ModalConfirm
                        key="conf-modal"
                        title={confirmData.title}
                        message={confirmData.message}
                        onConfirm={confirmData.onConfirm}
                        onCancel={() => setConfirmData(null)}
                    />
                )}
                {secureConfirmData && (
                    <ModalSecureDelete
                        key="secure-conf-modal"
                        studentName={secureConfirmData.studentName}
                        onConfirm={secureConfirmData.onConfirm}
                        onCancel={() => setSecureConfirmData(null)}
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
        </ModalTemplate>
    );
}

function ModalConfirm({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/50 animate-in fade-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">{message}</p>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all text-sm">Cancelar</button>
                        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 text-sm">Aceptar</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModalAlert({ title, message, type, onClose }: { title: string, message: string, type: 'error' | 'info', onClose: () => void }) {
    const isError = type === 'error';
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/50 animate-in fade-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm ${isError ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
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

function ModalSecureDelete({ studentName, onConfirm, onCancel }: { studentName: string, onConfirm: () => void, onCancel: () => void }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password === '93062015-4') {
            onConfirm();
        } else {
            setError('Contraseña incorrecta');
            setPassword('');
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 animate-in fade-in zoom-in duration-300">
                <div className="p-6 text-center">
                    <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-sm ring-4 ring-red-50/50">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Eliminar Estudiante</h3>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        ¿Estás seguro de que deseas eliminar a <span className="font-bold text-gray-800">{studentName}</span>?
                        <br /><br />
                        <span className="text-red-600 font-medium">Esta acción borrará todos sus datos permanentemente y no se puede deshacer.</span>
                    </p>

                    <div className="mb-6 space-y-2">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder="Contraseña de Administrador"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-center font-mono text-lg transition-all"
                            autoFocus
                        />
                        {error && <p className="text-red-500 text-xs font-bold animate-pulse">{error}</p>}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!password}
                            className="flex-[1.5] py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm disabled:opacity-50 disabled:shadow-none"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
