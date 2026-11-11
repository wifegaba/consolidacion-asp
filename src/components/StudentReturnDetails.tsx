'use client';

import { RotateCcw } from 'lucide-react';
import { lastCourseLabel, type HistoryCandidate } from '@/lib/ingresoHistory';

export function returnCourse(history: HistoryCandidate[] = []) {
  return history.length === 1 && history[0].confianza === 'segura' && !history[0].activo
    ? history[0] : null;
}

export function StudentReturnBadge({ level, status }: { level: string | null | undefined; status?: string | null }) {
  if (!level) return null;
  return <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium leading-tight tracking-normal text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
    <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-emerald-500/70" />
    <span className="min-w-0 [overflow-wrap:anywhere]">{lastCourseLabel(level, status)}</span>
  </span>;
}

export function ReintegrateButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={event => { event.stopPropagation(); onClick(); }}
    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/75 px-3 py-1.5 text-[11px] font-medium leading-none text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm transition duration-200 hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
    <RotateCcw aria-hidden="true" size={12} strokeWidth={1.75} />
    Reintegrar
  </button>;
}
