"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* =========================================
   Tipos
========================================= */
type PromRow = {
  id: string;
  semana_promocion: string;
  nombre: string;
  cedula: string;
  telefono: string | null;
  curso_actual: string | null;
  confirmo: boolean | null;
  listado: string | null;
  entrevista: boolean | null;
  fecha_seguimiento: string | null; // "YYYY-MM-DD"
  observaciones: string | null;
  created_at: string;
};

const ESTADOS = [
  "todos",
  "PROMOVIDO",
  "PASA A BANCO",
  "PASA A DOMINGO",
  "NO ESTA EN NINGUNA LISTA",
] as const;

type Estado = (typeof ESTADOS)[number];

/* =========================================
   Utils & Hooks
========================================= */
function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================================
   Página
========================================= */
export default function PromovidosPage() {
  // Estado base
  const [items, setItems] = useState<PromRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});

  // Filtros con URL-state
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [search, setSearch] = useState<string>(params?.get("search") ?? "");
  const [estado, setEstado] = useState<Estado>((params?.get("estado") as Estado) ?? "todos");
  const [desde, setDesde] = useState<string>(params?.get("desde") ?? "");
  const [hasta, setHasta] = useState<string>(params?.get("hasta") ?? "");

  // Debounced inputs
  const dSearch = useDebounced(search);
  const dEstado = useDebounced(estado);
  const dDesde = useDebounced(desde);
  const dHasta = useDebounced(hasta);

  // Atajo para foco en búsqueda
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Selectores
  const allSelected = useMemo(
    () => items.length > 0 && items.every((r) => sel[r.id]),
    [items, sel]
  );
  const selectedIds = useMemo(
    () => Object.entries(sel).filter(([, v]) => v).map(([id]) => id),
    [sel]
  );

  // Shift+click range select
  const lastClickedIndex = useRef<number | null>(null);
  const onRowCheckbox = (idx: number, id: string, checked: boolean) => {
    setSel((s) => ({ ...s, [id]: checked }));
    if (lastClickedIndex.current !== null && (window as any).event?.shiftKey) {
      const [start, end] = [lastClickedIndex.current, idx].sort((a, b) => a - b);
      const patch: Record<string, boolean> = {};
      for (let i = start; i <= end; i++) patch[items[i].id] = checked;
      setSel((s) => ({ ...s, ...patch }));
    }
    lastClickedIndex.current = idx;
  };

  const toggleAll = () => {
    if (allSelected) {
      setSel({});
    } else {
      const s: Record<string, boolean> = {};
      items.forEach((r) => (s[r.id] = true));
      setSel(s);
    }
  };

  // Sincroniza filtros → URL (para navegación nativa back/forward)
  const syncQueryToUrl = useCallback((qs: URLSearchParams) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.pathname}?${qs.toString()}`;
    window.history.replaceState({}, "", url);
  }, []);

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (dSearch) qs.set("search", dSearch);
    if (dEstado) qs.set("estado", dEstado);
    if (dDesde) qs.set("desde", dDesde);
    if (dHasta) qs.set("hasta", dHasta);

    // persiste filtros en URL
    syncQueryToUrl(qs);

    const res = await fetch(`/api/promovidos?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json();
    setItems(json.data ?? []);
    setSel({});
    setLoading(false);
  }, [dSearch, dEstado, dDesde, dHasta, syncQueryToUrl]);

  // Primera carga + cada vez que cambian filtros debounced
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actions
  const doAction = async (observaciones: string) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    await fetch("/api/promovidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, patch: { observaciones } }),
    });
    await fetchData();
  };

  const exportCSV = () => {
    const headers = [
      "semana_promocion",
      "nombre",
      "cedula",
      "telefono",
      "curso_actual",
      "confirmo",
      "listado",
      "entrevista",
      "fecha_seguimiento",
      "observaciones",
    ];
    const rows = items.map((r) =>
      [
        r.semana_promocion,
        r.nombre,
        r.cedula,
        r.telefono ?? "",
        r.curso_actual ?? "",
        r.confirmo === null ? "" : r.confirmo ? "SI" : "NO",
        r.listado ?? "",
        r.entrevista === null ? "" : r.entrevista ? "SI" : "NO",
        r.fecha_seguimiento ?? "",
        r.observaciones ?? "",
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promovidos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* =========================================
     UI
  ========================================= */
  return (
    <main
      className="min-h-[100dvh] p-4 md:p-8 bg-gradient-to-br from-[#f7f9fc] via-[#e8ecff] to-[#f0f4ff] relative"
      aria-busy={loading ? "true" : "false"}
    >
      {/* Fondo premium animado */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1 }}
        className="absolute inset-0 -z-10 pointer-events-none"
      >
        <motion.div
          className="absolute top-[-12%] right-[-10%] w-[620px] h-[620px] rounded-full bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-purple-400/10 blur-3xl shadow-2xl"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2, type: "spring" }}
        />
        <motion.div
          className="absolute bottom-[-15%] left-[-10%] w-[440px] h-[440px] rounded-full bg-gradient-to-tr from-cyan-300/30 via-sky-300/20 to-blue-200/10 blur-2xl shadow-xl"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.35, type: "spring" }}
        />
      </motion.div>

      <div className="mx-auto w-full max-w-6xl space-y-6 md:space-y-8">
        {/* Header */}
        <motion.header
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-3 py-3 bg-white/70 rounded-2xl shadow-sm border border-white/60 supports-[backdrop-filter]:backdrop-blur-xl"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, type: "spring" }}
          role="region"
          aria-label="Encabezado de promovidos"
        >
          <div className="flex flex-col min-w-0">
            <motion.h1
              className="text-[2.2rem] md:text-[2.5rem] font-black tracking-tight text-slate-900 leading-tight"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              style={{ letterSpacing: "-0.02em", lineHeight: "1.1" }}
            >
              Listado de Promovidos
            </motion.h1>
            <motion.p
              className="text-[1.02rem] text-slate-600 font-medium leading-snug mt-1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
            >
              Continuación de la entrevista. Filtra, selecciona y ejecuta acciones masivas.
            </motion.p>
          </div>

          <motion.div
            className="flex flex-wrap items-center justify-end gap-2 md:gap-3"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.45 }}
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => doAction("PROMOVIDO")}
              className="btn-premium-mac btn-premium-mac-primary"
            >
              Marcar PROMOVIDO
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => doAction("PASA A BANCO")}
              className="btn-premium-mac"
            >
              Enviar a BANCO
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => doAction("PASA A DOMINGO")}
              className="btn-premium-mac"
            >
              Pasa a DOMINGO
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportCSV}
              className="btn-premium-mac"
            >
              Exportar CSV
            </motion.button>
          </motion.div>
        </motion.header>

        {/* Filtros - floating labels + chips */}
        <motion.section
          className="rounded-3xl ring-1 ring-white/60 bg-white/80 supports-[backdrop-filter]:backdrop-blur-2xl shadow-[0_24px_80px_-24px_rgba(15,23,42,0.18)] p-4 md:p-6"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          aria-label="Filtros"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Buscar */}
            <div className="md:col-span-2">
              <div className="fl-group">
                <input
                  ref={searchRef}
                  id="f-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder=" "
                  className="fl-input"
                  aria-label="Buscar por nombre, cédula o teléfono"
                />
                <label htmlFor="f-search" className="fl-label">Buscar (Ctrl/Cmd + K)</label>
              </div>
            </div>

            {/* Estado → chips + select invisible para accesibilidad */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600">Estado</span>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEstado(e)}
                    className={cn(
                      "chip",
                      estado === e && "chip-active"
                    )}
                    aria-pressed={estado === e}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <select
                aria-hidden
                tabIndex={-1}
                className="hidden"
                value={estado}
                onChange={(ev) => setEstado(ev.target.value as Estado)}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            {/* Desde */}
            <div>
              <div className="fl-group">
                <input
                  id="f-desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  placeholder=" "
                  className="fl-input"
                />
                <label htmlFor="f-desde" className="fl-label">Desde</label>
              </div>
            </div>

            {/* Hasta */}
            <div>
              <div className="fl-group">
                <input
                  id="f-hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  placeholder=" "
                  className="fl-input"
                />
                <label htmlFor="f-hasta" className="fl-label">Hasta</label>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={fetchData} className="btn-primary">
              Aplicar ahora
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSearch(""); setEstado("todos"); setDesde(""); setHasta("");
              }}
              className="btn-secondary"
            >
              Limpiar
            </motion.button>
          </div>
        </motion.section>

        {/* Bulk bar sticky */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="sticky top-2 z-20 mx-auto max-w-6xl rounded-2xl border border-indigo-200/60 bg-indigo-50/80 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(67,56,202,.25)] p-3 flex items-center justify-between"
              role="status"
              aria-live="polite"
            >
              <div className="text-sm font-semibold text-indigo-900">
                {selectedIds.length} seleccionado(s)
              </div>
              <div className="flex gap-2">
                <button className="btn-mini" onClick={() => doAction("PROMOVIDO")}>Promover</button>
                <button className="btn-mini" onClick={() => doAction("PASA A BANCO")}>Banco</button>
                <button className="btn-mini" onClick={() => doAction("PASA A DOMINGO")}>Domingo</button>
                <button className="btn-mini-outline" onClick={() => setSel({})}>Quitar selección</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabla */}
        <motion.section
          className="rounded-3xl ring-1 ring-white/60 bg-white/90 supports-[backdrop-filter]:backdrop-blur-2xl shadow-[0_24px_80px_-24px_rgba(15,23,42,0.18)] overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          aria-label="Resultados"
        >
          <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <table className="min-w-full text-sm">
              <thead className="bg-white/80 sticky top-0 z-10 backdrop-blur-xl">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2"><input aria-label="Seleccionar todo" type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th className="px-3 py-2">Semana</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Cédula</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Curso actual</th>
                  <th className="px-3 py-2">Confirmó</th>
                  <th className="px-3 py-2">Listado</th>
                  <th className="px-3 py-2">Entrevista</th>
                  <th className="px-3 py-2">Seguimiento</th>
                  <th className="px-3 py-2">Observaciones</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Skeleton */}
                <AnimatePresence>
                  {loading && Array.from({ length: 6 }).map((_, i) => (
                    <motion.tr
                      key={`s-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td className="px-3 py-3"><div className="skeleton h-4 w-4 rounded"></div></td>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="skeleton h-4 w-[8ch] md:w-[16ch] rounded"></div>
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right">
                        <div className="skeleton h-7 w-[120px] rounded-full ml-auto"></div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {/* Empty state */}
                {!loading && items.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-slate-500 text-center" colSpan={12}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="skeleton h-10 w-10 rounded-full"></div>
                        <p>Sin resultados con los filtros actuales.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Rows */}
                {!loading && items.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/60 transition-colors duration-150"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!sel[r.id]}
                        onChange={(e) => onRowCheckbox(idx, r.id, e.target.checked)}
                        aria-label={`Seleccionar ${r.nombre}`}
                      />
                    </td>
                    <td className="px-3 py-2">{r.semana_promocion}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.nombre}</td>
                    <td className="px-3 py-2 tabular-nums">{r.cedula}</td>
                    <td className="px-3 py-2">{r.telefono ?? "—"}</td>
                    <td className="px-3 py-2">{r.curso_actual ?? "—"}</td>
                    <td className="px-3 py-2">{r.confirmo === null ? "—" : r.confirmo ? "Sí" : "No"}</td>
                    <td className="px-3 py-2">{r.listado ?? "—"}</td>
                    <td className="px-3 py-2">{r.entrevista === null ? "—" : r.entrevista ? "Sí" : "No"}</td>
                    <td className="px-3 py-2">{r.fecha_seguimiento ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
                          r.observaciones === "PROMOVIDO" && "bg-emerald-100 text-emerald-700",
                          r.observaciones === "PASA A BANCO" && "bg-orange-100 text-orange-700",
                          r.observaciones === "PASA A DOMINGO" && "bg-sky-100 text-sky-700",
                          !r.observaciones && "bg-slate-100 text-slate-600"
                        )}
                      >
                        {r.observaciones ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.97 }} className="btn-mini" onClick={() => { setSel({ [r.id]: true }); doAction("PROMOVIDO"); }}>Promover</motion.button>
                        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.97 }} className="btn-mini" onClick={() => { setSel({ [r.id]: true }); doAction("PASA A BANCO"); }}>Banco</motion.button>
                        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.97 }} className="btn-mini" onClick={() => { setSel({ [r.id]: true }); doAction("PASA A DOMINGO"); }}>Domingo</motion.button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>

      {/* Estilos globales premium 2025 */}
      <style jsx global>{`
        /* Floating label */
        .fl-group { position: relative; }
        .fl-input {
          width: 100%;
          border-radius: 1rem;
          padding: 1.1rem 1rem .7rem 1rem;
          background: rgba(255,255,255,.9);
          border: 1.5px solid rgba(226,232,240,.9);
          font-size: 1rem;
          box-shadow: 0 8px 32px -12px rgba(15,23,42,.18);
          transition: box-shadow .2s, border .2s, background .2s;
        }
        .fl-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 2px #6366f1, 0 8px 32px -12px rgba(99,102,241,.18);
          background: rgba(255,255,255,.98);
        }
        .fl-label {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          color: #64748b;
          font-size: .95rem;
          pointer-events: none;
          transition: all .18s ease;
        }
        .fl-input:focus + .fl-label,
        .fl-input:not(:placeholder-shown) + .fl-label {
          top: .52rem;
          font-size: .72rem;
          color: #6366f1;
          background: transparent;
        }

        /* Chips estado */
        .chip {
          --bd: rgba(99,102,241,.25);
          border: 1.5px solid var(--bd);
          border-radius: 999px;
          padding: .38rem .75rem;
          font-weight: 600;
          font-size: .86rem;
          color: #4338ca;
          background: #fff;
          box-shadow: 0 2px 8px -4px #6366f122;
          transition: transform .15s, box-shadow .15s, background .15s, color .15s;
        }
        .chip:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -10px #6366f144; }
        .chip-active {
          background: linear-gradient(90deg,#6366f1,#0ea5e9);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 6px 18px -10px rgba(14,165,233,.35);
        }

        /* Botones */
        .btn-premium-mac {
          background: #fff;
          color: #6366f1;
          border-radius: .9rem;
          padding: .44rem 1.05rem;
          font-weight: 700;
          font-size: 1.01rem;
          border: 1.5px solid #e0e7ff;
          box-shadow: 0 2px 8px -4px #6366f122;
          transition: box-shadow .18s, transform .18s, background .18s, color .18s;
          outline: none;
          min-width: 0;
        }
        .btn-premium-mac-primary {
          background: linear-gradient(90deg,#6366f1,#0ea5e9);
          color: #fff;
          border: none;
          box-shadow: 0 4px 16px -8px #60a5fa33;
        }
        .btn-primary{
          background: linear-gradient(90deg,#6366f1,#0ea5e9);
          color: #fff; border: none; border-radius: .9rem;
          padding: .6rem 1rem; font-weight: 700; box-shadow: 0 6px 18px -10px rgba(14,165,233,.35);
        }
        .btn-secondary{
          background: #fff; color: #334155; border: 1.5px solid #e2e8f0;
          border-radius: .9rem; padding: .6rem 1rem; font-weight: 700;
        }
        .btn-mini{
          background: linear-gradient(90deg,#6366f1,#0ea5e9);
          color: #fff; font-size: 13px; padding: .38rem .7rem;
          border-radius: .7rem; font-weight: 700; border: none;
          box-shadow: 0 4px 16px -8px rgba(99,102,241,.18);
          transition: box-shadow .2s, transform .2s;
        }
        .btn-mini-outline{
          background: #fff; color:#334155; font-size: 13px; padding:.38rem .7rem;
          border-radius:.7rem; font-weight:700; border:1.5px solid #e2e8f0;
        }

        /* Skeleton */
        .skeleton{
          position: relative; overflow: hidden; background: #eef2ff;
        }
        .skeleton::after{
          content:""; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent);
          transform: translateX(-100%);
          animation: shimmer 1.6s infinite;
        }
        @keyframes shimmer{ 100% { transform: translateX(100%); } }
      `}</style>
    </main>
  );
}
