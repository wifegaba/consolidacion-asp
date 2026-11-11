'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Check, ChevronDown, History, Video } from 'lucide-react';
import styles from './IntakeAssignment.module.css';
import type { IntakeGroup } from '@/lib/ingresoHistory';

type PickerOption = { key: string; label: string; detail?: string; kind?: 'next' | 'history' | 'other' | 'virtual' };

export function IntakePicker({ id, value, options, placeholder, disabled, onChange, course = false }: {
  id: string; value: string; options: PickerOption[]; placeholder: string;
  disabled?: boolean; onChange: (value: string) => void; course?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find(group => group.key === value);
  const expanded = open && !disabled && options.length > 0;
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);

  useEffect(() => {
    if (expanded) list.current?.scrollIntoView({ block: 'nearest' });
  }, [expanded]);

  useEffect(() => {
    if (expanded) optionRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded]);

  function show(fromEnd = false) {
    const index = options.findIndex(group => group.key === value);
    setActive(index >= 0 ? index : fromEnd ? options.length - 1 : 0);
    setOpen(true);
  }

  function choose(index: number) {
    if (disabled || !options[index]) return;
    onChange(options[index].key);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) show(event.key === 'ArrowUp');
      else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setOpen(true); setActive(event.key === 'Home' ? 0 : options.length - 1); return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (expanded) choose(active); else show();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key, time: now };
      const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const index = options.findIndex(group => normalize(group.label).startsWith(normalize(search.current.text)));
      if (index >= 0) { event.preventDefault(); setOpen(true); setActive(index); }
    }
  }

  const iconFor = (kind?: PickerOption['kind']) => kind === 'next' ? ArrowUpRight
    : kind === 'history' ? History : kind === 'virtual' ? Video : course ? BookOpen : CalendarDays;
  const TriggerIcon = iconFor(selected?.kind);

  return <div ref={root} className="mt-2 min-w-0 max-w-full" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={placeholder}
      aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded ? optionId(active) : undefined}
      disabled={disabled || options.length === 0} onKeyDown={onKeyDown}
      onBlur={event => { if (!root.current?.contains(event.relatedTarget)) setOpen(false); }}
      onClick={() => expanded ? setOpen(false) : show()}
      className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3.5 text-left text-[14px] font-medium shadow-[0_2px_8px_rgba(15,23,42,0.035),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-45 ${expanded ? 'border-emerald-200/80 bg-white/95 ring-4 ring-emerald-400/10' : 'border-slate-200/65 bg-gradient-to-b from-white/95 to-slate-50/70 hover:border-slate-300/70 hover:bg-white'}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${selected ? 'border-emerald-100 bg-emerald-50/80 text-emerald-600' : 'border-white/90 bg-white/75 text-slate-400'}`}>
        <TriggerIcon size={17} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className={`min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere] ${selected ? 'text-slate-800' : 'text-slate-500'}`}>{selected?.label || placeholder}</span>
      <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
    </button>
    {expanded && <div ref={list} id={listId} role="listbox" aria-label={placeholder}
      className={`${styles.menu} mt-2 max-h-[min(15rem,40dvh)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-[20px] border border-white/90 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 p-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12),0_1px_4px_rgba(15,23,42,0.035),inset_0_1px_0_rgba(255,255,255,1)] ring-1 ring-slate-200/60 backdrop-blur-2xl [scrollbar-width:thin]`}>
      {options.map((group, index) => {
        const Icon = iconFor(group.kind);
        return <div key={group.key} id={optionId(index)} role="option"
        ref={element => { optionRefs.current[index] = element; }} aria-selected={group.key === value}
        onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}
        className={`flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-3 text-[13px] font-medium transition-colors duration-150 ${group.key === value ? 'bg-emerald-50/90 text-emerald-800' : index === active ? 'bg-slate-100/80 text-slate-800' : 'text-slate-600 hover:bg-slate-50/80'}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${group.key === value ? 'bg-white/80 text-emerald-700' : group.kind === 'next' ? 'bg-blue-100/80 text-blue-700' : 'bg-white/70 text-slate-500'}`}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{group.label}{group.detail && <span className={`mt-0.5 block text-[11px] ${group.kind === 'next' ? 'font-semibold text-blue-700' : 'text-slate-600'}`}>{group.detail}</span>}</span>
        {group.key === value && <Check size={15} strokeWidth={2} className="shrink-0 text-emerald-600" aria-hidden="true" />}
      </div>;
      })}
    </div>}
  </div>;
}

export default function IntakeGroupSelect({ id, value, groups, disabled, onChange }: {
  id: string; value: string; groups: IntakeGroup[]; disabled?: boolean; onChange: (value: string) => void;
}) {
  return <IntakePicker id={id} value={value} disabled={disabled} onChange={onChange} placeholder="Seleccionar grupo…"
    options={groups.map(({ key, label, dia }) => ({ key, label, kind: dia === 'Virtual' ? 'virtual' : undefined }))} />;
}
