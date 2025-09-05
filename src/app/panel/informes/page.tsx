'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** ===== Tipos ===== */
type Dia = 'Domingo' | 'Martes' | 'Virtual';
type Semana = 1 | 2 | 3;
type EtapaBase = 'Semillas' | 'Devocionales' | 'Restauración';

type Registro = {
  id?: string;
  nombre: string;
  telefono: string;
  etapa: EtapaBase;
  modulo: number;
  dia: Dia;
  semana: Semana;
  estado?: string | null;
  cedula?: string | null;
  creado_en?: string | null;
};

/** ===== Constantes ===== */
const ETAPAS: EtapaBase[] = ['Semillas', 'Devocionales', 'Restauración'];
const MODULOS = [1, 2, 3, 4];
const DIAS: Dia[] = ['Domingo', 'Martes', 'Virtual'];
const SEMANAS: Semana[] = [1, 2, 3];

const ETIQUETAS_ESTADO: Record<string, string> = {
  confirmo_asistencia: 'Confirmó asistencia',
  no_contesta: 'No contesta',
  llamar_de_nuevo: 'Llamar de nuevo',
  no_por_ahora: 'No por ahora',
  salio_de_viaje: 'Salió de viaje',
  ya_esta_en_ptmd: 'Ya está en PTMD',
  no_tiene_transporte: 'Sin transporte',
  vive_fuera: 'Vive fuera',
  murio: 'Falleció',
  rechazado: 'Rechazado',
};

const SOURCE_VIEW = 'v_llamadas_pendientes';
const REALTIME_TABLES: { schema: string; table: string }[] = [
  { schema: 'public', table: 'progresos' },
  { schema: 'public', table: 'llamadas' },
];

export default function Page() {
  const [filtros, setFiltros] = useState<{ etapa: EtapaBase; modulo: number; dia: Dia; semana: Semana }>({
    etapa: 'Semillas',
    modulo: 1,
    dia: 'Domingo',
    semana: 1,
  });
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<(Registro & { _nuevo?: boolean; _ts?: number })[]>([]);
  const fadeTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const filtrosActivos = useMemo(() => ({ ...filtros, q: busqueda.trim() }), [filtros, busqueda]);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      let query = supabase
        .from(SOURCE_VIEW)
        .select('*')
        .eq('etapa', filtrosActivos.etapa)
        .eq('modulo', filtrosActivos.modulo)
        .eq('dia', filtrosActivos.dia)
        .eq('semana', filtrosActivos.semana)
        .order('nombre', { ascending: true });

      if (filtrosActivos.q) {
        query = query.or(
          `nombre.ilike.%${filtrosActivos.q}%,telefono.ilike.%${filtrosActivos.q}%,cedula.ilike.%${filtrosActivos.q}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const normalizados = (data || []).map((d: any) => ({
        id: d.id?.toString?.() ?? d.id,
        nombre: d.nombre,
        telefono: d.telefono,
        etapa: d.etapa,
        modulo: Number(d.modulo),
        dia: d.dia,
        semana: Number(d.semana),
        estado: d.estado ?? null,
        cedula: d.cedula ?? null,
        creado_en: d.creado_en ?? null,
      })) as Registro[];

      setItems(normalizados);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar datos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosActivos.etapa, filtrosActivos.modulo, filtrosActivos.dia, filtrosActivos.semana]);

  useEffect(() => {
    const channels = REALTIME_TABLES.map(({ schema, table }) =>
      supabase
        .channel(`rt-${schema}-${table}-${filtros.etapa}-${filtros.modulo}-${filtros.dia}-${filtros.semana}`)
        .on('postgres_changes', { event: '*', schema, table }, (payload) => {
          const row: any = payload.new || payload.old || {};
          const coincide =
            (row.etapa ?? row.etapa_base ?? row.etapa_det) === filtros.etapa &&
            Number(row.modulo ?? row.modulo_base ?? row.modulo_det) === filtros.modulo &&
            (row.dia ?? row.dia_culto) === filtros.dia &&
            Number(row.semana) === filtros.semana;

          cargar().then(() => {
            const id = (row.id ?? row.progreso_id ?? row.llamada_id)?.toString?.() ?? row.id;
            if (!id) return;
            setItems((prev) =>
              prev.map((it) => ((it.id ?? '').toString() === id.toString() ? { ...it, _nuevo: true, _ts: Date.now() } : it))
            );
            try {
              if (fadeTimers.current[id]) clearTimeout(fadeTimers.current[id]);
              fadeTimers.current[id] = setTimeout(() => {
                setItems((prev) =>
                  prev.map((it) => ((it.id ?? '').toString() === id.toString() ? { ...it, _nuevo: false } : it))
                );
              }, 5000);
            } catch {}
          });
        })
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
      Object.values(fadeTimers.current).forEach((t) => clearTimeout(t));
      fadeTimers.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.etapa, filtros.modulo, filtros.dia, filtros.semana]);

  const reactivarDesdeArchivo = async (registro: Registro) => {
    setCargando(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('fn_reactivar_desde_archivo', {
        p_progreso: registro.id ?? null,
        p_persona: null,
        p_nombre: registro.nombre,
        p_telefono: registro.telefono,
        p_estudio: registro.dia,
        p_nota: 'Reactivado desde Banco Archivo',
        p_servidor: null,
      });
      if (error) throw error;
      await cargar();
    } catch (e: any) {
      setError(e.message ?? 'Error al reactivar.');
    } finally {
      setCargando(false);
    }
  };

  const stats = useMemo(() => {
    const total = items.length;
    const porEstado: Record<string, number> = {};
    items.forEach((it) => {
      const k = it.estado ?? '—';
      porEstado[k] = (porEstado[k] ?? 0) + 1;
    });
    return { total, porEstado };
  }, [items]);

  return (
    <main className="wrapper">
      {/* TOOLBAR con estilo premium */}
      <section className="toolbar">
        <div className="filterGroup">
          <div className="field">
            <span className="label">Etapa</span>
            <select
              className="control"
              value={filtros.etapa}
              onChange={(e) => setFiltros((s) => ({ ...s, etapa: e.target.value as EtapaBase }))}
              aria-label="Etapa"
            >
              {ETAPAS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Módulo</span>
            <select
              className="control"
              value={filtros.modulo}
              onChange={(e) => setFiltros((s) => ({ ...s, modulo: Number(e.target.value) }))}
              aria-label="Módulo"
            >
              {MODULOS.map((m) => (
                <option key={m} value={m}>{`Módulo ${m}`}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Día</span>
            <select
              className="control"
              value={filtros.dia}
              onChange={(e) => setFiltros((s) => ({ ...s, dia: e.target.value as Dia }))}
              aria-label="Día"
            >
              {DIAS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Semana</span>
            <select
              className="control"
              value={filtros.semana}
              onChange={(e) => setFiltros((s) => ({ ...s, semana: Number(e.target.value) as Semana }))}
              aria-label="Semana"
            >
              {SEMANAS.map((s) => (
                <option key={s} value={s}>{`Semana ${s}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="searchGroup">
          <div className="searchField">
            <span className="label">Buscar</span>
            <input
              className="control"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, teléfono o cédula…"
            />
          </div>
          <button className="btnPrimary" onClick={cargar} disabled={cargando}>
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </section>

      {/* KPIs */}
      <section className="kpis">
        <div className="kpiCard">
          <span className="kpiLabel">Total</span>
          <span className="kpiValue">{stats.total}</span>
        </div>

        {Object.entries(stats.porEstado).map(([k, v]) => (
          <div key={k} className="kpiChip" title={k}>
            <span className="dot" />
            <span className="chipText">{ETIQUETAS_ESTADO[k] ?? k}</span>
            <span className="chipCount">{v}</span>
          </div>
        ))}
      </section>

      {/* Tabla */}
      <section className="tableCard">
        <div className="tableHeader">
          <span>{filtros.etapa} · Módulo {filtros.modulo} · {filtros.dia} · Semana {filtros.semana}</span>
          <span className="counter">{items.length}</span>
        </div>

        <div className="table">
          <div className="thead">
            <div>Nuevo</div>
            <div>Nombre</div>
            <div>Teléfono</div>
            <div>Cédula</div>
            <div>Etapa</div>
            <div>Mód.</div>
            <div>Día</div>
            <div>Sem.</div>
            <div>Estado</div>
            <div>Acciones</div>
          </div>

          <div className="tbody">
            {items.length === 0 && <div className="empty">{cargando ? 'Cargando…' : 'Sin resultados'}</div>}

            {items.map((it) => (
              <div key={(it.id ?? `${it.nombre}-${it.telefono}`)} className="row">
                <div className="cellBadge">
                  {it._nuevo && <span className="badgeNuevo">Nuevo</span>}
                </div>
                <div>{it.nombre}</div>
                <div>{it.telefono}</div>
                <div>{it.cedula ?? '—'}</div>
                <div>{it.etapa}</div>
                <div>{it.modulo}</div>
                <div>{it.dia}</div>
                <div>{it.semana}</div>
                <div>{ETIQUETAS_ESTADO[it.estado ?? ''] ?? '—'}</div>
                <div className="cellActions">
                  <button className="btnTiny" onClick={() => reactivarDesdeArchivo(it)}>Reactivar</button>
                  <button className="btnTinyAlt" onClick={() => { /* detalle opcional */ }}>Detalle</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {/* ===== CSS (styled-jsx) con look “inicio” mejorado ===== */}
      <style jsx>{`
        :root{
          --bg: #eef2f7;
          --card: rgba(255,255,255,0.75);
          --card-2: rgba(255,255,255,0.95);
          --stroke: rgba(0,0,0,0.08);
          --text: #1f2a44;
          --muted: #6b7380;
          --primary: #4c8dff;
          --primary-2: #346dff;
          --success: #28b463;
          --danger: #ff5c5c;
          --shadow-soft: 0 16px 30px rgba(13,38,76,.10);
          --inner-soft: inset 7px 7px 14px rgba(0,0,0,0.06), inset -7px -7px 14px rgba(255,255,255,0.9);
          --ring: 0 0 0 4px rgba(76,141,255,.12);
        }

        .wrapper{
          display: grid;
          gap: 18px;
          padding: 18px;
          min-height: 100dvh;
          background:
            radial-gradient(1100px 380px at 100% 0%, rgba(76,141,255,.10), transparent 60%),
            radial-gradient(900px 320px at 0% 100%, rgba(255,140,180,.08), transparent 60%),
            var(--bg);
        }

        /* ===== Toolbar refinada ===== */
        .toolbar{
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: end;
          padding: 16px;
          border-radius: 20px;
          background: var(--card);
          border: 1px solid var(--stroke);
          box-shadow: var(--shadow-soft);
        }

        .filterGroup{
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 14px;
        }

        .searchGroup{
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: end;
        }

        .field{ display: grid; gap: 8px; }
        .label{
          font-size: 12px;
          color: var(--muted);
          padding-left: 4px;
        }

        .control{
          width: 100%;
          padding: 12px 14px;
          background: var(--card-2);
          border: 1px solid var(--stroke);
          border-radius: 14px;
          color: var(--text);
          outline: none;
          box-shadow: var(--inner-soft);
          transition: box-shadow .15s, border-color .15s, transform .02s;
        }
        .control:focus{ border-color: var(--primary); box-shadow: var(--ring), var(--inner-soft); }

        .btnPrimary{
          height: 44px;
          padding: 0 18px;
          background: linear-gradient(180deg, var(--primary), var(--primary-2));
          border: 1px solid #2b54ff33;
          color: #fff;
          border-radius: 12px;
          font-weight: 600;
          letter-spacing: .2px;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(52,109,255,.28);
        }
        .btnPrimary:disabled{ opacity:.7; cursor:not-allowed; }

        /* ===== KPIs ===== */
        .kpis{
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .kpiCard{
          display: grid;
          align-content: center;
          gap: 4px;
          padding: 14px 18px;
          min-width: 140px;
          background: var(--card);
          border: 1px solid var(--stroke);
          border-radius: 16px;
          box-shadow: var(--shadow-soft);
        }
        .kpiLabel{ color: var(--muted); font-size: 12px; }
        .kpiValue{ color: var(--text); font-weight: 800; font-size: 22px; }

        .kpiChip{
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 999px;
          background: var(--card-2);
          border: 1px solid var(--stroke);
          box-shadow: var(--shadow-soft);
        }
        .dot{ width: 8px; height: 8px; border-radius: 999px; background: var(--primary); opacity: .9; }
        .chipText{ color: var(--text); font-size: 13px; }
        .chipCount{
          background: #f3f6ff;
          border: 1px solid #dfe6ff;
          color: #27408b;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 12px;
        }

        /* ===== Tabla ===== */
        .tableCard{
          background: var(--card);
          border: 1px solid var(--stroke);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow-soft);
        }

        .tableHeader{
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--stroke);
          color: var(--muted);
          background: linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,255,255,.6));
        }

        .counter{
          background: var(--card-2);
          padding: 4px 10px;
          border: 1px solid var(--stroke);
          border-radius: 999px;
          color: var(--text);
          font-size: 12px;
          box-shadow: var(--shadow-soft);
        }

        .table{ display: grid; }

        .thead, .row{
          display: grid;
          grid-template-columns: 95px 1.3fr 1fr .9fr .8fr .6fr .8fr .6fr 1fr .9fr;
          gap: 10px;
          align-items: center;
          padding: 12px 16px;
        }

        .thead{
          position: sticky; top: 0;
          background: linear-gradient(0deg, rgba(255,255,255,.9), rgba(255,255,255,.7));
          color: var(--muted);
          font-size: 12px;
          border-bottom: 1px solid var(--stroke);
          z-index: 1;
        }

        .tbody{ display: grid; }
        .row{
          color: var(--text);
          border-bottom: 1px solid var(--stroke);
          background: rgba(255,255,255,.6);
        }

        .cellBadge{ display:flex; align-items:center; gap:6px; }
        .badgeNuevo{
          padding: 4px 8px;
          background: rgba(46,204,113,0.12);
          color: var(--success);
          border: 1px solid rgba(46,204,113,0.35);
          border-radius: 999px;
          font-size: 12px;
          box-shadow: var(--shadow-soft);
        }

        .cellActions{ display: flex; gap: 6px; justify-content: flex-end; }
        .btnTiny, .btnTinyAlt{
          padding: 6px 10px;
          border-radius: 10px;
          font-size: 12px;
          cursor: pointer;
          border: 1px solid var(--stroke);
          background: #fff;
          color: var(--text);
          box-shadow: var(--shadow-soft);
        }
        .btnTinyAlt{ background: transparent; }

        .empty{ padding: 16px; color: var(--muted); }

        .error{
          margin-top: 10px;
          color: var(--danger);
          font-weight: 600;
        }

        /* ===== Responsive ===== */
        @media (max-width: 1200px){
          .filterGroup{ grid-template-columns: repeat(4, minmax(120px, 1fr)); }
        }
        @media (max-width: 900px){
          .toolbar{
            grid-template-columns: 1fr;
          }
          .filterGroup{
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .thead{ display:none; }
          .row{
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .row > div{
            display:flex;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 1px dashed var(--stroke);
            padding: 6px 2px;
          }
          .cellActions{ justify-content: flex-start; }
        }
      `}</style>
    </main>
  );
}
