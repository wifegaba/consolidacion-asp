'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Route, UsersRound, X } from 'lucide-react';
import IntakeGroupSelect, { IntakePicker } from './IntakeGroupSelect';
import styles from './IntakeAssignment.module.css';
import IntakeErrorNotice from './IntakeErrorNotice';
import { intakeCourses, lastCourseLabel, normalizeIntakePhone, type HistoryCandidate, type IntakeGroup } from '@/lib/ingresoHistory';

export default function IntakeAssignmentModal({ pending, groups, onClose, onSuccess }: {
  pending: { id?: string; nombre: string | null; telefono?: string | null; cedula?: string | null; email?: string | null; history?: HistoryCandidate[] };
  groups: IntakeGroup[]; onClose: () => void; onSuccess: () => void;
}) {
  const candidates = pending.history || [];
  const certainCandidate = candidates.length === 1 && candidates[0].confianza === 'segura' ? candidates[0] : null;
  const phone = normalizeIntakePhone(pending.telefono);
  const hasSharedPhone = phone.length >= 7 && candidates.some(c => normalizeIntakePhone(c.telefono) === phone);
  const [identityKey, setIdentityKey] = useState(certainCandidate ? `${certainCandidate.fuente}:${certainCandidate.id}` : '');
  const [confirmed, setConfirmed] = useState(false);
  const [courseKey, setCourseKey] = useState('');
  const [showOther, setShowOther] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [groupKey, setGroupKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sheet = dialog.current;
    sheet?.showModal();
    return () => { sheet?.close(); document.body.style.overflow = previousOverflow; };
  }, [mounted]);
  const candidate = candidates.find(c => `${c.fuente}:${c.id}` === identityKey);
  const courses = intakeCourses(groups, candidate);
  const hasPath = courses.some(c => c.kind !== 'other');
  const options = courses.filter(c => !hasPath || showOther || c.kind !== 'other');
  const selectedCourse = options.find(c => c.key === courseKey);
  const available = selectedCourse?.groups ?? [];
  const readyToChoose = !candidates.length || Boolean(identityKey);
  function resetDestination() {
    setCourseKey(''); setGroupKey(''); setShowOther(false); setError('');
  }
  const identityReady = !candidates.length || identityKey === 'new' || (candidate && confirmed);

  async function save() {
    if (!identityReady || !available.some(g => g.key === groupKey) || candidate?.activo || saving) return;
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
  return createPortal(<>
    <dialog ref={dialog} aria-labelledby="intake-assignment-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className={`${styles.sheet} fixed inset-0 m-auto max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top))-max(1rem,env(safe-area-inset-bottom)))] w-[calc(100%-1rem)] max-w-[34rem] overflow-hidden rounded-[30px] border border-white/90 p-0 text-slate-900 open:flex open:flex-col sm:w-[calc(100%-3rem)]`}>
      <header className={`${styles.hero} shrink-0 border-b border-white/90 px-4 py-4 sm:px-6 sm:py-5`}>
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white bg-white/80 text-blue-700 shadow-sm"><Route size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.13em] text-blue-800 uppercase">Continuidad académica</p>
            <h2 id="intake-assignment-title" className="mt-0.5 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">Elegir destino</h2>
            <p className="mt-1 truncate text-sm font-medium text-slate-700" title={pending.nombre ?? undefined}>{pending.nombre}</p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={saving} onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full border border-white bg-white/75 text-slate-700 shadow-sm transition hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500"><X size={19} aria-hidden="true" /></button>
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin] sm:px-6">
      {candidates.length > 0 && (pending.telefono || pending.cedula || pending.email) && <p className="mb-3 text-xs text-slate-600 [overflow-wrap:anywhere]"><strong>Datos del ingreso:</strong> {[pending.telefono, pending.cedula, pending.email].filter(Boolean).join(' · ')}</p>}
      {candidates.length > 0 && <fieldset className="min-w-0 max-w-full space-y-2 rounded-2xl border border-slate-200 bg-slate-100/70 p-2.5 sm:p-3">
        <legend className="max-w-full px-1 text-sm font-bold [overflow-wrap:anywhere] sm:text-base">{candidates.length === 1 && candidates[0].confianza === 'segura' ? 'Historial encontrado' : 'Posible historial encontrado'}</legend>
        {hasSharedPhone && !certainCandidate && <p className="text-sm leading-relaxed text-slate-700">Un número puede pertenecer a varios familiares. Revisa a quién corresponde este ingreso.</p>}
        {candidates.map(c => <label key={`${c.fuente}:${c.id}`} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-sm sm:p-3">
          <input className="mt-0.5 h-4 w-4 shrink-0" type="radio" name="intake-identity" value={`${c.fuente}:${c.id}`} checked={identityKey === `${c.fuente}:${c.id}`} disabled={saving}
            onChange={e => { setIdentityKey(e.target.value); setConfirmed(false); resetDestination(); }} />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><strong>{c.nombre}</strong><br />{c.motivo} · {c.telefono || 'Sin teléfono'}
            {c.cedula && <> · Documento: {c.cedula}</>}{c.email && <> · {c.email}</>}
            <br /><strong>{c.nivel ? lastCourseLabel(c.nivel, c.estado) : 'Sin cursos registrados'}</strong>
            {c.fecha && <><br />Último proceso: {new Date(c.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</>}
            {c.activo && <span className="block font-semibold text-amber-800">Esta persona ya tiene un proceso activo. Si estás registrando a otra persona, elige la opción de abajo para crear su propio registro.</span>}
          </span>
        </label>)}
        <label className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${identityKey === 'new' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}><input className="mt-0.5 h-4 w-4 shrink-0" type="radio" name="intake-identity" checked={identityKey === 'new'} disabled={saving}
          onChange={() => { setIdentityKey('new'); setConfirmed(false); resetDestination(); }} /><span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><strong>{hasSharedPhone ? 'Es un familiar u otra persona con este mismo número' : 'Es otra persona; crear un registro independiente'}</strong><span className="mt-1 block text-xs leading-relaxed text-slate-600">Se creará un registro para {pending.nombre}. Cada persona conservará sus propios cursos, asistencia e historial.</span></span></label>
        {candidate && <label className="flex min-w-0 items-start gap-2 border-t border-slate-200 pt-2 text-sm font-semibold">
          <input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={confirmed} disabled={saving || candidate.activo} onChange={e => setConfirmed(e.target.checked)} />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">Revisé los datos y confirmo que es la misma persona</span>
        </label>}
      </fieldset>}
      {identityKey === 'new' && hasSharedPhone && <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><UsersRound size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><p><strong>Número compartido confirmado.</strong> Elige el grupo de {pending.nombre} y confirma para crear su registro independiente con este teléfono.</p></div>}
      <section className="mt-3 min-w-0 rounded-[22px] border border-white bg-white/70 p-3 shadow-sm sm:p-4" aria-label="Destino de matrícula">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <label htmlFor="intake-course" className="text-sm font-semibold">01 · Curso de destino</label>
          {hasPath && !showOther && courses.some(c => c.kind === 'other') && <button type="button" disabled={saving || candidate?.activo}
            onClick={() => setShowOther(true)}
            className="rounded-full px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Ver otros cursos</button>}
        </div>
        <IntakePicker key={identityKey} id="intake-course" course placeholder="Seleccionar curso…" value={courseKey}
          options={options.map(c => ({ ...c, detail: c.groups.length ? c.detail : c.detail + ' · Sin grupos activos' }))}
          disabled={saving || !readyToChoose || candidate?.activo}
          onChange={key => {
            setCourseKey(key); setGroupKey(''); setError('');
          }} />
        {!readyToChoose && <p className="mt-2 text-xs text-slate-600">Elige primero a la persona del historial o crea un registro independiente.</p>}
        {readyToChoose && !options.length && <p className="mt-2 text-xs text-slate-600">No hay cursos disponibles para asignar.</p>}
        {selectedCourse && <div className="mt-4 border-t border-slate-200/70 pt-3">
          {available.length > 0 ? <>
            <label htmlFor="intake-group" className="block text-sm font-semibold">02 · Grupo disponible</label>
            <IntakeGroupSelect key={selectedCourse.key} id="intake-group" value={groupKey} groups={available}
              disabled={saving || candidate?.activo} onChange={setGroupKey} />
          </> : <p role="status" className="text-xs text-slate-600">Este curso no tiene grupos activos. Puedes elegir otro curso o dejar el ingreso pendiente.</p>}
        </div>}
      </section>
      {error && <div className="mt-3"><IntakeErrorNotice message={error} /></div>}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 p-4 shadow-[0_-4px_16px_rgba(15,23,42,0.025)] sm:flex sm:justify-end sm:gap-3 sm:px-6">
        <button disabled={saving} onClick={onClose} className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-[13px] font-medium sm:px-4 sm:text-sm">Cancelar</button>
        <button onClick={save} disabled={saving || !identityReady || !groupKey || candidate?.activo}
          className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-2 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-800 disabled:opacity-40 sm:px-4 sm:text-sm">{saving ? 'Guardando…' : 'Confirmar grupo'}{!saving && <ArrowRight size={15} aria-hidden="true" />}</button>
      </div>
    </dialog>
  </>, document.body);
}
