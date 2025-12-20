'use client';

import React from 'react';
// --- CAMBIO: Importar Loader2 ---
import { BookMarked, Folder, Star, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';

// Importamos los tipos y utils que necesitamos
import { Course, folderColors } from './academia.utils';

// --- TIPO DE PROPS (MODIFICADO) ---
interface WelcomePanelProps {
  onSelectCourse: (course: Course) => void;
  className?: string;
  isActive: boolean;
  courses: readonly Course[];
  loading: boolean; // <-- CAMBIO: Prop 'loading' añadida
}

// --- Componente 1: WelcomePanel ---
export function WelcomePanel({
  onSelectCourse,
  className = '',
  isActive,
  courses,
  loading // <-- CAMBIO: Prop 'loading' recibida
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
          group relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 px-6 md:px-10 py-8 md:py-12 shadow-xl backdrop-blur-xl w-full max-w-md md:max-w-sm
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
        style={{ transitionDelay: `${isActive ? cardDelay : 0}ms` }}
      >
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 to-white/25 blur-3xl" />
        <BookMarked className="w-14 h-14 md:w-16 md:h-16 mx-auto text-indigo-500/90" />
        <h1 className="mt-6 text-xl md:text-2xl font-semibold tracking-tight text-gray-900">Bienvenido al Gestor Académico</h1>
        <p className="mt-2 max-w-sm text-sm md:text-base text-gray-700 mx-auto">Selecciona un curso para empezar a gestionar estudiantes y registrar calificaciones.</p>
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

          {/* --- CAMBIO: Lógica de carga --- */}
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
            courses.map((course, index) => (
              <CourseFolder
                key={course.id}
                title={course.title}
                color={course.color}
                hasSpecialBadge={course.hasSpecialBadge}
                onSelect={() => onSelectCourse(course)}
                className={`
                  transition-all duration-300 ease-out 
                  ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                `}
                style={{ transitionDelay: `${isActive ? foldersContainerDelay + index * folderStagger : 0}ms` }}
              />
            ))
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

// --- Componente 3: CourseFolder (Sin Cambios) ---
function CourseFolder({
  title,
  color = 'blue',
  hasSpecialBadge = false,
  onSelect,
  className = '',
  style = {}
}: {
  title: string;
  color?: string;
  hasSpecialBadge?: boolean;
  onSelect: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const colorKey = color in folderColors ? color as keyof typeof folderColors : 'default';
  const colorClasses = folderColors[colorKey];
  const appleEase = 'ease-[cubic-bezier(0.2,0.8,0.2,1)]';
  const duration = 'duration-300';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col items-center justify-start w-36 h-36 md:w-44 md:h-44 
        rounded-3xl p-4 
        shadow-lg shadow-black/5
        transition-all ${duration} ${appleEase}
        hover:scale-[1.03] hover:-translate-y-1.5 
        hover:shadow-xl hover:shadow-indigo-500/20
        active:scale-[0.98] active:translate-y-0
        focus:outline-none focus:ring-4 focus:ring-indigo-400/25 group text-center 
        flex-shrink-0 
        ${className} 
      `}
      style={style}
    >
      <Folder
        className={`
          w-24 h-24 md:w-28 md:h-28 mb-2 md:mb-3 ${colorClasses} 
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

      {hasSpecialBadge && (
        <div className="absolute top-8 right-8 z-10 p-1.5 rounded-full bg-white/70 border border-yellow-300 shadow-lg backdrop-blur-md">
          <Star size={20} className="text-yellow-500 fill-yellow-400/30 drop-shadow-sm" strokeWidth={1.5} />
        </div>
      )}
    </button>
  );
}