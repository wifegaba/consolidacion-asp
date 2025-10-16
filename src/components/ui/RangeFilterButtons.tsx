// app/components/ui/RangeFilterButtons.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function RangeFilterButtons() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  // Lee el filtro actual de la URL. El '?' (optional chaining) maneja el caso si searchParams es null.
  const currentRange = searchParams?.get('range') || 'month';

  function handleFilterChange(range: 'week' | 'month') {
    // ✅ CORRECCIÓN: Usamos 'searchParams.toString()' que devuelve un string vacío
    // si searchParams es null, evitando así el error.
    const params = new URLSearchParams(searchParams?.toString() || '');
    
    params.set('range', range);
    replace(`${pathname}?${params.toString()}`);
  }

  // Estilos para los botones
  const baseClasses = "px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const activeClasses = "bg-slate-800 text-white shadow-md focus:ring-slate-700";
  const inactiveClasses = "text-slate-500 bg-slate-200/80 hover:bg-slate-300 focus:ring-slate-400";

  return (
    <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-xl">
      <button
        onClick={() => handleFilterChange('week')}
        className={`${baseClasses} ${currentRange === 'week' ? activeClasses : inactiveClasses}`}
      >
        Semana
      </button>
      <button
        onClick={() => handleFilterChange('month')}
        className={`${baseClasses} ${currentRange === 'month' ? activeClasses : inactiveClasses}`}
      >
        Mes
      </button>
    </div>
  );
}