'use client';

import React from 'react';
import { Users, UserPlus, ClipboardList, GraduationCap, Folder, LogOut, type LucideIcon } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

// Colores para las carpetas/tarjetas de secciones
const sectionColors = {
    blue: 'text-blue-500 fill-blue-100/50',
    emerald: 'text-emerald-500 fill-emerald-100/50',
    indigo: 'text-indigo-500 fill-indigo-100/50',
    purple: 'text-purple-500 fill-purple-100/50',
    amber: 'text-amber-500 fill-amber-100/50',
    default: 'text-gray-500 fill-gray-100/50'
};

// Animaciones premium para las tarjetas de secciones
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const LIST_WRAPPER_VARIANTS: Variants = {
    hidden: {
        transition: { staggerChildren: 0.035, staggerDirection: -1 }
    },
    visible: {
        transition: { delayChildren: 0.12, staggerChildren: 0.075 }
    }
};

const SECTION_ITEM_VARIANTS: Variants = {
    hidden: { opacity: 0, x: 28, y: 14, scale: 0.97 },
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: { duration: 0.5, ease: EASE_SMOOTH }
    }
};

type AdminTab = 'bienvenida' | 'matricular' | 'maestros' | 'consultar' | 'promovidos';

interface AdminSection {
    id: AdminTab;
    title: string;
    icon: LucideIcon;
    color: keyof typeof sectionColors;
    description: string;
    badge?: number;
}

interface WelcomePanelAdminProps {
    userName: string;
    userRole: string | null | undefined;
    onSelectSection: (sectionId: AdminTab) => void;
    onLogout: () => void;
    isMultiRole: boolean;
    estudiantesPendientesCount: number;
    promovidosCount: number;
    currentUser: {
        cursosAcceso?: string[];
        rol?: string;
        diaAcceso?: string;
    };
    className?: string;
    isActive?: boolean;
}

export default function WelcomePanelAdmin({
    userName,
    userRole,
    onSelectSection,
    onLogout,
    isMultiRole,
    estudiantesPendientesCount,
    promovidosCount,
    currentUser,
    className = '',
    isActive = true
}: WelcomePanelAdminProps) {
    const cardDelay = 100;
    const sectionsContainerDelay = cardDelay + 100;
    const animationDuration = 500;
    const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

    // Definir secciones administrativas
    const sections: AdminSection[] = [
        {
            id: 'maestros',
            title: 'Maestros',
            icon: Users,
            color: 'blue',
            description: 'Gestionar maestros PTM'
        },
        {
            id: 'matricular',
            title: 'Matricular',
            icon: UserPlus,
            color: 'emerald',
            description: 'Inscribir estudiantes',
            badge: estudiantesPendientesCount
        },
        {
            id: 'consultar',
            title: 'Estudiantes',
            icon: ClipboardList,
            color: 'indigo',
            description: 'Consultar y gestionar'
        },
        {
            id: 'promovidos',
            title: 'Promovidos',
            icon: GraduationCap,
            color: 'purple',
            description: 'Ver estudiantes promovidos',
            badge: promovidosCount
        }
    ];

    // Filtrar secciones según permisos del usuario
    const filteredSections = sections.filter(section => {
        // Ocultar Promovidos para usuarios exclusivos de Restauración 1
        if (section.id === 'promovidos') {
            return !(
                currentUser.cursosAcceso?.length === 1 &&
                currentUser.cursosAcceso[0] === 'Restauración 1' &&
                currentUser.rol !== 'Director'
            );
        }
        return true;
    });

    return (
        <div className={`relative flex w-full h-full flex-col items-center justify-center px-4 md:px-8 text-center ${className}`}>
            {/* Tarjeta de Bienvenida */}
            <div
                className={`
          group relative rounded-3xl border border-white/70 bg-white/55 px-6 md:px-10 pt-6 pb-5 md:pt-7 md:pb-6 shadow-xl backdrop-blur-xl w-full max-w-md md:w-auto md:min-w-[26rem] md:max-w-2xl
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
                style={{
                    transitionDelay: `${isActive ? cardDelay : 0}ms`,
                }}
            >
                {/* Premium Background Gradients */}
                <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-transparent blur-[50px] pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-tl from-cyan-500/30 via-blue-400/20 to-transparent blur-[50px] pointer-events-none" />

                {/* Icono de Administración */}
                <div className="w-12 h-12 md:w-14 md:h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Users className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={2.5} />
                </div>

                <h1 className="mt-3 text-base md:text-lg font-semibold tracking-tight text-gray-900 flex flex-col items-center gap-0.5">
                    <span>Bienvenido</span>
                    {userName && (
                        <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent animate-gradient-x pb-0.5">
                            {userName}
                        </span>
                    )}
                </h1>

                {/* Mostrar rol o mensaje de coordinador según días de acceso */}
                {(() => {
                    const hasDiaAcceso = currentUser.diaAcceso && currentUser.diaAcceso !== 'Todos';
                    const etapa = currentUser.cursosAcceso?.[0]; // Primera etapa asignada

                    if (hasDiaAcceso && etapa) {
                        // Detectar si hay múltiples días (contiene "," o "y")
                        const multipleDias = currentUser.diaAcceso!.includes(',') || currentUser.diaAcceso!.includes(' y ');
                        const diaLabel = multipleDias ? 'Días' : 'Día';

                        return (
                            <div className="mt-1.5 text-center">
                                <p className="text-sm md:text-base text-indigo-700 font-semibold">
                                    Coordinador Académico
                                </p>
                                <p className="text-xs md:text-sm text-indigo-600 font-medium mt-0.5">
                                    {etapa} - {diaLabel} {currentUser.diaAcceso}
                                </p>
                            </div>
                        );
                    } else if (userRole) {
                        return (
                            <p className="mt-1.5 text-sm md:text-base text-indigo-700 font-medium">
                                {userRole}
                            </p>
                        );
                    }
                    return null;
                })()}

                <p className="mt-2 max-w-sm text-xs md:text-sm text-gray-700 mx-auto leading-relaxed">
                    Selecciona un panel para empezar a gestionar tu academia.
                </p>
            </div>

            {/* Título Paneles */}
            <h2
                className={`
          text-base md:text-lg font-semibold mt-5 md:mt-6 mb-4 md:mb-5 text-gray-800
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
        `}
                style={{ transitionDelay: `${isActive ? sectionsContainerDelay - 50 : 0}ms` }}
            >
                Tus Paneles de Gestión
            </h2>

            {/* Contenedor de Tarjetas de Secciones */}
            <div className="w-full max-w-full md:max-w-4xl px-2 md:px-0">
                <div
                    className={`
            transition-opacity duration-${animationDuration} ease-[${easing}]
            ${isActive ? 'opacity-100' : 'opacity-0'}
          `}
                    style={{ transitionDelay: `${isActive ? sectionsContainerDelay : 0}ms` }}
                >
                    <motion.div
                        className="flex flex-wrap md:flex-nowrap items-center justify-center gap-3 md:gap-5 w-full"
                        variants={LIST_WRAPPER_VARIANTS}
                        initial="hidden"
                        animate={isActive ? "visible" : "hidden"}
                    >
                        {filteredSections.map((section) => (
                            <motion.div key={section.id} variants={SECTION_ITEM_VARIANTS}>
                                <SectionCard
                                    title={section.title}
                                    icon={section.icon}
                                    color={section.color}
                                    description={section.description}
                                    badge={section.badge}
                                    onSelect={() => onSelectSection(section.id)}
                                />
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Botón Premium de Cambiar Perfil */}
                    <motion.div
                        className="flex justify-center mt-6"
                        initial={{ opacity: 0, y: 10 }}
                        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <button
                            onClick={() => {
                                if (isMultiRole) {
                                    window.location.href = '/login/portal';
                                } else {
                                    onLogout();
                                }
                            }}
                            className="group relative flex items-center gap-2 px-5 py-2.5 rounded-2xl
                bg-gradient-to-r from-white/60 via-white/40 to-white/60 
                border border-white/60 backdrop-blur-xl shadow-lg
                hover:from-white/70 hover:via-white/50 hover:to-white/70
                hover:shadow-xl hover:shadow-indigo-500/20 hover:border-indigo-400/40
                hover:-translate-y-0.5
                active:translate-y-0 active:scale-95
                transition-all duration-300 ease-out"
                        >
                            <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
                                Cambiar Perfil
                            </span>
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

// Componente de Tarjeta de Sección
interface SectionCardProps {
    title: string;
    icon: LucideIcon;
    color: keyof typeof sectionColors;
    description: string;
    badge?: number;
    onSelect: () => void;
}

function SectionCard({
    title,
    icon: Icon,
    color = 'blue',
    description,
    badge,
    onSelect
}: SectionCardProps) {
    const colorClasses = sectionColors[color in sectionColors ? color : 'default'];
    const appleEase = 'ease-[cubic-bezier(0.2,0.8,0.2,1)]';
    const duration = 'duration-300';

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`
        relative flex flex-col items-center justify-start w-32 h-32 md:w-40 md:h-40 
        rounded-3xl p-3 md:p-4 
        shadow-lg shadow-black/5
        transition-all ${duration} ${appleEase}
        hover:scale-[1.03] hover:-translate-y-1.5 
        hover:shadow-xl hover:shadow-blue-500/20
        active:scale-[0.98] active:translate-y-0
        focus:outline-none focus:ring-4 focus:ring-blue-400/25 group text-center 
        flex-shrink-0
        bg-gradient-to-br from-white/90 via-white/60 to-white/80 border border-white/60 backdrop-blur-sm
      `}
        >
            <Folder
                className={`
          w-20 h-20 md:w-24 md:h-24 mb-1.5 md:mb-2 ${colorClasses} 
          transition-all ${duration} ${appleEase}
          drop-shadow-md 
          group-hover:drop-shadow-lg 
          group-hover:-translate-y-1
        `}
                strokeWidth={1}
            />

            <h4
                className={`
          text-xs md:text-sm font-semibold text-gray-800 w-full 
          transition-colors ${duration} ease-out
          group-hover:text-indigo-600
        `}
            >
                {title}
            </h4>

            {badge !== undefined && badge > 0 && (
                <div className="absolute top-6 right-6 md:top-8 md:right-8 z-10 flex h-5 min-w-[20px] md:h-6 md:min-w-[24px] items-center justify-center rounded-full bg-rose-500/90 border border-rose-400/50 px-1.5 md:px-2 text-[10px] md:text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                    {badge}
                </div>
            )}
        </button>
    );
}
