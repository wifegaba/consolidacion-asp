'use client';

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import {
    Users,
    GraduationCap,
    TrendingUp,
    Activity,
    Award,
    ArrowLeft,
    X,
    Check,
    Mail,
    Search,
    Sparkles
} from 'lucide-react';
import { GlassCard } from '../page';
import type { Estudiante, Inscripcion } from '../page';

export interface DashboardStats {
    totalEstudiantes: number;
    totalMaestros: number;
    estudiantesActivos: number;
    promovidos: number;
    promedioNotas: number;
    tasaAsistencia: number;
    distribucion: { label: string; val: number; color?: string; id: number }[];
}

interface PanelDashboardProps {
    onClose?: () => void;
    stats?: DashboardStats;
    estudiantes?: Estudiante[];
    inscripciones?: Inscripcion[];
    fotoUrls?: Record<string, string>;
}

// Componente para animar números
function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
    const motionValue = useMotionValue(0);
    const rounded = useTransform(motionValue, (latest) => Math.round(latest));
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const controls = animate(motionValue, value, {
            duration: 2,
            delay: delay,
            ease: [0.43, 0.13, 0.23, 0.96]
        });

        const unsubscribe = rounded.on('change', (latest) => {
            setDisplayValue(latest);
        });

        return () => {
            controls.stop();
            unsubscribe();
        };
    }, [value, delay, motionValue, rounded]);

    return <span>{displayValue}</span>;
}

export default function PanelDashboard({ onClose, stats, estudiantes = [], inscripciones = [], fotoUrls = {} }: PanelDashboardProps) {
    // Estado para el modal de detalles
    const [selectedCourse, setSelectedCourse] = useState<{ id: number; name: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Resetear búsqueda al cerrar o cambiar curso
    useEffect(() => {
        if (!selectedCourse) setSearchTerm('');
    }, [selectedCourse]);

    // Datos reales o defaults
    const data = stats || {
        totalEstudiantes: 0,
        totalMaestros: 0,
        estudiantesActivos: 0,
        promovidos: 0,
        promedioNotas: 8.7,
        tasaAsistencia: 92.3,
        distribucion: []
    };

    const isLoading = false;

    // Helper para colores - Restaurando paletas Premium originales
    const getColors = (baseColor?: string, index: number = 0) => {
        const defaultPalettes = [
            ["#06b6d4", "#3b82f6", "#8b5cf6"], // Cian-Azul
            ["#fbbf24", "#fb923c", "#f43f5e"], // Ambar-Rojo
            ["#6366f1", "#8b5cf6", "#a855f7"], // Indigo-Morado
            ["#a855f7", "#d946ef", "#ec4899"], // Morado-Rosa
            ["#10b981", "#059669", "#06b6d4"]  // Esmeralda-Cian
        ];
        // Usamos siempre las paletas de diseño para mantener el estilo premium de los botones
        return defaultPalettes[index % defaultPalettes.length];
    };

    // Estilo "Ice Glass" - Fresco, limpio. Fondo dinámico.
    const liquidGlassCss = `
        .ice-card {
            position: relative;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 32px;
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 
                0 20px 40px -10px rgba(0,0,0,0.05),
                0 0 0 1px rgba(255,255,255,0.5);
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ice-card:hover {
            transform: translateY(-5px);
            box-shadow: 
                0 30px 60px -12px rgba(0,0,0,0.1),
                inset 0 0 0 1px rgba(255,255,255,0.8);
        }

        .gloss-highlight {
            position: absolute;
            top: -20%;
            right: -20%;
            width: 80%;
            height: 80%;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
            opacity: 0.5;
            pointer-events: none;
        }

        .liquid-panel {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(30px);
            border: 1px solid rgba(255, 255, 255, 0.6);
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }
    `;

    const cards = [
        {
            title: 'Total Estudiantes',
            value: data.totalEstudiantes,
            icon: Users,
            trend: '+5.2%',
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #EFF6FF 50%, #BFDBFE 100%)',
            iconBg: 'bg-blue-100 text-blue-600',
            trendColor: 'text-blue-700 bg-blue-100'
        },
        {
            title: 'Total Maestros',
            value: data.totalMaestros,
            icon: GraduationCap,
            trend: '+2.1%',
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #FAF5FF 50%, #E9D5FF 100%)',
            iconBg: 'bg-purple-100 text-purple-600',
            trendColor: 'text-purple-700 bg-purple-100'
        },
        {
            title: 'Estudiantes Activos',
            value: data.estudiantesActivos,
            icon: Activity,
            trend: '+4.8%',
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #ECFEFF 50%, #A5F3FC 100%)',
            iconBg: 'bg-cyan-100 text-cyan-600',
            trendColor: 'text-cyan-700 bg-cyan-100'
        },
        {
            title: 'Promovidos',
            value: data.promovidos,
            icon: Award,
            trend: '+12%',
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #FFFBEB 50%, #FDE68A 100%)',
            iconBg: 'bg-amber-100 text-amber-600',
            trendColor: 'text-amber-700 bg-amber-100'
        }
    ];

    return (
        <div className="h-full w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-3 md:p-4 rounded-[2rem] relative overflow-y-auto border border-white/60 shadow-xl">
            <style jsx global>{liquidGlassCss}</style>

            {/* Botón Volver - Flotante Absolute en la esquina */}
            {onClose && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={onClose}
                    className="absolute top-4 left-4 z-50 flex items-center justify-center p-2 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200/50 shadow-sm backdrop-blur-sm transition-all"
                    title="Volver"
                >
                    <ArrowLeft className="w-5 h-5" />
                </motion.button>
            )}

            {/* Título Premium Dashboard */}
            <div className="absolute top-0 left-0 w-full h-14 flex items-center justify-center z-40 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="pointer-events-auto flex items-center gap-2 bg-white/30 backdrop-blur-md px-5 py-1 rounded-full border border-white/40 shadow-sm mt-3"
                >
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <h1 className="text-base md:text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 via-indigo-600 to-slate-800 tracking-tight">
                        Dashboard Académico
                    </h1>
                </motion.div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-full">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-cyan-500 rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-3 pt-12 pb-1">

                    {/* 1. Ice Glass Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {cards.map((card, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="ice-card p-3 group flex flex-col items-center text-center justify-between min-h-[130px] w-full max-w-[280px] mx-auto"
                                style={{ background: card.glassGradient }}
                            >
                                <div className="gloss-highlight"></div>

                                {/* Botón de opciones (flotante esquina superior derecha) */}
                                <div className="absolute top-3 right-3 z-20 opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
                                    <div className="w-1 h-1 bg-slate-500 rounded-full box-content border-[2px] border-transparent"></div>
                                </div>

                                {/* Header: Icono Centrado */}
                                <div className={`mb-2 w-12 h-12 rounded-2xl flex items-center justify-center ${card.iconBg} shadow-sm relative z-10`}>
                                    <card.icon className="w-6 h-6" />
                                </div>

                                {/* Cuerpo de información Centrado */}
                                <div className="relative z-10 w-full mb-3 flex-1 flex flex-col justify-center">
                                    <h3 className="text-slate-500 font-bold text-[10px] uppercase tracking-wider mb-1">{card.title}</h3>
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <span className="text-3xl font-black text-slate-800 tracking-tight">
                                            <AnimatedNumber value={card.value} delay={0.3 + idx * 0.15} />
                                        </span>
                                    </div>
                                    <div className="flex justify-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${card.trendColor} flex items-center shadow-sm w-fit`}>
                                            <TrendingUp className="w-2.5 h-2.5 mr-1" />
                                            {card.trend}
                                        </span>
                                    </div>
                                </div>

                                {/* Botón de acción inferior Centrado */}
                                <div className="w-full relative z-10">
                                    <button className="w-full py-1.5 rounded-xl bg-white/60 hover:bg-white border border-white/60 text-[10px] font-bold text-slate-600 transition-all shadow-sm flex items-center justify-center gap-2 group-hover:shadow-md">
                                        Ver detalles
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* 2. Main Panels - Grid ajustado para distribución más compacta */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                        {/* Distribución - Ahora con tarjetas circulares */}
                        {/* CAPA BLANCA: liquid-panel */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-slate-50 lg:col-span-3 p-4 pb-5 flex flex-col w-full h-full rounded-[2.5rem] border border-white/60 relative overflow-hidden"
                            style={{
                                boxShadow: '20px 20px 60px #d1d9e6, -20px -20px 60px #ffffff'
                            }}
                        >
                            <h2 className="text-sm font-bold text-slate-800 mb-2">Distribución Académica</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {data.distribucion.map((item, i) => {
                                    const percentage = data.totalEstudiantes > 0 ? Math.round((item.val / data.totalEstudiantes) * 100) : 0;
                                    const circumference = 2 * Math.PI * 26;
                                    const offset = circumference - (percentage / 100) * circumference;
                                    const colors = getColors(item.color, i);

                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                                            className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/30 transition-colors ${i === 4 ? 'col-span-2 justify-self-center lg:col-span-1 lg:col-start-2 lg:justify-self-auto' : ''}`}
                                        >
                                            {/* Círculo de progreso con efecto neumorfismo tallado */}
                                            <div
                                                className="relative w-12 h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-white/50 to-slate-50/50 backdrop-blur-sm"
                                                style={{
                                                    boxShadow: `
                                                        inset 3px 3px 6px rgba(0, 0, 0, 0.1),
                                                        inset -3px -3px 6px rgba(255, 255, 255, 0.8),
                                                        2px 2px 4px rgba(0, 0, 0, 0.05)
                                                    `
                                                }}
                                            >
                                                <svg className="w-full h-full -rotate-90">
                                                    {/* Círculo de fondo */}
                                                    <circle
                                                        cx="24"
                                                        cy="24"
                                                        r="20"
                                                        stroke="#f1f5f9"
                                                        strokeWidth="4"
                                                        fill="transparent"
                                                    />
                                                    {/* Gradiente multi-color premium */}
                                                    <defs>
                                                        <linearGradient id={`premium-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                            <stop offset="0%" stopColor={colors[0]} />
                                                            <stop offset="50%" stopColor={colors[1]} />
                                                            <stop offset="100%" stopColor={colors[2]} />
                                                        </linearGradient>
                                                        {/* Filtro de glow/sombra */}
                                                        <filter id={`glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                                                            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                                            <feFlood floodColor={colors[1]} floodOpacity="0.5" />
                                                            <feComposite in2="blur" operator="in" result="coloredBlur" />
                                                            <feMerge>
                                                                <feMergeNode in="coloredBlur" />
                                                                <feMergeNode in="SourceGraphic" />
                                                            </feMerge>
                                                        </filter>
                                                    </defs>
                                                    <motion.circle
                                                        cx="24"
                                                        cy="24"
                                                        r="20"
                                                        stroke={`url(#premium-gradient-${i})`}
                                                        strokeWidth="4"
                                                        fill="transparent"
                                                        strokeLinecap="round"
                                                        strokeDasharray={2 * Math.PI * 20}
                                                        initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                                                        animate={{ strokeDashoffset: (2 * Math.PI * 20) - (percentage / 100) * (2 * Math.PI * 20) }}
                                                        transition={{ duration: 1.5, delay: 0.6 + i * 0.15, ease: [0.43, 0.13, 0.23, 0.96] }}
                                                        filter={`url(#glow-${i})`}
                                                    />
                                                </svg>
                                                {/* Total de estudiantes en el centro */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <motion.span
                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
                                                        className="text-sm font-bold bg-gradient-to-br from-slate-600 to-slate-800 bg-clip-text text-transparent"
                                                    >
                                                        <AnimatedNumber value={item.val} delay={0.9 + i * 0.2} />
                                                    </motion.span>
                                                </div>
                                            </div>

                                            {/* Información del curso */}
                                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                <p className="text-xs font-semibold text-slate-600 break-words leading-tight">{item.label}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Estudiantes</p>

                                                {/* Botón Detalles con estilo Sutil Premium Coloreado */}
                                                <button
                                                    onClick={() => setSelectedCourse({ id: item.id, name: item.label })}
                                                    className="mt-1 px-3 py-1.5 text-[10px] font-bold backdrop-blur-md border rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] relative overflow-hidden group"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${colors[0]}15, ${colors[1]}05)`,
                                                        borderColor: `${colors[0]}30`,
                                                        color: colors[1]
                                                    }}
                                                >
                                                    {/* Fondo hover sutilmente más intenso */}
                                                    <div
                                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${colors[0]}25, ${colors[1]}15)`
                                                        }}
                                                    ></div>
                                                    <span className="relative z-10">Detalles</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Metrics - Ahora cada uno ocupa 1 columna para estar en una línea horizontal */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-[2rem] flex flex-col items-center justify-between h-full relative overflow-hidden shadow-sm hover:shadow-md transition-all group"
                        >
                            {/* Onda decorativa de fondo - Ámbar */}
                            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none">
                                <svg viewBox="0 0 1440 320" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                                    <path fill="#fbbf24" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                                </svg>
                            </div>

                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-50 to-white flex items-center justify-center text-amber-500 text-xl font-bold mb-1 border-4 border-white shadow-[0_8px_16px_rgba(251,191,36,0.15)] z-10 mt-1">
                                {data.promedioNotas}
                            </div>

                            <div className="text-center z-10 mb-2">
                                <p className="text-slate-700 font-bold text-sm mb-0.5">Promedio Global</p>
                                <p className="text-[10px] text-amber-600/80 font-medium">+0.1 en el último mes</p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-[2rem] flex flex-col items-center justify-between h-full relative overflow-hidden shadow-sm hover:shadow-md transition-all group"
                        >
                            {/* Onda decorativa de fondo - Azul */}
                            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none">
                                <svg viewBox="0 0 1440 320" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                                    <path fill="#06b6d4" fillOpacity="1" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,160C960,139,1056,149,1152,160C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                                </svg>
                            </div>

                            <div className="relative w-20 h-20 flex items-center justify-center z-10 mt-1">
                                <svg className="w-full h-full -rotate-90 filter drop-shadow-md">
                                    <circle cx="40" cy="40" r="32" stroke="#fff" strokeWidth="6" fill="transparent" opacity="0.6" />
                                    <circle cx="40" cy="40" r="32" stroke="#06b6d4" strokeWidth="6" fill="transparent" strokeDasharray={201} strokeDashoffset={201 - (201 * data.tasaAsistencia) / 100} strokeLinecap="round" />
                                </svg>
                                <span className="absolute text-lg font-bold text-slate-700">{data.tasaAsistencia}%</span>
                            </div>

                            <div className="text-center z-10 mb-2">
                                <p className="text-slate-700 font-bold text-sm mb-0.5">Asistencia</p>
                                <p className="text-[10px] text-cyan-600/80 font-medium">+1.2% este mes</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
            {/* MODAL DE ESTUDIANTES PREMIUM */}
            <AnimatePresence>
                {selectedCourse && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
                        onClick={() => setSelectedCourse(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-6xl max-h-[85vh] bg-[#f8fafc] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/60"
                        >
                            {/* Header Modal - Con Search Bar Premium */}
                            <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 relative z-20">
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
                                        <GraduationCap className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 leading-tight">{selectedCourse.name}</h3>
                                        <p className="text-xs text-slate-500 font-medium whitespace-nowrap">Listado de inscritos</p>
                                    </div>
                                </div>

                                {/* Search Bar Style "Ask AI" */}
                                <div className="w-full max-w-md relative group mx-4">
                                    {/* Gradient Border & Glow */}
                                    <div className="absolute -inset-[2px] bg-gradient-to-r from-blue-400 via-indigo-500 to-cyan-400 rounded-full opacity-70 group-hover:opacity-100 blur-[2px] transition duration-500 animate-gradient-x"></div>

                                    {/* Input Container */}
                                    <div className="relative bg-white rounded-full flex items-center px-4 py-2 border border-blue-100">
                                        <input
                                            type="text"
                                            placeholder="Buscar estudiante por nombre o cédula..."
                                            className="w-full bg-transparent outline-none text-slate-600 placeholder-slate-400 text-sm font-medium"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                        {/* Right Icon - Mimicking the "Ask" button style */}
                                        <div className="ml-2 flex items-center gap-1 text-indigo-500">
                                            <Search size={18} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedCourse(null)}
                                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0 absolute top-4 right-4 md:static"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Content Grid */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                                <motion.div
                                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        visible: {
                                            opacity: 1,
                                            transition: {
                                                staggerChildren: 0.08,
                                                delayChildren: 0.2
                                            }
                                        }
                                    }}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {estudiantes
                                        .filter(est => {
                                            // 1. Filtro de búsqueda
                                            if (searchTerm) {
                                                const lowerTerm = searchTerm.toLowerCase();
                                                const match = est.nombre.toLowerCase().includes(lowerTerm) || est.cedula.includes(lowerTerm);
                                                if (!match) return false;
                                            }

                                            // 2. Encontrar inscripcion activa
                                            const insc = inscripciones.find(i =>
                                                i.entrevista_id === est.id &&
                                                i.curso_id === selectedCourse.id &&
                                                (i.estado === 'activo' || i.estado === 'promovido')
                                            );
                                            return !!insc;
                                        })
                                        .map((estudiante) => (
                                            <motion.div
                                                key={estudiante.id}
                                                className="bg-white rounded-[0.8rem] p-0 relative overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 group"
                                                variants={{
                                                    hidden: { opacity: 0, y: 30, scale: 0.95, filter: 'blur(4px)' },
                                                    visible: {
                                                        opacity: 1,
                                                        y: 0,
                                                        scale: 1,
                                                        filter: 'blur(0px)',
                                                        transition: {
                                                            type: "spring",
                                                            stiffness: 120,
                                                            damping: 15
                                                        }
                                                    }
                                                }}
                                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                            >

                                                {/* Triángulo Corner Azul - Más pequeño */}
                                                <div className="absolute top-0 left-0">
                                                    <div className="w-8 h-8 bg-[#0ea5e9] absolute -top-4 -left-4 rotate-45 z-10 shadow-sm"></div>
                                                    <Check className="w-2.5 h-2.5 text-white absolute top-0.5 left-0.5 z-20" strokeWidth={3} />
                                                </div>

                                                {/* Botón Share Mini */}
                                                <button className="absolute top-1.5 right-1.5 text-slate-300 hover:text-[#0ea5e9] transition-colors p-1">
                                                    <Activity className="w-3 h-3" />
                                                </button>

                                                <div className="pt-3 pb-2 px-2 flex flex-col items-center">
                                                    {/* Avatar Mini */}
                                                    <div className="w-12 h-12 rounded-full p-0.5 bg-white shadow-sm mb-1.5 relative z-10 group-hover:scale-105 transition-transform duration-300">
                                                        <img
                                                            src={fotoUrls[estudiante.foto_path || ''] || `https://api.dicebear.com/7.x/initials/svg?seed=${estudiante.nombre}`}
                                                            alt={estudiante.nombre}
                                                            className="w-full h-full rounded-full object-cover bg-slate-50"
                                                        />
                                                        {/* Status Indicator */}
                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#0ea5e9] border-[1.5px] border-white rounded-full shadow-sm"></div>
                                                    </div>

                                                    {/* Nombre y Rol */}
                                                    <h3 className="text-xs font-bold text-slate-800 text-center leading-tight mb-0.5 line-clamp-1 w-full px-1" title={estudiante.nombre}>
                                                        {estudiante.nombre}
                                                    </h3>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">Estudiante</span>

                                                    {/* Detalles List Ultra Compacta (Inline) */}
                                                    <div className="w-full space-y-1 px-1 bg-slate-50/50 rounded-lg p-1.5">
                                                        <div className="flex items-center gap-2 group/item">
                                                            <Users className="w-2.5 h-2.5 text-slate-400 group-hover/item:text-[#0ea5e9]" />
                                                            <span className="text-[9px] text-slate-600 font-medium truncate leading-none">{estudiante.cedula}</span>
                                                        </div>

                                                        <div className="flex items-center gap-2 group/item">
                                                            <Activity className="w-2.5 h-2.5 text-slate-400 group-hover/item:text-[#0ea5e9]" />
                                                            <span className="text-[9px] text-slate-600 font-medium truncate leading-none">{estudiante.telefono || "N/A"}</span>
                                                        </div>

                                                        <div className="flex items-center gap-2 group/item">
                                                            <GraduationCap className="w-2.5 h-2.5 text-slate-400 group-hover/item:text-[#0ea5e9]" />
                                                            <span className="text-[9px] text-slate-600 font-medium truncate leading-none">{estudiante.dia || "General"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}

                                    {estudiantes.filter(est => {
                                        const insc = inscripciones.find(i =>
                                            i.entrevista_id === est.id &&
                                            i.curso_id === selectedCourse.id &&
                                            (i.estado === 'activo' || i.estado === 'promovido')
                                        );
                                        return !!insc;
                                    }).length === 0 && (
                                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                                    <Users className="w-8 h-8 opacity-50" />
                                                </div>
                                                <p className="font-medium">No hay estudiantes inscritos en este nivel</p>
                                            </div>
                                        )}
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
