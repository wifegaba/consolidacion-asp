'use client';

import { useEffect, useState } from 'react';
import IntakeAssignmentModal from './IntakeAssignmentModal';
import IntakeErrorNotice from './IntakeErrorNotice';
import { type HistoryCandidate, type IntakeGroup } from '@/lib/ingresoHistory';
import { ReintegrateButton, StudentReturnBadge, returnLevel } from './StudentReturnDetails';

type Pending = { id: string; nombre: string; history: HistoryCandidate[] };
export default function IntakePendingPanel({ refreshKey, onSuccess }: { refreshKey: unknown; onSuccess: () => void }) {
  const [rows, setRows] = useState<Pending[]>([]);
  const [groups, setGroups] = useState<IntakeGroup[]>([]);
  const [selected, setSelected] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/ingresos', { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setRows(result.pendientes); setGroups(result.groups); setError('');
      } catch (e) {
        if (!controller.signal.aborted) { setRows([]); setError(e instanceof Error ? e.message : 'Error al consultar ingresos'); }
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, version]);
  return <div className="mx-3 mb-3 shrink-0 rounded-xl border border-indigo-200 bg-white/70 p-3">
    <div className="flex justify-between gap-3"><h3 className="text-sm font-bold text-indigo-800">Ingresos pendientes ({rows.length})</h3>
      <button onClick={() => setVersion(v => v + 1)} className="text-xs text-indigo-700">Actualizar</button></div>
    {error && <div className="mt-2"><IntakeErrorNotice message={error} /></div>}
    <div className="max-h-48 overflow-y-auto">
      {rows.map(row => <div key={row.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100 pt-2">
        <div><button type="button" onClick={() => setSelected(row)} className="text-left text-sm font-semibold text-slate-800 hover:text-emerald-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50">{row.nombre}</button>
          {returnLevel(row.history) && <div className="mt-1.5"><StudentReturnBadge level={returnLevel(row.history)} /></div>}
        </div>
        {row.history.some(c => c.nivel) && <ReintegrateButton onClick={() => setSelected(row)} />}
      </div>)}
    </div>
    {selected && <IntakeAssignmentModal pending={selected} groups={groups} onClose={() => setSelected(null)}
      onSuccess={() => { setSelected(null); setVersion(v => v + 1); onSuccess(); }} />}
  </div>;
}
