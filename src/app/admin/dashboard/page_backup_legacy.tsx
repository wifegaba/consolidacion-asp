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
    Activity
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
        // Aquí implementarás la llamada real a tu API
        // Por ahora, uso datos de ejemplo
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

    const statCards = [
        {
            title: 'Total Estudiantes',
            value: stats.totalEstudiantes,
            icon: Users,
            color: 'emerald',
            gradient: 'from-emerald-500 to-teal-600',
            bgGradient: 'from-emerald-50 to-teal-50'
        },
        {
            title: 'Total Maestros',
            value: stats.totalMaestros,
            icon: GraduationCap,
            color: 'blue',
            gradient: 'from-blue-500 to-indigo-600',
            bgGradient: 'from-blue-50 to-indigo-50'
        },
        {
            title: 'Estudiantes Activos',
            value: stats.estudiantesActivos,
            icon: Activity,
            color: 'green',
            gradient: 'from-green-500 to-emerald-600',
            bgGradient: 'from-green-50 to-emerald-50'
        },
        {
            title: 'Promovidos',
            value: stats.estudiantesPromovidos,
            icon: Award,
            color: 'purple',
            gradient: 'from-purple-500 to-pink-600',
            bgGradient: 'from-purple-50 to-pink-50'
        }
    ];

    const metricCards = [
        {
            title: 'Promedio de Notas',
            value: stats.promedioNotas.toFixed(1),
            suffix: '/10',
            icon: BookOpen,
            color: 'amber',
            gradient: 'from-amber-500 to-orange-600'
        },
        {
            title: 'Tasa de Asistencia',
            value: stats.tasaAsistencia.toFixed(1),
            suffix: '%',
            icon: Calendar,
            color: 'cyan',
            gradient: 'from-cyan-500 to-blue-600'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 shadow-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 transition-all duration-300 hover:scale-105 text-white"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Volver</span>
                        </button>
                        <div className="text-center flex-1">
                            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                                Dashboard de Proceso Transformacional
                            </h1>
                            <p className="text-emerald-50 mt-1">
                                Métricas en Tiempo Real de Estudiantes y Maestros
                            </p>
                        </div>
                        <div className="w-[120px]"></div> {/* Spacer for centering */}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                        >
                            {statCards.map((card, index) => (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bgGradient} p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-white/50`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-gray-600 text-sm font-medium mb-2">
                                                {card.title}
                                            </p>
                                            <p className={`text-4xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                                                {card.value}
                                            </p>
                                        </div>
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                                            <card.icon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-1 text-sm text-gray-600">
                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                        <span className="text-green-600 font-medium">+5.2%</span>
                                        <span>vs mes anterior</span>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>

                        {/* Metrics Cards */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            {metricCards.map((card, index) => (
                                <div
                                    key={card.title}
                                    className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {card.title}
                                        </h3>
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                                            <card.icon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-5xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                                            {card.value}
                                        </span>
                                        <span className="text-2xl text-gray-500">{card.suffix}</span>
                                    </div>
                                    <div className="mt-6 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-gradient-to-r ${card.gradient} transition-all duration-1000`}
                                            style={{ width: `${card.suffix === '%' ? card.value : (parseFloat(card.value) / 10) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </motion.div>

                        {/* Charts Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                        >
                            {/* Distribución por Etapas */}
                            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/50">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                    Distribución por Etapas
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        { name: 'Restauración 1', value: 156, color: 'emerald' },
                                        { name: 'Fundamentos 1', value: 134, color: 'blue' },
                                        { name: 'Fundamentos 2', value: 98, color: 'indigo' },
                                        { name: 'Restauración 2', value: 87, color: 'purple' },
                                        { name: 'Escuela de Siervos', value: 48, color: 'pink' }
                                    ].map((etapa) => (
                                        <div key={etapa.name} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-gray-700">{etapa.name}</span>
                                                <span className="text-gray-600">{etapa.value} estudiantes</span>
                                            </div>
                                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full bg-gradient-to-r from-${etapa.color}-500 to-${etapa.color}-600 transition-all duration-1000`}
                                                    style={{ width: `${(etapa.value / 523) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actividad Reciente */}
                            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/50">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                    Resumen de Actividad
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">Nuevas Matrículas</p>
                                                <p className="text-sm text-gray-600">Esta semana</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-bold text-emerald-600">24</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                                <Award className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">Estudiantes Promovidos</p>
                                                <p className="text-sm text-gray-600">Este mes</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-bold text-blue-600">18</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                                <GraduationCap className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">Maestros Nuevos</p>
                                                <p className="text-sm text-gray-600">Este mes</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-bold text-purple-600">6</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
