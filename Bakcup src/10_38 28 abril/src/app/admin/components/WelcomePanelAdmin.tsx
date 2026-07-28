'use client';

import React, { useState } from 'react';
import { Users, UserPlus, ClipboardList, GraduationCap, Folder, LogOut, CheckSquare, Sparkles, type LucideIcon } from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';

// Colores para las carpetas/tarjetas de secciones
const sectionColors = {
    blue: 'text-blue-500 fill-blue-100/50',
    emerald: 'text-emerald-500 fill-emerald-100/50',
    indigo: 'text-indigo-500 fill-indigo-100/50',
    purple: 'text-purple-500 fill-purple-100/50',
    amber: 'text-amber-500 fill-amber-100/50',
    default: 'text-gray-500 fill-gray-100/50'
};

// Animaciones premium para las tarjetas de secciones (OPTIMIZADAS PARA TRANSICIONES RÁPIDAS)
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const LIST_WRAPPER_VARIANTS: Variants = {
    hidden: {
        transition: { staggerChildren: 0.02, staggerDirection: -1 }
    },
    visible: {
        transition: { delayChildren: 0, staggerChildren: 0.03 }
    }
};

const SECTION_ITEM_VARIANTS: Variants = {
    hidden: { opacity: 0, x: 10, y: 5, scale: 0.98 },
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: { duration: 0.25, ease: EASE_SMOOTH }
    }
};

type AdminTab = 'bienvenida' | 'dashboard' | 'matricular' | 'maestros' | 'consultar' | 'promovidos';

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

    // Estado para controlar si se muestra el menú de carpetas (para directores)
    const isDirector = userRole === 'Director';
    const [showDirectorMenu, setShowDirectorMenu] = useState(!isDirector);

    // Si el usuario es director, asegurar que mostramos la tarjeta inicial al cargar el dato
    React.useEffect(() => {
        if (userRole === 'Director') {
            setShowDirectorMenu(false);
        }
    }, [userRole]);

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
            title: 'Matriculas',
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
            {/* Tarjeta de Bienvenida */}
            <div
                className={`
          group relative rounded-3xl border border-white/70 bg-white/55 px-5 md:px-6 py-2 md:py-3 shadow-xl backdrop-blur-xl w-full max-w-sm md:w-auto md:min-w-[18rem] md:max-w-md
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

                <div className="flex flex-col items-center justify-center gap-1">
                    {/* Icono de Administración */}
                    <div className="w-8 h-8 md:w-9 md:h-9 mx-auto rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg mb-0.5">
                        <Users className="w-4 h-4 md:w-5 md:h-5 text-white" strokeWidth={2.5} />
                    </div>

                    <h1 className="text-sm md:text-base font-semibold tracking-tight text-gray-900 flex flex-col items-center leading-tight">
                        <span className="text-xs text-gray-500 font-medium mb-0.5 uppercase tracking-wide">Bienvenido</span>
                        {userName && (
                            <span className="text-base md:text-lg font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent animate-gradient-x">
                                {userName}
                            </span>
                        )}
                    </h1>

                    {/* Mostrar rol o mensaje de coordinador según días de acceso */}
                    {(() => {
                        const hasDiaAcceso = currentUser.diaAcceso && currentUser.diaAcceso !== 'Todos'; // Si tiene diaAcceso, mostrar rol
                        const etapa = currentUser.cursosAcceso?.[0]; // Primera etapa asignada

                        if (hasDiaAcceso && etapa) {
                            // Detectar si hay múltiples días (contiene "," o "y")
                            const multipleDias = currentUser.diaAcceso!.includes(',') || currentUser.diaAcceso!.includes(' y ');
                            const diaLabel = multipleDias ? 'Días' : 'Día';

                            return (
                                <div className="text-center mt-0.5">
                                    <p className="text-xs text-indigo-700 font-semibold mb-0">
                                        Coordinador Académico
                                    </p>
                                    <p className="text-[10px] text-indigo-600 font-medium opacity-80">
                                        {etapa}
                                    </p>
                                </div>
                            );
                        } else if (userRole) {
                            return (
                                <p className="text-xs md:text-sm text-indigo-700 font-semibold tracking-wide mt-0.5">
                                    {userRole === 'Director' ? 'Director Académico' : userRole}
                                </p>
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>

            {/* Título Paneles - Solo mostrar si NO es director O si ya entró al menú */}
            <AnimatePresence mode="wait">
                {!showDirectorMenu && isDirector ? (
                    <motion.div
                        key="director-cards"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="mt-2 relative z-20 flex flex-col sm:flex-row gap-3 items-center justify-center"
                    >
                        <DirectorAccessCard onEnter={() => setShowDirectorMenu(true)} />
                        <DirectorDashboardCard onSelectDashboard={() => onSelectSection('dashboard')} />
                    </motion.div>
                ) : (
                    <>
                        <motion.h2
                            key="title"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`
                                text-sm md:text-base font-semibold mt-3 md:mt-4 mb-2 md:mb-3 text-gray-800
                                transition-all duration-${animationDuration} ease-[${easing}]
                                ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
                            `}
                            style={{ transitionDelay: `${isActive ? sectionsContainerDelay - 50 : 0}ms` }}
                        >
                            Tus Paneles de Gestión
                        </motion.h2>

                        {/* Contenedor de Tarjetas de Secciones */}
                        <div key="sections" className="w-full max-w-full md:max-w-4xl px-2 md:px-0">
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


                            </div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Botón Premium de Cambiar Perfil - Siempre Visible */}
            <motion.div
                className="relative z-30 flex justify-center mt-4 mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <button
                    onClick={() => {
                        if (isMultiRole) {
                            window.location.href = '/login/portal';
                        } else {
                            onLogout();
                        }
                    }}
                    className="group relative flex items-center gap-2 px-4 py-2 rounded-xl
                    bg-white/40 border border-white/50 backdrop-blur-md shadow-sm
                    hover:bg-white/60 hover:shadow-md hover:border-white/80
                    hover:-translate-y-0.5
                    active:translate-y-0 active:scale-95
                    transition-all duration-300 ease-out"
                >
                    <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                        Cambiar Perfil
                    </span>
                </button>
            </motion.div>
        </div>
    );
}

function DirectorAccessCard({ onEnter }: { onEnter: () => void }) {
    return (
        <button
            onClick={onEnter}
            className="group relative w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-blue-900/20 focus:outline-none focus:ring-4 focus:ring-blue-400/30"
        >
            <img
                src="/director-access-card.png"
                alt="Gestión de Maestros y Estudiantes - Ingresar"
                className="w-full h-auto"
            />

            {/* Overlay sutil al hacer hover para indicar interactividad */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors duration-300" />
        </button>
    );
}

function DirectorDashboardCard({ onSelectDashboard }: { onSelectDashboard: () => void }) {
    return (
        <button
            onClick={onSelectDashboard}
            className="group relative w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-emerald-900/20 focus:outline-none focus:ring-4 focus:ring-emerald-400/30"
        >
            <img
                src="/dashboard-card.png"
                alt="Dashboard de Proceso Transformacional - Ingresar"
                className="w-full h-auto"
            />

            {/* Overlay sutil al hacer hover para indicar interactividad */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors duration-300" />
        </button>
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
        relative flex flex-col items-center justify-start w-32 h-32 md:w-48 md:h-48 
        rounded-3xl p-3 md:p-5 
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
          w-20 h-20 md:w-28 md:h-28 mb-1.5 md:mb-3 ${colorClasses} 
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
