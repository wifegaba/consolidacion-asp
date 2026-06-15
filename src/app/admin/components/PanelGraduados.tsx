'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Award, Search, GraduationCap, Medal, Star, User, Save, Edit2, Loader2 } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { GlassCard } from '../page';
import type { MaestroConCursos, Curso, Estudiante, Inscripcion } from '../page';
import { supabase } from '../../../lib/supabaseClient';
import { downscaleImage, extFromMime, bustUrl } from '../../restauracion/estudiante/components/academia.utils';

// Premium animations
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const LIST_WRAPPER_VARIANTS: Variants = {
    hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
    visible: { transition: { delayChildren: 0.1, staggerChildren: 0.08 } }
};

const LIST_ITEM_VARIANTS: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE_SMOOTH } }
};

function generateAvatar(name: string): string {
    const initials = (name || 'NN').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `https://placehold.co/100x100/1e293b/fbbf24?text=${initials}`;
}

interface PanelGraduadosProps {
    estudiantes: Estudiante[];
    inscripciones: (Inscripcion & { estado?: string })[];
    fotoUrls: Record<string, string>;
    maestros: MaestroConCursos[];
    cursos: Curso[];
    onDataUpdated?: () => void;
}

export default function PanelGraduados({ estudiantes, inscripciones, fotoUrls, maestros, cursos, onDataUpdated }: PanelGraduadosProps) {
    const [search, setSearch] = useState('');

    const graduados = useMemo(() => {
        const mSet = new Map<string, MaestroConCursos>(maestros.map(m => [m.id, m]));
        const cSet = new Map<number, Curso>(cursos.map(c => [c.id, c]));

        // Find inscriptions that are 'graduado'
        const iSet = new Map<string, Inscripcion & { estado?: string }>();
        inscripciones.forEach(i => {
            if (i.estado?.toLowerCase() === 'graduado') {
                iSet.set(i.entrevista_id, i);
            }
        });

        const grads = estudiantes
            .filter(e => iSet.has(e.id))
            .map(e => {
                const ins = iSet.get(e.id)!;
                return {
                    ...e,
                    maestro: ins.servidor_id ? mSet.get(ins.servidor_id) || null : null,
                    curso: ins.curso_id ? cSet.get(ins.curso_id) || null : null,
                    inscripcion_id: ins.id
                };
            });

        const q = search.toLowerCase();
        return grads.filter(g => !q || g.nombre.toLowerCase().includes(q) || g.cedula?.includes(q));
    }, [estudiantes, inscripciones, search, maestros, cursos]);

    return (
        <GlassCard className="h-full flex flex-col relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border-0 shadow-2xl">
            {/* Elegant Background Accents */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 md:p-8 bg-black/20 backdrop-blur-md border-b border-white/5 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-600 text-slate-900 shadow-[0_0_30px_rgba(251,191,36,0.3)] border border-amber-200/50">
                        <Award size={28} className="drop-shadow-sm" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500 tracking-tight">Salón de Graduados</h2>
                        <p className="text-sm text-slate-400 font-medium whitespace-pre-wrap">Estudiantes que han completado exitosamente el Proceso Transformacional.</p>
                    </div>
                </div>
            </div>

            <div className="p-6 md:p-8 shrink-0 relative z-10">
                <div className="relative max-w-xl mx-auto md:mx-0">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o cédula..."
                        className="w-full rounded-2xl bg-slate-900/50 border border-slate-700/50 text-amber-50 placeholder-slate-500 focus:bg-slate-900/80 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 px-5 py-3.5 pl-12 shadow-inner transition-all backdrop-blur-xl"
                    />
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 relative z-10 scroll-smooth custom-scrollbar">
                {graduados.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                        <GraduationCap size={64} className="text-slate-600 mb-4" />
                        <p className="text-xl text-slate-400 font-medium">No se encontraron graduados</p>
                    </div>
                ) : (
                    <motion.div
                        key={`grad-${search}-${graduados.length}`}
                        variants={LIST_WRAPPER_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6"
                    >
                        {graduados.map(g => (
                            <motion.div key={g.id} variants={LIST_ITEM_VARIANTS}>
                                <GraduadoCard graduado={g} fotoUrl={g.foto_path ? fotoUrls[g.foto_path] : undefined} onDataUpdated={onDataUpdated} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.5);
                    border-radius: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(245, 158, 11, 0.3);
                    border-radius: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(245, 158, 11, 0.6);
                }
                
                /* Card Flip 3D classes */
                .card-container {
                    perspective: 1000px;
                    width: 100%;
                    height: 320px;
                }
                .card-inner {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                    transform-style: preserve-3d;
                }
                .card-inner.flipped {
                    transform: rotateY(180deg);
                }
                .card-front, .card-back {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    border-radius: 2rem;
                }
                .card-back {
                    transform: rotateY(180deg);
                }
            `}} />
        </GlassCard>
    );
}

function GraduadoCard({ graduado, fotoUrl, onDataUpdated }: { graduado: any, fotoUrl?: string, onDataUpdated?: () => void }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [nombre, setNombre] = useState(graduado.nombre);
    const [cedula, setCedula] = useState(graduado.cedula || '');
    const [saving, setSaving] = useState(false);
    const [uploadingFoto, setUploadingFoto] = useState(false);
    const [localSignedUrl, setLocalSignedUrl] = useState<string | null>(fotoUrl || null);
    const [fotoPath, setFotoPath] = useState<string | null>(graduado.foto_path || null);
    const inputFotoRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalSignedUrl(fotoUrl || null);
    }, [fotoUrl]);

    const handleChangeFoto = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        setUploadingFoto(true);
        try {
            const compact = await downscaleImage(file, 500, 0.8);
            const tempUrl = URL.createObjectURL(compact);
            setLocalSignedUrl(tempUrl);
            const path = `fotos/${graduado.id}-${Date.now()}${extFromMime(compact.type)}`;
            const { error } = await supabase.storage.from('entrevistas-fotos').upload(path, compact, { upsert: true });
            if (error) throw error;
            await supabase.from('entrevistas').update({ foto_path: path }).eq('id', graduado.id);
            const signed = await supabase.storage.from('entrevistas-fotos').createSignedUrl(path, 3600);
            if (fotoPath) {
                await supabase.storage.from('entrevistas-fotos').remove([fotoPath]);
            }
            setFotoPath(path);
            setLocalSignedUrl(bustUrl(signed.data?.signedUrl) ?? null);
            if (onDataUpdated) onDataUpdated();
        } catch (e) {
            alert('Error al subir la foto');
        } finally {
            setUploadingFoto(false);
        }
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!nombre.trim() || !cedula.trim()) {
            alert('El nombre y la cédula son requeridos');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('entrevistas')
                .update({
                    nombre: nombre.trim(),
                    cedula: cedula.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', graduado.id);

            if (error) throw error;
            setIsFlipped(false);
            if (onDataUpdated) onDataUpdated();
        } catch (error: any) {
            alert('Error al guardar datos: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNombre(graduado.nombre);
        setCedula(graduado.cedula || '');
        setIsFlipped(false);
    };

    const avatar = localSignedUrl || generateAvatar(nombre);

    return (
        <div className="card-container">
            <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
                
                {/* CARA FRONTAL: Vista normal de la tarjeta */}
                <div 
                    className="card-front cursor-pointer select-none"
                    onClick={() => setIsFlipped(true)}
                    style={{ pointerEvents: isFlipped ? 'none' : 'auto', zIndex: isFlipped ? 10 : 20 }}
                >
                    <div className="group relative w-full h-full rounded-[2rem] p-[2px] overflow-hidden">
                        {/* Animated Gradient Border */}
                        <div className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(245,158,11,1)_360deg)] animate-[spin_4s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="absolute inset-[-50%] bg-[conic-gradient(from_180deg,transparent_0_340deg,rgba(252,211,77,1)_360deg)] animate-[spin_4s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        {/* Inner Card Background */}
                        <div className="absolute inset-[2px] bg-gradient-to-br from-slate-900 via-slate-900 to-[#1a1625] rounded-[2rem] z-10" />

                        {/* Glowing Accent */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/20 rounded-full blur-[40px] z-10 pointer-events-none group-hover:bg-amber-400/30 transition-colors duration-700" />

                        <div className="relative z-20 h-full p-6 flex flex-col items-center justify-between">
                            {/* Header Section */}
                            <div className="w-full flex justify-center items-center relative mb-4">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                </div>
                            </div>

                            {/* Avatar Section */}
                            <div className="relative mb-2 shrink-0">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-amber-200 via-amber-500 to-yellow-600 rounded-full opacity-30 blur-md group-hover:opacity-60 transition-all duration-700 scale-95 group-hover:scale-105" />
                                <div className="relative w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-amber-200 via-yellow-500 to-amber-700">
                                    <img
                                        src={avatar}
                                        alt={nombre}
                                        className="w-full h-full rounded-full object-cover border-[3px] border-slate-900 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-slate-800"
                                    />
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-600 to-yellow-500 rounded-full shadow-lg border border-amber-300/30 flex items-center gap-1.5 transform group-hover:-translate-y-1 transition-transform duration-500">
                                    <Star size={10} className="fill-white text-white" />
                                    <span className="text-[10px] font-black text-white tracking-widest uppercase">Graduado</span>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="flex-1 w-full flex flex-col items-center justify-center mt-4">
                                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-300 text-center leading-tight mb-1 group-hover:from-amber-100 group-hover:to-amber-300 transition-all duration-500 line-clamp-2 px-2">
                                    {nombre}
                                </h3>
                                <p className="text-slate-500 text-sm font-medium tracking-wide">ID: {cedula}</p>
                            </div>

                            {/* Footer Data */}
                            <div className="w-full shrink-0 pt-4 mt-2 border-t border-white/5 flex flex-col gap-2.5 relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                                <div className="flex items-center justify-center w-full px-2 gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center border border-white/10 shrink-0 shadow-inner">
                                        <GraduationCap size={16} className="text-amber-400" />
                                    </div>
                                    {graduado.maestro && (
                                        <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider line-clamp-2 text-left leading-tight">
                                            {graduado.maestro.nombre}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARA TRASERA: Formulario de edición */}
                <div 
                    className="card-back"
                    style={{ pointerEvents: isFlipped ? 'auto' : 'none', zIndex: isFlipped ? 20 : 10 }}
                >
                    <div className="relative w-full h-full rounded-[2rem] p-[2px] overflow-hidden">
                        {/* Background */}
                        <div className="absolute inset-[2px] bg-gradient-to-br from-slate-950 via-slate-900 to-[#1e192b] rounded-[2rem] z-10 border border-amber-500/10" />
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/15 rounded-full blur-[40px] z-10 pointer-events-none" />

                        <div className="relative z-20 h-full p-5 flex flex-col items-center justify-between">
                            
                            {/* Titulo Edición */}
                            <div className="w-full text-center border-b border-white/5 pb-2">
                                <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">Editar Graduado</span>
                            </div>

                            {/* Edición de Foto */}
                            <div className="relative shrink-0 my-1 group/photo">
                                <div className={`relative w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-amber-200 via-yellow-500 to-amber-700 ${uploadingFoto ? 'animate-pulse' : ''}`}>
                                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 relative border border-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                                        <img 
                                            src={avatar} 
                                            alt="Avatar edición" 
                                            className="w-full h-full object-cover" 
                                        />
                                        {/* Overlay de edición */}
                                        <div 
                                            onClick={(e) => { e.stopPropagation(); inputFotoRef.current?.click(); }}
                                            className="absolute inset-0 bg-black/60 opacity-100 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-[1px] hover:bg-black/80"
                                        >
                                            <Edit2 className="text-amber-400 drop-shadow-md" size={14} />
                                        </div>
                                    </div>
                                </div>
                                <input 
                                    ref={inputFotoRef} 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => { e.stopPropagation(); e.target.files?.[0] && handleChangeFoto(e.target.files[0]); }} 
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>

                            {/* Formulario */}
                            <div className="w-full flex-1 flex flex-col justify-center gap-3 px-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Nombre..."
                                        className="w-full rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 px-3 py-1.5 text-xs shadow-inner"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cédula / Identificación</label>
                                    <input
                                        type="text"
                                        value={cedula}
                                        onChange={(e) => setCedula(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Cédula..."
                                        className="w-full rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 px-3 py-1.5 text-xs shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Botones de Acción */}
                            <div className="w-full flex gap-2 pt-2.5 mt-1 border-t border-white/5 shrink-0 px-2 pb-1.5">
                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="flex-1 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-[9px] font-black uppercase tracking-wider hover:bg-slate-800/50 transition-colors"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-black text-[9px] uppercase tracking-wider shadow-lg shadow-amber-900/30 hover:from-amber-500 hover:to-yellow-400 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                                >
                                    {saving && <Loader2 size={10} className="animate-spin" />}
                                    {saving ? 'Guardando' : 'Guardar'}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
