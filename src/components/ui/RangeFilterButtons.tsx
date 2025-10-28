// app/components/ui/RangeFilterButtons.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getMesesDisponibles, getSemanasDisponibles } from '@/app/actions';
import type { OpcionSelector, Range } from '@/app/actions';

interface RangeFilterButtonsProps {
  currentRange: Range;
  currentValue?: string;
}

export function RangeFilterButtons({ currentRange, currentValue }: RangeFilterButtonsProps) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const searchParams = useSearchParams();

  const [showMesSelector, setShowMesSelector] = useState(false);
  const [showSemanaSelector, setShowSemanaSelector] = useState(false);
  const [meses, setMeses] = useState<OpcionSelector[]>([]);
  const [semanas, setSemanas] = useState<OpcionSelector[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [monthLabel, setMonthLabel] = useState('Mes');
  const [weekLabel, setWeekLabel] = useState('Semana');

  // --- useEffect para etiquetas y precarga (sin cambios) ---
  useEffect(() => {
    // ...(lógica existente para cargar etiquetas y datos iniciales)...
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRange, currentValue]);

  // --- handleNavigation, handleTodayClick (sin cambios) ---
  function handleNavigation(range: Range, valor?: string) {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (range) { params.set('range', range); } else { params.delete('range'); }
    if (valor) { params.set('valor', valor); } else { params.delete('valor'); }
    setShowMesSelector(false); // Asegura cerrar paneles al navegar
    setShowSemanaSelector(false);
    replace(`${pathname}?${params.toString()}`);
  }
  const handleTodayClick = () => handleNavigation('today');

  // --- Handlers Toggle actualizados para cerrar el otro panel ---
  const handleMonthToggle = async () => {
    setShowSemanaSelector(false); // Cierra el otro panel
    if (showMesSelector) {
      setShowMesSelector(false);
      return;
    }
    if (meses.length === 0) {
      setIsLoading(true);
      try { setMeses(await getMesesDisponibles()); }
      catch (e) { console.error("Error fetching months:", e); }
      setIsLoading(false);
    }
    setShowMesSelector(true);
  };

  const handleWeekToggle = async () => {
    setShowMesSelector(false); // Cierra el otro panel
    if (showSemanaSelector) {
      setShowSemanaSelector(false);
      return;
    }
    if (semanas.length === 0) {
      setIsLoading(true);
      try { setSemanas(await getSemanasDisponibles()); }
      catch (e) { console.error("Error fetching weeks:", e); }
      setIsLoading(false);
    }
    setShowSemanaSelector(true);
  };

  // --- Handlers Select (sin cambios) ---
  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleNavigation('month', e.target.value === "current" ? undefined : e.target.value);
  };
  const handleWeekSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleNavigation('week', e.target.value === "current" ? undefined : e.target.value);
  };

  // --- Clases y Lógica de Estado Activo (sin cambios) ---
  const baseClasses = "px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 flex-shrink-0";
  const activeClasses = "bg-slate-800 text-white shadow-md focus:ring-slate-700";
  const inactiveClasses = "text-slate-500 bg-slate-200/80 hover:bg-slate-300 focus:ring-slate-400";
  const isTodayActive = currentRange === 'today';
  const isWeekActive = currentRange === 'week';
  const isMonthActive = currentRange === 'month';

  return (
    // Contenedor principal ahora es la referencia para 'absolute'
    <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-xl relative">
      <button
        onClick={handleTodayClick}
        className={`${baseClasses} ${isTodayActive ? activeClasses : inactiveClasses}`}
      >
        Hoy
      </button>

      {/* Contenedor Semana (ya no necesita 'relative') */}
      <div>
        <button
          onClick={handleWeekToggle}
          disabled={isLoading}
          className={`${baseClasses} ${isWeekActive ? activeClasses : inactiveClasses} ${isLoading && 'opacity-50 cursor-not-allowed'}`}
        >
          {isLoading && isWeekActive ? 'Cargando...' : weekLabel}
          <span className="ml-2 text-xs">▼</span>
        </button>
      </div>

      {/* Contenedor Mes (ya no necesita 'relative') */}
      <div>
        <button
          onClick={handleMonthToggle}
          disabled={isLoading}
          className={`${baseClasses} ${isMonthActive ? activeClasses : inactiveClasses} ${isLoading && 'opacity-50 cursor-not-allowed'}`}
        >
          {isLoading && isMonthActive ? 'Cargando...' : monthLabel}
          <span className="ml-2 text-xs">▼</span>
        </button>
      </div>

      {/* --- INICIO DE MODIFICACIÓN (Panel Semana - Posición y Animación) --- */}
      <div
        className={`
          absolute top-full left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 z-10
          bg-white shadow-lg rounded-lg border max-h-60 overflow-y-auto w-64 p-2
          transition-all duration-300 ease-out origin-top md:origin-top-right
          ${showSemanaSelector && !isLoading ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
        `}
      >
        <select
          value={isWeekActive && currentValue ? currentValue : 'current'}
          onChange={handleWeekSelect}
          className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
          size={5}
        >
          <option value="current" className="p-2">Semana Actual</option>
          {semanas.map(s => (
            <option key={s.valor} value={s.valor} className="p-2">{s.etiqueta}</option>
          ))}
        </select>
      </div>
      {/* --- FIN DE MODIFICACIÓN --- */}


      {/* --- INICIO DE MODIFICACIÓN (Panel Mes - Posición y Animación) --- */}
      <div
        className={`
          absolute top-full left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 z-10
          bg-white shadow-lg rounded-lg border max-h-60 overflow-y-auto w-56 p-2
          transition-all duration-300 ease-out origin-top md:origin-top-right
          ${showMesSelector && !isLoading ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
        `}
      >
        <select
          value={isMonthActive && currentValue ? currentValue : 'current'}
          onChange={handleMonthSelect}
          className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
          size={5}
        >
          <option value="current" className="p-2">Mes Actual</option>
          {meses.map(m => (
            <option key={m.valor} value={m.valor} className="p-2">{m.etiqueta}</option>
          ))}
        </select>
      </div>
      {/* --- FIN DE MODIFICACIÓN --- */}

    </div>
  );
}