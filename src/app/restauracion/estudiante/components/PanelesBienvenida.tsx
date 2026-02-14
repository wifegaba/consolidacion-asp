'use client';

import React from 'react';
// --- CAMBIO: Importar Loader2 y Framer Motion ---
import { BookMarked, Folder, Star, Loader2, LogOut, Users } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { motion, Variants } from 'framer-motion';

// Importamos los tipos y utils que necesitamos
import { Course, folderColors } from './academia.utils';

// Animaciones premium para las carpetas de cursos
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const LIST_WRAPPER_VARIANTS: Variants = {
  hidden: {
    transition: { staggerChildren: 0.035, staggerDirection: -1 }
  },
  visible: {
    transition: { delayChildren: 0.12, staggerChildren: 0.075 }
  }
};

const FOLDER_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 28, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_SMOOTH }
  }
};

// --- TIPO DE PROPS (MODIFICADO) ---
interface WelcomePanelProps {
  onSelectCourse: (course: Course) => void;
  className?: string;
  isActive: boolean;
  courses: readonly Course[];
  loading: boolean;
  userName?: string;
}

// --- Componente 1: WelcomePanel ---
export function WelcomePanel({
  onSelectCourse,
  className = '',
  isActive,
  courses,
  loading,
  userName = ''
}: WelcomePanelProps) {
  const cardDelay = 100;
  const foldersContainerDelay = cardDelay + 100; // 200ms
  const folderStagger = 75;
  const animationDuration = 500;
  const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

  return (
    <div className={`relative flex w-full h-full flex-col items-center justify-start pt-6 pb-10 px-4 md:px-12 text-center [grid-area:stack] overflow-y-auto overflow-x-hidden ${className}`}>
      {/* Tarjeta de Bienvenida */}
      <div
        className={`
          group relative rounded-3xl border border-white/70 bg-white/55 px-6 md:px-10 pt-5 pb-4 md:pt-6 md:pb-5 shadow-xl backdrop-blur-xl w-full max-w-md md:w-auto md:min-w-[28rem] md:max-w-3xl
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
        style={{
          transitionDelay: `${isActive ? cardDelay : 0}ms`,
        }}
      >
        {/* Premium Background Gradients */}
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-transparent blur-[50px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-tl from-purple-500/30 via-fuchsia-400/20 to-transparent blur-[50px] pointer-events-none" />
        <BookMarked className="w-10 h-10 md:w-12 md:h-12 mx-auto text-indigo-500/90" />
        <h1 className="mt-2 text-lg md:text-xl font-semibold tracking-tight text-gray-900 flex flex-col items-center gap-0.5">
          <span>Bienvenido</span>
          {userName && (
            <span className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent animate-gradient-x pb-0.5">
              {userName}
            </span>
          )}
        </h1>
        <p className="mt-2 max-w-sm text-xs md:text-sm text-gray-700 mx-auto leading-relaxed">Selecciona un curso para empezar a gestionar estudiantes y registrar calificaciones.</p>


      </div>

      {/* Título Cursos */}
      <h2
        className={`
          text-lg md:text-xl font-semibold mt-8 md:mt-10 mb-6 md:mb-8 text-gray-800
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
        `}
        style={{ transitionDelay: `${isActive ? foldersContainerDelay - 50 : 0}ms` }}
      >
        Tus Cursos Asignados
      </h2>

      {/* Contenedor Carpetas */}
      <div className="w-full max-w-full md:max-w-5xl lg:max-w-7xl px-4 md:px-0">
        <div
          className={`
            flex flex-wrap md:flex-nowrap items-center justify-center 
            gap-4 md:gap-6 w-full 
            pb-4 px-1 md:pb-4 md:px-4 
            overflow-x-auto 
            transition-opacity duration-${animationDuration} ease-[${easing}]
            ${isActive ? 'opacity-100' : 'opacity-0'}
            [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,.15)_transparent] 
          `}
          style={{ transitionDelay: `${isActive ? foldersContainerDelay : 0}ms` }}
        >

          {/* --- CAMBIO: Lógica de carga con animaciones Framer Motion --- */}
          {loading ? (
            <div className="flex items-center justify-center w-full h-44 text-gray-600">
              <Loader2 size={24} className="animate-spin mr-2" />
              Cargando cursos...
            </div>
          ) : courses.length === 0 ? (
            <div className="flex items-center justify-center w-full h-44 text-gray-600">
              No tienes cursos asignados actualmente.
            </div>
          ) : (
            <motion.div
              className="flex flex-wrap md:flex-nowrap items-center justify-center gap-4 md:gap-6 w-full"
              variants={LIST_WRAPPER_VARIANTS}
              initial="hidden"
              animate={isActive ? "visible" : "hidden"}
            >
              {courses.map((course) => (
                <motion.div key={course.id} variants={FOLDER_ITEM_VARIANTS}>
                  <CourseFolder
                    title={course.title}
                    color={course.color}
                    hasSpecialBadge={course.hasSpecialBadge}
                    studentCount={course.studentCount}
                    onSelect={() => onSelectCourse(course)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
          {/* --- FIN CAMBIO --- */}

        </div>
      </div>
    </div>
  );
}

// --- Componente 2: CourseWelcomeMessage (Sin Cambios) ---
export function CourseWelcomeMessage({
  courseName,
  className = '',
}: {
  courseName: string;
  className?: string;
}) {
  const isActive = className.includes('opacity-100');
  const animationDuration = 500;
  const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

  return (
    <div className={`hidden md:flex flex-col items-center justify-center p-10 text-center [grid-area:stack] overflow-y-auto h-full ${className}`}>
      <div
        className={`
          group relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 px-10 py-12 shadow-xl backdrop-blur-xl
          transition-all duration-${animationDuration} ease-[${easing}] delay-100 
          ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
      >
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 to-white/25 blur-3xl" />
        <Folder size={64} className="mx-auto text-indigo-500/90" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900">
          Bienvenido al panel de <br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {courseName}
          </span>
        </h1>
        <p className="mt-4 max-w-sm text-base text-gray-700">Selecciona un estudiante de la lista para ver sus notas o crea un nuevo registro para este curso.</p>
      </div>
    </div>
  );
}

// --- Componente 3: CourseFolder — Premium Dark Glass Card ---
function CourseFolder({
  title,
  color = 'blue',
  hasSpecialBadge = false,
  studentCount,
  onSelect,
  className = '',
  style = {}
}: {
  title: string;
  color?: string;
  hasSpecialBadge?: boolean;
  studentCount?: number;
  onSelect: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const colorKey = color in folderColors ? color as keyof typeof folderColors : 'default';
  const theme = folderColors[colorKey];

  // Mapeo de colores para badge y fondo del icono
  const badgeColors: Record<string, { bg: string; text: string; label: string; iconBg: string; glow: string }> = {
    blue: { bg: 'bg-blue-500', text: 'text-white', label: 'CURSO', iconBg: 'from-blue-500/30 to-blue-600/20', glow: 'shadow-blue-500/20' },
    indigo: { bg: 'bg-indigo-500', text: 'text-white', label: 'CURSO', iconBg: 'from-indigo-500/30 to-indigo-600/20', glow: 'shadow-indigo-500/20' },
    teal: { bg: 'bg-teal-500', text: 'text-white', label: 'CURSO', iconBg: 'from-teal-500/30 to-teal-600/20', glow: 'shadow-teal-500/20' },
    purple: { bg: 'bg-purple-500', text: 'text-white', label: 'CURSO', iconBg: 'from-purple-500/30 to-purple-600/20', glow: 'shadow-purple-500/20' },
    pink: { bg: 'bg-pink-500', text: 'text-white', label: 'CURSO', iconBg: 'from-pink-500/30 to-pink-600/20', glow: 'shadow-pink-500/20' },
    default: { bg: 'bg-slate-500', text: 'text-white', label: 'CURSO', iconBg: 'from-slate-500/30 to-slate-600/20', glow: 'shadow-slate-500/20' },
  };
  const badge = badgeColors[colorKey] || badgeColors.default;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col items-center justify-center
        w-40 h-52 md:w-48 md:h-60
        rounded-2xl p-5 md:p-6
        /* —— Dark Glass Base —— */
        backdrop-blur-2xl 
        bg-gradient-to-br from-slate-900/90 via-indigo-950/80 to-slate-900/90
        border border-white/[0.08]
        /* —— Sombras —— */
        shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]
        /* —— Transiciones —— */
        transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        hover:border-white/[0.12]
        hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]
        active:scale-[0.97] active:translate-y-0
        focus:outline-none focus:ring-2 ${theme.focusRing}
        text-center flex-shrink-0
        overflow-hidden
        ${className}
      `}
      style={style}
    >
      {/* ── Resplandor de fondo sutil ── */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${theme.bgGlow} blur-2xl pointer-events-none ${theme.bgGlowHover} transition-all duration-700`} />
      <div className={`absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-gradient-to-tr ${theme.bgGlow} blur-2xl pointer-events-none`} />

      {/* ── Reflejo superior ── */}
      <div className="absolute inset-x-0 top-0 h-[40%] rounded-t-2xl bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />



      {/* ── Contenedor del icono ── */}
      <div className={`relative z-10 flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br ${badge.iconBg} backdrop-blur-md border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-500 group-hover:border-white/[0.18] ${badge.glow} group-hover:shadow-lg`}>
        <Folder
          className={`
            w-9 h-9 md:w-11 md:h-11 ${theme.icon}
            transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            drop-shadow-[0_2px_6px_rgba(0,0,0,0.2)]
            group-hover:scale-110
          `}
          strokeWidth={1.5}
          fill="currentColor"
          style={{ fillOpacity: 0.2 }}
        />
      </div>

      {/* ── Título del curso ── */}
      <h4 className="relative z-10 text-sm md:text-base font-semibold text-white/90 w-full truncate mt-4 group-hover:text-white transition-colors duration-300">
        {title}
      </h4>

      {/* ── Cantidad de estudiantes ── */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 mt-1">
        <Users size={13} className="text-slate-400" />
        <span className="text-xs text-slate-400 font-medium">
          {studentCount !== undefined ? `${studentCount} estudiante${studentCount !== 1 ? 's' : ''}` : 'Cargando...'}
        </span>
      </div>

      {/* ── Badge Especial (Estrella) ── */}
      {hasSpecialBadge && (
        <div className="absolute top-2 right-2 z-20 p-1 rounded-lg bg-white/[0.06] backdrop-blur-xl border border-yellow-400/30 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
          <Star size={14} className="text-yellow-400 fill-yellow-400/20 drop-shadow-[0_0_4px_rgba(234,179,8,0.4)]" strokeWidth={1.5} />
        </div>
      )}

      {/* ── Sistema de iluminación inferior premium ── */}
      {/* Línea de acento principal */}
      <div className={`absolute bottom-0 inset-x-0 h-[2px] ${theme.accent} opacity-30 group-hover:opacity-100 transition-all duration-500 rounded-b-2xl`} />
      {/* Resplandor difuso medio */}
      <div className={`absolute bottom-0 inset-x-4 h-[6px] ${theme.accent} opacity-0 group-hover:opacity-40 blur-[4px] transition-all duration-500 rounded-b-2xl`} />
    </button>
  );
}