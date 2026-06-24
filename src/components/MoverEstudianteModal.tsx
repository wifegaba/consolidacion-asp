'use client';

import { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { moverEstudianteAction } from '@/app/actions';

type Dia = 'Domingo' | 'Martes' | 'Virtual';
type EtapaDestino = 'Semillas' | 'Devocionales' | 'Restauracion';

const ETAPAS_MOVER_CFG: { etapa: EtapaDestino; label: string; accent: string; accentText: string; bgIdle: string; textIdle: string }[] = [
  {
    etapa: 'Semillas',
    label: 'Semillas',
    accent: '#1d4ed8',
    accentText: '#ffffff',
    bgIdle: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    textIdle: '#1e40af',
  },
  {
    etapa: 'Devocionales',
    label: 'Devocionales',
    accent: '#6d28d9',
    accentText: '#ffffff',
    bgIdle: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    textIdle: '#5b21b6',
  },
  {
    etapa: 'Restauracion',
    label: 'Restauración',
    accent: '#065f46',
    accentText: '#ffffff',
    bgIdle: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    textIdle: '#047857',
  },
];

const MODULOS_POR_ETAPA: Record<EtapaDestino, number[]> = {
  Semillas:     [1, 2, 3, 4],
  Devocionales: [1, 2, 3, 4],
  Restauracion: [1],
};

export const MoverEstudianteModal = memo(function MoverEstudianteModal({
  open,
  onClose,
  studentName,
  progresoId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  studentName: string;
  progresoId: string;
  onSuccess: () => void;
}) {
  const [etapa, setEtapa] = useState<EtapaDestino | null>(null);
  const [modulo, setModulo] = useState<number | null>(null);
  const [diaD, setDiaD] = useState<Dia | null>(null);
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setEtapa(null); setModulo(null); setDiaD(null); setErrorMsg(null); setIsSuccess(false); }
  }, [open]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const canConfirm = etapa && modulo && diaD;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const { success, error: err } = await moverEstudianteAction(
        progresoId,
        etapa,
        modulo,
        1, // semana siempre 1
        diaD
      );
      if (!success) throw new Error(err || 'Error al mover el estudiante');
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error al mover el estudiante');
    } finally {
      setSaving(false);
    }
  };

  if (isSuccess) {
    return createPortal(
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
        <div aria-hidden="true" className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
        <div className="relative w-[min(400px,90vw)] overflow-hidden rounded-[32px] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.32)] ring-1 ring-black/10 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center mb-6 shadow-[inset_0_4px_12px_rgba(16,185,129,0.15)] ring-1 ring-green-500/20">
            <svg className="w-10 h-10 text-emerald-500 animate-[bounce_2s_ease-in-out_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2 text-center tracking-tight">¡Traslado exitoso!</h2>
          <p className="text-neutral-500 text-center leading-relaxed text-sm">
            <strong className="text-neutral-800">{studentName}</strong> ha sido movido a<br/>
            <span className="inline-block mt-1 font-medium px-2 py-1 bg-neutral-100 rounded-md text-neutral-700">
              {etapa} {modulo && modulo > 1 ? modulo : ''} • {diaD}
            </span>
          </p>
          <div className="w-full h-1 bg-neutral-100 mt-6 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 animate-[pulse_1s_ease-in-out_infinite] w-full" style={{ animation: 'shrink 3s linear forwards' }}></div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes shrink { from { width: 100%; } to { width: 0%; } }
          `}} />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div aria-hidden="true" className="fixed inset-0 bg-black/25 backdrop-blur-[4px]" onClick={onClose} />
      <div className="relative w-[min(500px,96vw)] max-h-[92vh] overflow-auto rounded-[24px] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.32)] ring-1 ring-black/10 flex flex-col">

        {/* Header clean — sin etiquetas, calidad visual en los estilos */}
        <div className="relative overflow-hidden rounded-t-[24px] px-6 py-6 bg-gradient-to-br from-[#0c1220] via-[#111827] to-[#0c1220]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.18),transparent)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-semibold text-white tracking-[-0.3px] leading-snug">Mover Estudiante</h2>
              <p className="mt-1 text-[13px] text-slate-400 leading-none">
                <span className="text-slate-200 font-medium">{studentName}</span>
                <span className="mx-1.5 text-slate-600">/</span>
                <span>selecciona la nueva etapa</span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-white/8 hover:bg-white/16 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-base leading-none"
            >×</button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Paso 1: Etapa */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2.5">Etapa destino</label>
            <div className="flex gap-2">
              {ETAPAS_MOVER_CFG.map((cfg) => (
                <button
                  key={cfg.etapa}
                  onClick={() => {
                    setEtapa(cfg.etapa);
                    // Auto-seleccionar módulo si solo hay uno
                    const mods = MODULOS_POR_ETAPA[cfg.etapa];
                    setModulo(mods.length === 1 ? mods[0] : null);
                    setDiaD(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-[10px] text-[13px] font-semibold tracking-[-0.1px] transition-all duration-200 ${
                    etapa === cfg.etapa
                      ? 'text-white shadow-[0_4px_14px_rgba(0,0,0,0.20)] scale-[1.03]'
                      : 'hover:scale-[1.01] hover:shadow-sm'
                  }`}
                  style={etapa === cfg.etapa
                    ? { background: `linear-gradient(160deg, ${cfg.accent}ee, ${cfg.accent})` }
                    : { background: cfg.bgIdle, color: cfg.textIdle, border: '1px solid transparent' }
                  }
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paso 2: Módulo — oculto si Restauración (auto-seleccionado) */}
          {etapa && MODULOS_POR_ETAPA[etapa].length > 1 && (
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2.5">Módulo</label>
              <div className="flex gap-2">
                {MODULOS_POR_ETAPA[etapa].map((m) => (
                  <button
                    key={m}
                    onClick={() => setModulo(m)}
                    className={`flex-1 py-2.5 rounded-[10px] border font-bold text-base transition-all duration-150 ${
                      modulo === m
                        ? 'border-transparent text-white bg-[#111827] shadow-[0_2px_10px_rgba(0,0,0,0.20)] scale-[1.03]'
                        : 'border-neutral-200/80 text-neutral-700 bg-white hover:bg-neutral-50 hover:border-neutral-300'
                    }`}
                  >{m}</button>
                ))}
              </div>
            </div>
          )}


          {/* Paso 3: Día */}
          {etapa && modulo && (
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2.5">Día</label>
              <div className="flex gap-2">
                {(['Domingo', 'Martes', 'Virtual'] as Dia[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiaD(d)}
                    className={`flex-1 py-2.5 rounded-[10px] border font-semibold text-[13px] transition-all duration-150 ${
                      diaD === d
                        ? 'border-transparent text-white bg-emerald-600 shadow-[0_2px_10px_rgba(5,150,105,0.28)] scale-[1.03]'
                        : 'border-neutral-200/80 text-neutral-700 bg-white hover:bg-neutral-50 hover:border-neutral-300'
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>
          )}

          {/* Resumen destino */}
          {canConfirm && (
            <div className="rounded-[10px] bg-neutral-50 border border-neutral-200/70 px-4 py-2.5 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-[13px] font-medium text-neutral-700">
                {etapa} {modulo} &middot; {diaD}
              </p>
            </div>
          )}

          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{errorMsg}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-[10px] border border-neutral-200/80 text-[13px] font-semibold text-neutral-600 bg-white hover:bg-neutral-50 transition-colors"
            >Cancelar</button>
            <button
              disabled={!canConfirm || saving}
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold text-white bg-[#111827] hover:bg-[#1f2937] shadow-[0_2px_12px_rgba(0,0,0,0.22)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >{saving ? 'Moviendo…' : 'Confirmar traslado'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});
