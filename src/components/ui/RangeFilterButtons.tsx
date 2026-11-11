"use client";

import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { getMesesDisponibles, getSemanasDisponibles } from '@/app/actions';
import type { OpcionSelector, Range } from '@/app/actions';
import { formatDashboardMonth } from '@/lib/dashboard-month';

interface RangeFilterButtonsProps {
  currentRange: Range;
  currentValue?: string;
  currentMonth: string;
}

const rangeButton = 'px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 flex-shrink-0';
const activeClasses = 'bg-slate-800 text-white shadow-md';
const inactiveClasses = 'text-slate-500 bg-slate-200/80 hover:bg-slate-300';

export function RangeFilterButtons({ currentRange, currentValue, currentMonth }: RangeFilterButtonsProps) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const monthMenuId = useId();
  const monthMenu = useRef<HTMLDivElement>(null);
  const monthButton = useRef<HTMLButtonElement>(null);
  const monthFocus = useRef<'first' | 'last' | 'selected'>('selected');
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<Range>();
  const [open, setOpen] = useState<'month' | 'week' | null>(null);
  const [months, setMonths] = useState<OpcionSelector[]>();
  const [weeks, setWeeks] = useState<OpcionSelector[]>();
  const [monthsLoading, setMonthsLoading] = useState(false);
  const [monthFailed, setMonthFailed] = useState(false);
  const [weeksLoading, setWeeksLoading] = useState(false);
  const chosenMonth = currentRange === 'month' ? currentValue ?? currentMonth : undefined;

  function closeMonth() {
    setOpen(null);
    monthButton.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (open !== 'month') return;
    function dismissOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!monthMenu.current?.contains(target) && !monthButton.current?.contains(target)) setOpen(null);
    }
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);

  useEffect(() => {
    if (open !== 'month') return;
    const options = monthMenu.current?.querySelectorAll<HTMLButtonElement>('[data-month-option]');
    if (!options?.length) return;
    if (monthMenu.current?.contains(document.activeElement) && document.activeElement !== monthMenu.current) return;
    const selected = monthMenu.current?.querySelector<HTMLButtonElement>('[aria-current="true"]');
    if (!months && !monthFailed && (monthFocus.current === 'last' || (chosenMonth && monthFocus.current === 'selected' && !selected))) {
      monthMenu.current?.focus({ preventScroll: true });
      return;
    }
    const target = monthFocus.current === 'last' ? options[options.length - 1]
      : monthFocus.current === 'first' ? options[0] : selected ?? options[0];
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
  }, [open, months, monthFailed, chosenMonth]);

  function navigate(range: Range, value?: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (range) params.set('range', range);
    if (value) params.set('valor', value);
    else params.delete('valor');
    setOpen(null);
    setPendingRange(range);
    startTransition(() => replace(pathname + '?' + params.toString(), { scroll: false }));
  }

  async function loadMonths() {
    if (monthsLoading || months) return;
    setMonthsLoading(true);
    setMonthFailed(false);
    try { setMonths(await getMesesDisponibles()); }
    catch { setMonthFailed(true); }
    finally { setMonthsLoading(false); }
  }

  function openMonth(focus: typeof monthFocus.current = 'selected') {
    monthFocus.current = focus;
    setOpen('month');
    void loadMonths();
  }

  async function toggleWeek() {
    if (open === 'week') {
      setOpen(null);
      return;
    }
    setOpen('week');
    if (weeksLoading || weeks) return;
    setWeeksLoading(true);
    try { setWeeks(await getSemanasDisponibles()); }
    catch (error) { console.error('Error al cargar las semanas', error); }
    finally { setWeeksLoading(false); }
  }

  function handleMonthKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMonth();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-month-option]'));
    if (!options.length) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' || (index < 0 && event.key === 'ArrowDown') ? 0
      : event.key === 'End' || index < 0 ? options.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus({ preventScroll: true });
    options[next].scrollIntoView({ block: 'nearest' });
  }

  function selectMonth(value?: string) {
    closeMonth();
    if (currentRange !== 'month' || value !== currentValue) navigate('month', value);
  }

  return (
    <div className="range-filter flex items-center gap-2 bg-slate-200 p-1 rounded-xl relative">
      <button type="button" onClick={() => navigate('today')} className={rangeButton + ' ' + (currentRange === 'today' ? activeClasses : inactiveClasses)}>Hoy</button>
      <button type="button" onClick={toggleWeek} aria-expanded={open === 'week'} className={rangeButton + ' ' + (currentRange === 'week' ? activeClasses : inactiveClasses)}>
        Semana<span className="ml-2 text-xs">▼</span>
      </button>
      <button ref={monthButton} type="button" className={'range-month-trigger ' + rangeButton + ' ' + (currentRange === 'month' ? activeClasses : inactiveClasses)}
        aria-expanded={open === 'month'} aria-controls={open === 'month' ? monthMenuId : undefined}
        onClick={() => open === 'month' ? closeMonth() : openMonth()}
        onKeyDown={event => {
          if (event.key === 'Escape' && open === 'month') {
            event.preventDefault();
            closeMonth();
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMonth(event.key === 'ArrowUp' ? 'last' : 'first');
          }
        }}>
        Mes<ChevronDown size={14} aria-hidden="true" />
      </button>
      {isPending && pendingRange === 'month' && <span className="range-month-status" role="status">Actualizando mes…</span>}

      {open === 'week' && <div className="range-week-popover absolute top-full left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 z-10 bg-white shadow-lg rounded-lg border max-h-60 overflow-y-auto w-64 p-2 origin-top md:origin-top-right">
        {weeksLoading ? <p className="p-2 text-sm">Cargando…</p> : <select aria-label="Elegir semana"
          value={currentRange === 'week' ? currentValue ?? '' : ''}
          onChange={event => navigate('week', event.target.value || undefined)}
          className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500" size={5}>
          <option value="">Semana Actual</option>
          {weeks?.map(week => <option key={week.valor} value={week.valor}>{week.etiqueta}</option>)}
        </select>}
      </div>}

      {open === 'month' && <div ref={monthMenu} id={monthMenuId} className="range-month-popover" role="group" aria-label="Elegir mes" tabIndex={-1}
        onKeyDown={handleMonthKeys} onBlur={event => {
          if (!event.relatedTarget) return;
          if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== monthButton.current) setOpen(null);
        }}>
        <button type="button" data-month-option aria-current={chosenMonth === currentMonth ? 'true' : undefined}
          className="range-month-option range-month-current" onClick={() => selectMonth()}>
          <CalendarDays size={18} aria-hidden="true" />
          <span>Mes actual<small>{formatDashboardMonth(currentMonth)}</small></span>
          {chosenMonth === currentMonth && <Check size={17} aria-hidden="true" />}
        </button>
        <div className="range-month-history" aria-busy={monthsLoading}>
          {monthsLoading && <p role="status">Cargando meses…</p>}
          {monthFailed && <button type="button" className="range-month-retry" onClick={loadMonths}>Volver a cargar meses</button>}
          {months?.filter(month => month.valor !== currentMonth).map(month => <button key={month.valor} type="button"
            data-month-option className="range-month-option" aria-current={chosenMonth === month.valor ? 'true' : undefined}
            onClick={() => selectMonth(month.valor)}>
            <span>{month.etiqueta}</span>
            {chosenMonth === month.valor && <Check size={17} aria-hidden="true" />}
          </button>)}
        </div>
      </div>}
    </div>
  );
}
