'use client';

import { ChevronRight, FileText, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export type ModuleDetail = {
  title: string;
  data: { nombre: string; telefono: string | null; cedula?: string }[];
  showDocument?: boolean;
};

export type ModuleDetailChoice = {
  key: string;
  day: string;
  count: number;
  load: () => Promise<ModuleDetail>;
};

export type ModuleSelection = {
  name: string;
  choices: ModuleDetailChoice[];
  selectedKey?: string;
  origin: DOMRect;
  trigger: HTMLButtonElement;
  tone?: number;
};

export function ModuleDetailDialog({ selection, onDismiss, onPdf }: {
  selection: ModuleSelection;
  onDismiss: () => void;
  onPdf: (detail: ModuleDetail) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [choice, setChoice] = useState(() => selection.choices.find(item => item.key === selection.selectedKey));
  const [result, setResult] = useState<ModuleDetail>();
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const pageSize = 10;
  const pageCount = Math.ceil((result?.data.length ?? 0) / pageSize);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    if (!dialog.open) dialog.showModal();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = dialog.getBoundingClientRect();
    const { x, y, width, height } = selection.origin;
    if (!width || !height || !target.width || !target.height) return;
    const animation = dialog.animate([
      { transform: `translate(${x - target.x}px, ${y - target.y}px) scale(${width / target.width}, ${height / target.height})` },
      { transform: 'none' },
    ], { duration: 370, easing: 'cubic-bezier(.2,.75,.22,1)' });
    return () => animation.cancel();
  }, [selection.origin]);

  useEffect(() => {
    if (!choice) return;
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      void choice.load().then(
        detail => { if (current) setResult(detail); },
        () => { if (current) setFailed(true); },
      );
    });
    return () => { current = false; };
  }, [choice]);

  function selectDay(next?: ModuleDetailChoice) {
    bodyRef.current?.focus({ preventScroll: true });
    setResult(undefined);
    setFailed(false);
    setExportFailed(false);
    setPage(0);
    setChoice(next);
  }

  function close() {
    dialogRef.current?.close();
    selection.trigger.focus({ preventScroll: true });
    onDismiss();
  }

  async function download() {
    if (!result) return;
    setExporting(true);
    setExportFailed(false);
    try {
      await onPdf(result);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="module-tile module-detail-dialog" data-module-tone={selection.tone}
      data-picking-day={!choice || undefined}
      aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      <div className="module-detail-layout">
        <header className="module-tile-heading module-detail-heading">
          <h2 id={titleId}>{selection.name}</h2>
          <div className="module-actions">
            {choice && <button type="button" onClick={download} disabled={exporting || !result?.data.length} aria-label="Descargar PDF del detalle" title="Descargar PDF">
              <FileText size={17} aria-hidden="true" />
            </button>}
            <button type="button" autoFocus onClick={close} aria-label="Cerrar detalle" title="Cerrar detalle"><X size={18} aria-hidden="true" /></button>
          </div>
        </header>
        <div ref={bodyRef} className="module-detail-body" tabIndex={-1}>
          {choice ? <>
            <h3>{result?.title ?? choice.day}</h3>
            {failed && <p role="status">No se pudo cargar el detalle.</p>}
            {!failed && !result && <p role="status">Cargando…</p>}
            {result && (result.data.length ? (
              <table>
                <thead><tr><th scope="col">Nombre</th>{result.showDocument && <th scope="col">Cédula</th>}<th scope="col">Teléfono</th></tr></thead>
                <tbody>{result.data.slice(page * pageSize, (page + 1) * pageSize).map((person, index) => (
                  <tr key={index}><td>{person.nombre}</td>{result.showDocument && <td>{person.cedula || '—'}</td>}<td>{person.telefono || '—'}</td></tr>
                ))}</tbody>
              </table>
            ) : <p>No hay registros para este día.</p>)}
            {exportFailed && <p role="status">No se pudo descargar el PDF.</p>}
          </> : <>
            <h3>Elige un día</h3>
            <ul className="module-detail-days">
              {selection.choices.map(item => <li key={item.key}>
                <button type="button" onClick={() => selectDay(item)}>
                  <span>{item.day}</span><strong>{item.count.toLocaleString('es-CO')}</strong><ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>)}
            </ul>
          </>}
        </div>
        {choice && (selection.choices.length > 1 || pageCount > 1) && <footer className="module-detail-footer">
          {selection.choices.length > 1 && <button type="button" onClick={() => selectDay()}>Cambiar día</button>}
          {pageCount > 1 && <nav aria-label="Páginas del detalle">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
            <span>{page + 1} / {pageCount}</span>
            <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Siguiente</button>
          </nav>}
        </footer>}
      </div>
    </dialog>
  );
}
