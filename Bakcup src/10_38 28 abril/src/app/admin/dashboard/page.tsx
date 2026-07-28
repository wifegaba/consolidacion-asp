'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Users,
    GraduationCap,
    TrendingUp,
    Calendar,
    BookOpen,
    Award,
    Activity,
    Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
    totalEstudiantes: number;
    totalMaestros: number;
    estudiantesActivos: number;
    estudiantesPromovidos: number;
    promedioNotas: number;
    tasaAsistencia: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats>({
        totalEstudiantes: 0,
        totalMaestros: 0,
        estudiantesActivos: 0,
        estudiantesPromovidos: 0,
        promedioNotas: 0,
        tasaAsistencia: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setStats({
                totalEstudiantes: 523,
                totalMaestros: 42,
                estudiantesActivos: 487,
                estudiantesPromovidos: 156,
                promedioNotas: 8.7,
                tasaAsistencia: 92.3
            });
            setIsLoading(false);
        }, 1000);
    }, []);

    // Estilo "Ice Glass" - Fresco, limpio. Fondo dinámico.
    const liquidGlassCss = `
        .ice-card {
            position: relative;
            /* El fondo se define inline para cada color */
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            
            /* Bordes ultra redondeados */
            border-radius: 32px;
            
            /* Borde sutil */
            border: 1px solid rgba(255, 255, 255, 0.6);
            
            /* Sombra suave */
            box-shadow: 
                0 20px 40px -10px rgba(0,0,0,0.05),
                0 0 0 1px rgba(255,255,255,0.5);
                
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ice-card:hover {
            transform: translateY(-5px);
            /* Sombra más marcada al hover */
            box-shadow: 
                0 30px 60px -12px rgba(0,0,0,0.1),
                inset 0 0 0 1px rgba(255,255,255,0.8);
        }

        /* Efecto de destello "Glossy" */
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
            value: stats.totalEstudiantes,
            icon: Users,
            trend: '+5.2%',
            // Ice Blue
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #EFF6FF 50%, #BFDBFE 100%)',
            iconBg: 'bg-blue-100 text-blue-600',
            trendColor: 'text-blue-700 bg-blue-100'
        },
        {
            title: 'Total Maestros',
            value: stats.totalMaestros,
            icon: GraduationCap,
            trend: '+2.1%',
            // Ice Purple
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #FAF5FF 50%, #E9D5FF 100%)',
            iconBg: 'bg-purple-100 text-purple-600',
            trendColor: 'text-purple-700 bg-purple-100'
        },
        {
            title: 'Estudiantes Activos',
            value: stats.estudiantesActivos,
            icon: Activity,
            trend: '+4.8%',
            // Ice Cyan (Original)
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #ECFEFF 50%, #A5F3FC 100%)',
            iconBg: 'bg-cyan-100 text-cyan-600',
            trendColor: 'text-cyan-700 bg-cyan-100'
        },
        {
            title: 'Promovidos',
            value: stats.estudiantesPromovidos,
            icon: Award,
            trend: '+12%',
            // Ice Amber
            glassGradient: 'linear-gradient(180deg, #FFFFFF 10%, #FFFBEB 50%, #FDE68A 100%)',
            iconBg: 'bg-amber-100 text-amber-600',
            trendColor: 'text-amber-700 bg-amber-100'
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-screen bg-[#F5F8FA] relative overflow-hidden font-sans text-slate-800"
        >
            <style jsx global>{liquidGlassCss}</style>

            {/* Fondo extremadamente sutil y limpio */}
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white to-transparent pointer-events-none" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-blue-100/40 blur-[150px] pointer-events-none" />

            {/* Navbar Clean */}
            <div className="sticky top-0 z-50 px-6 py-4 flex justify-center">
                <div className="liquid-panel flex items-center justify-between px-6 py-3 w-full max-w-6xl">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-2 md:px-4 py-2 rounded-xl hover:bg-slate-100 transition-all font-medium text-slate-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="hidden md:block">Volver</span>
                    </button>

                    <h1 className="text-lg font-bold text-slate-800 block tracking-tight md:absolute md:left-1/2 md:-translate-x-1/2">
                        Dashboard Académico
                    </h1>

                    <div className="flex items-center gap-3">

                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 p-[2px] shadow-sm">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-slate-700 text-xs">
                                WG
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 pb-12 relative z-10">
                {isLoading ? (
                    <div className="flex justify-center items-center h-[50vh]">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-cyan-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-8 mt-4">

                        {/* 1. Ice Glass Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {cards.map((card, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="ice-card p-6 group flex flex-col items-center text-center justify-between min-h-[180px] w-full max-w-[320px] mx-auto"
                                    style={{ background: card.glassGradient }}
                                >
                                    <div className="gloss-highlight"></div>

                                    {/* Botón de opciones (flotante esquina superior derecha) */}
                                    <div className="absolute top-5 right-5 z-20 opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
                                        <div className="w-1 h-1 bg-slate-500 rounded-full box-content border-[2px] border-transparent"></div>
                                    </div>

                                    {/* Header: Icono Centrado y más grande */}
                                    <div className={`mb-3 w-14 h-14 rounded-2xl flex items-center justify-center ${card.iconBg} shadow-sm relative z-10`}>
                                        <card.icon className="w-7 h-7" />
                                    </div>

                                    {/* Cuerpo de información Centrado */}
                                    <div className="relative z-10 w-full mb-4 flex-1 flex flex-col justify-center">
                                        <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">{card.title}</h3>
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                            <span className="text-4xl font-black text-slate-800 tracking-tight">
                                                {card.value}
                                            </span>
                                        </div>
                                        <div className="flex justify-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${card.trendColor} flex items-center shadow-sm w-fit`}>
                                                <TrendingUp className="w-3 h-3 mr-1" />
                                                {card.trend}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Botón de acción inferior Centrado */}
                                    <div className="w-full relative z-10 mt-2">
                                        <button className="w-full py-2.5 rounded-xl bg-white/60 hover:bg-white border border-white/60 text-xs font-bold text-slate-600 transition-all shadow-sm flex items-center justify-center gap-2 group-hover:shadow-md">
                                            Ver detalles
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* 2. Main Panels */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Distribución */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="liquid-panel lg:col-span-2 p-8"
                            >
                                <h2 className="text-xl font-bold text-slate-800 mb-6">Distribución Académica</h2>
                                <div className="space-y-5">
                                    {[
                                        { label: "Restauración 1", val: 156, color: "bg-cyan-400" },
                                        { label: "Fundamentos 1", val: 134, color: "bg-blue-400" },
                                        { label: "Fundamentos 2", val: 98, color: "bg-indigo-400" },
                                        { label: "Restauración 2", val: 87, color: "bg-violet-400" },
                                    ].map((item, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
                                                <span>{item.label}</span>
                                                <span className="text-slate-800 font-bold">{item.val}</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(item.val / 523) * 100}%` }}
                                                    transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                                                    className={`h-full ${item.color} rounded-full relative shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Metrics */}
                            <div className="flex flex-col gap-6">
                                <motion.div className="ice-card p-6 flex flex-col items-center justify-center flex-1">
                                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 text-2xl font-bold mb-3 border-4 border-white shadow-sm">
                                        8.7
                                    </div>
                                    <p className="text-slate-500 font-medium">Promedio Global</p>
                                </motion.div>
                                <motion.div className="ice-card p-6 flex flex-col items-center justify-center flex-1">
                                    <div className="relative w-24 h-24 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                                            <circle cx="48" cy="48" r="40" stroke="#06b6d4" strokeWidth="8" fill="transparent" strokeDasharray={251} strokeDashoffset={251 - (251 * stats.tasaAsistencia) / 100} strokeLinecap="round" />
                                        </svg>
                                        <span className="absolute text-lg font-bold text-slate-700">{stats.tasaAsistencia}%</span>
                                    </div>
                                    <p className="text-slate-500 font-medium mt-2">Asistencia</p>
                                </motion.div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </motion.div>
    );
}
