'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import IntakeGroupSelect from './IntakeGroupSelect';
import { compatibleGroups, type HistoryCandidate, type IntakeGroup } from '@/lib/ingresoHistory';

export default function IntakeAssignmentModal({ pending, groups, onClose, onSuccess }: {
  pending: { id?: string; nombre: string | null; telefono?: string | null; cedula?: string | null; email?: string | null; history?: HistoryCandidate[] };
  groups: IntakeGroup[]; onClose: () => void; onSuccess: () => void;
}) {
  const candidates = pending.history || [];
  const [identityKey, setIdentityKey] = useState(candidates.length === 1 ? `${candidates[0].fuente}:${candidates[0].id}` : '');
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<'previous' | 'other'>(candidates.some(c => c.nivel) ? 'previous' : 'other');
  const [groupKey, setGroupKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); };
  }, [mounted, saving, onClose]);
  const candidate = candidates.find(c => `${c.fuente}:${c.id}` === identityKey);
  const available = mode === 'previous' && candidate ? compatibleGroups(groups, candidate)
    : mode === 'other' ? groups.filter(g => g.fuente === (candidate?.fuente || 'persona')) : [];
  const identityReady = !candidates.length || identityKey === 'new' || (candidate && confirmed);

  async function save() {
    if (!identityReady || !groupKey || candidate?.activo || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/ingresos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', pendienteId: pending.id, groupKey,
          identityId: candidate?.id, identitySource: candidate?.fuente, confirmed,
          distinctPerson: identityKey === 'new' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al asignar'); }
    finally { setSaving(false); }
  }

  if (!mounted) return null;
  return createPortal(<div className="fixed inset-0 z-[10000] flex h-dvh items-center justify-center overflow-hidden bg-black/40 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <div role="dialog" aria-modal="true" aria-labelledby="intake-assignment-title" className="flex max-h-full w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-[24px] bg-white text-slate-800 shadow-2xl">
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
        <h2 id="intake-assignment-title" className="min-w-0 flex-1 text-lg leading-snug font-bold [overflow-wrap:anywhere] sm:text-xl">Asignar ingreso · {pending.nombre}</h2>
        <button aria-label="Cerrar" disabled={saving} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-width:thin] sm:px-6 sm:pb-5">
      <p className="mb-3 text-sm text-slate-600">Revisa la identidad y elige el grupo. La asignación se realiza únicamente al confirmar.</p>
      <p className="mb-3 min-w-0 rounded-lg bg-slate-50 p-3 text-sm [overflow-wrap:anywhere]"><strong>Datos del ingreso:</strong> {pending.nombre}
        {pending.telefono && <> · {pending.telefono}</>}{pending.cedula && <> · Documento: {pending.cedula}</>}{pending.email && <> · {pending.email}</>}
      </p>
      {candidates.length > 0 && <fieldset className="min-w-0 max-w-full space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 sm:p-3">
        <legend className="max-w-full px-1 text-sm font-bold [overflow-wrap:anywhere] sm:text-base">{candidates.length === 1 && candidates[0].confianza === 'segura' ? 'Historial encontrado' : 'Posible historial encontrado'}</legend>
        {candidates.map(c => <label key={`${c.fuente}:${c.id}`} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white p-2.5 text-sm sm:p-3">
          <input className="mt-0.5 h-4 w-4 shrink-0" type="radio" name="intake-identity" value={`${c.fuente}:${c.id}`} checked={identityKey === `${c.fuente}:${c.id}`} disabled={saving}
            onChange={e => { setIdentityKey(e.target.value); setConfirmed(false); setGroupKey(''); }} />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><strong>{c.nombre}</strong><br />{c.motivo} · {c.telefono || 'Sin teléfono'}
            {c.cedula && <> · Documento: {c.cedula}</>}{c.email && <> · {c.email}</>}
            <br />Último nivel: <strong>{c.nivel || 'Sin cursos registrados'}</strong>
            {c.fecha && <><br />Último proceso: {new Date(c.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</>}
            {c.activo && <span className="block font-semibold text-amber-800">Ya tiene un proceso activo; revisa su matrícula antes de asignar.</span>}
          </span>
        </label>)}
        <label className="flex min-w-0 items-start gap-2 py-1 text-sm"><input className="mt-0.5 h-4 w-4 shrink-0" type="radio" name="intake-identity" checked={identityKey === 'new'} disabled={saving}
          onChange={() => { setIdentityKey('new'); setConfirmed(false); setMode('other'); setGroupKey(''); }} /><span className="min-w-0 flex-1 [overflow-wrap:anywhere]">Es una persona distinta; descartar este historial</span></label>
        {candidate && <label className="flex min-w-0 items-start gap-2 border-t border-amber-200 pt-2 text-sm font-semibold">
          <input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={confirmed} disabled={saving || candidate.activo} onChange={e => setConfirmed(e.target.checked)} />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">Revisé los datos y confirmo que es la misma persona</span>
        </label>}
      </fieldset>}
      <div className="my-4 grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {candidate?.nivel && <button disabled={saving} onClick={() => { setMode('previous'); setGroupKey(''); }}
          className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.98] sm:min-h-0 sm:px-4 ${mode === 'previous' ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700' : 'border-slate-200/70 bg-white/80 text-slate-600 hover:bg-slate-50'}`}><RotateCcw className="shrink-0" size={13} strokeWidth={1.75} aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">Reintegrar al nivel anterior</span></button>}
        <button disabled={saving} onClick={() => { setMode('other'); setGroupKey(''); }}
          className={`min-h-11 min-w-0 rounded-full border px-3 py-2 text-xs font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.98] sm:min-h-0 sm:px-4 ${mode === 'other' ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700' : 'border-slate-200/70 bg-white/80 text-slate-600 hover:bg-slate-50'}`}>Elegir otro nivel</button>
      </div>
      {mode === 'previous' && candidate && <p className="mb-2 text-sm">Último nivel: <strong>{candidate.nivel}</strong></p>}
      <label className="block text-sm font-semibold" htmlFor="intake-group">Grupos disponibles actualmente</label>
      <IntakeGroupSelect key={`${identityKey}:${mode}`} id="intake-group" value={groupKey} groups={available}
        disabled={saving || candidate?.activo || available.length === 0} onChange={setGroupKey} />
      {candidate && !confirmed && !candidate.activo && <p className="mt-2 text-xs text-slate-500">Puedes elegir el grupo ahora. Confirma que es la misma persona para guardar.</p>}
      {available.length === 0 && <p className="mt-2 text-sm text-amber-800">{candidate || !candidates.length || identityKey === 'new'
        ? 'No hay grupos activos compatibles. Puedes elegir otro nivel o dejar el ingreso pendiente.'
        : 'Selecciona y revisa un historial para ver sus grupos compatibles.'}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700 [overflow-wrap:anywhere]">{error}</p>}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 p-4 shadow-[0_-4px_16px_rgba(15,23,42,0.025)] sm:flex sm:justify-end sm:gap-3 sm:px-6">
        <button disabled={saving} onClick={onClose} className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-[13px] font-medium sm:px-4 sm:text-sm">Cancelar</button>
        <button onClick={save} disabled={saving || !identityReady || !groupKey || candidate?.activo}
          className="min-h-11 min-w-0 rounded-xl bg-indigo-600 px-2 py-2 text-[13px] font-semibold text-white disabled:opacity-40 sm:px-4 sm:text-sm">{saving ? 'Guardando…' : 'Confirmar grupo'}</button>
      </div>
    </div>
  </div>, document.body);
}
