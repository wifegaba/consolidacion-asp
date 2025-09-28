// src/lib/metrics.ts
import { createClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from "next/cache";

export type Range = 'today' | 'week' | 'month' | undefined;

/** Client seguro:
 *  - En servidor usa SERVICE_ROLE (bypassa RLS solo del lado servidor)
 *  - En cliente usa ANON
 */
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isServer = typeof window === 'undefined';
  const key = isServer && service ? service : anon;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* ---------- Rangos UTC ---------- */
function getRangeUTC(range: Range) {
  if (!range) return undefined;
  const now = new Date();

  if (range === 'today') {
    const start = new Date(now); start.setUTCHours(0,0,0,0);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (range === 'week') {
    const start = new Date(now);
    const dow = start.getUTCDay();                // 0=Dom
    const diff = (dow === 0 ? -6 : 1 - dow);      // ISO: lunes
    start.setUTCDate(start.getUTCDate() + diff);
    start.setUTCHours(0,0,0,0);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  // month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

/* ---------- Contactos ---------- */
export async function getContactosCount(): Promise<number> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from('persona')
    .select('id', { count: 'exact', head: true });
  if (error) { console.error('getContactosCount:', error.message); return 0; }
  return count ?? 0;
}

/* ---------- Servidores (activos) ---------- */
export async function getServidoresCount(): Promise<number> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from('servidores')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true);
  if (error) { console.error('getServidoresCount:', error.message); return 0; }
  return count ?? 0;
}





/* ---------- Restauración (progreso activos en etapa=Restauracion) ---------- */
export async function getRestauracionCount(): Promise<number> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from('progreso')
    .select('id', { count: 'exact', head: true })
    .eq('etapa', 'Restauracion')  // enum sin tilde
    .eq('activo', true);
  if (error) { console.error('getRestauracionCount:', error.message); return 0; }
  return count ?? 0;
}


/// Trae asistencias agrupadas por ETAPA y MODULO, filtradas por rango (week | month)
// Requiere la view v_asistencia_modulo (a.creado_en, a.asistio, p.modulo, p.etapa)
export async function getAsistenciasPorModulo(range: Range = 'month'): Promise<
  Array<{ etapa: string; modulo: number; confirmados: number; noAsistieron: number; total: number }>
> {
  const supabase = getClient();
  const r = getRangeUTC(range);

  let q = supabase
    .from('v_asistencia_modulo')
    .select('etapa, modulo, asistio, creado_en');

  if (r) q = q.gte('creado_en', r.from).lt('creado_en', r.to);

  const { data, error } = await q;
  if (error) {
    console.error('getAsistenciasPorModulo:', error.message);
    return [];
  }

  // Agregamos por (etapa, modulo)
  type Key = `${string}#${number}`;
  const agg = new Map<Key, { etapa: string; modulo: number; c: number; n: number }>();

  for (const row of (data ?? []) as { etapa: string; modulo: number; asistio: boolean }[]) {
    const key = `${row.etapa}#${row.modulo}` as Key;
    const cur = agg.get(key) ?? { etapa: row.etapa, modulo: row.modulo, c: 0, n: 0 };
    if (row.asistio) cur.c++; else cur.n++;
    agg.set(key, cur);
  }

  return [...agg.values()]
    .sort((a, b) => a.modulo - b.modulo) // orden por módulo dentro de cada etapa (si luego quieres por etapa, puedes agrupar en UI)
    .map(({ etapa, modulo, c, n }) => ({
      etapa,
      modulo,
      confirmados: c,
      noAsistieron: n,
      total: c + n,
    }));
}







/* ---------- Asistencias (tabla asistencia, usa creado_en) ---------- */
export async function getAsistenciasCount(range?: Range): Promise<number> {
  const supabase = getClient();
  const r = getRangeUTC(range);

  let q = supabase.from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('asistio', true);

  if (r) q = q.gte('creado_en', r.from).lt('creado_en', r.to);

  const { count, error } = await q;
  if (error) {
    console.error('getAsistenciasCount:', { message: error.message, details: (error as any).details });
    return 0;
  }
  return count ?? 0;
}

export async function getAsistenciasSummary(range?: Range): Promise<{
  confirmed: number; notConfirmed: number; total: number; rate: number;
}> {
  const supabase = getClient();
  const r = getRangeUTC(range);

  let q1 = supabase.from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('asistio', true);
  let q2 = supabase.from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('asistio', false);

  if (r) {
    q1 = q1.gte('creado_en', r.from).lt('creado_en', r.to);
    q2 = q2.gte('creado_en', r.from).lt('creado_en', r.to);
  }

  const [{ count: c, error: e1 }, { count: n, error: e2 }] = await Promise.all([q1, q2]);

  if (e1 || e2) {
    console.error('getAsistenciasSummary:', {
      e1: e1 && { message: e1.message, details: (e1 as any).details },
      e2: e2 && { message: e2.message, details: (e2 as any).details },
    });
    return { confirmed: 0, notConfirmed: 0, total: 0, rate: 0 };
  }

  const confirmed = c ?? 0;
  const notConfirmed = n ?? 0;
  const total = confirmed + notConfirmed;
  const rate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  return { confirmed, notConfirmed, total, rate };
}

/** Confirmados y no confirmados en un rango (ej: mes actual) */
export async function getAsistenciasConfirmadosYNo(range: Range = 'month'): Promise<{
  confirmados: number;
  noAsistieron: number;
  total: number;
}> {
  const supabase = getClient();
  const r = getRangeUTC(range);

  let q = supabase.from('asistencia')
    .select('asistio', { count: 'exact' }); // recupera conteo y campo asistio

  if (r) {
    q = q.gte('creado_en', r.from).lt('creado_en', r.to);
  }

  const { data, error } = await q;
  if (error) {
    console.error('Error getAsistenciasConfirmadosYNo:', error.message);
    return { confirmados: 0, noAsistieron: 0, total: 0 };
  }

  // contamos manualmente porque Supabase no agrupa directamente
  let confirmados = 0;
  let noAsistieron = 0;
  for (const row of data ?? []) {
    if (row.asistio) confirmados++;
    else noAsistieron++;
  }
  const total = confirmados + noAsistieron;

  return { confirmados, noAsistieron, total };
}







// Tipos
export type Etapa = 'Semillas' | 'Devocionales' | 'Restauracion' | string;

type AsRow = {
  progreso_id: string | null;
  asistio: boolean;
};

type ProgRow = {
  id: string;
  etapa: Etapa;
};

// Normaliza por si el enum viene con tilde
function normalizeEtapa(e: any): Etapa {
  if (e === 'Restauración') return 'Restauracion';
  return (e ?? 'Desconocido') as Etapa;
}

/** ✔/✘ agrupado por etapa, usando join en dos pasos (sin embed) */
export async function getAsistenciasPorEtapa(range: Range = 'month'): Promise<
  Array<{ etapa: Etapa; confirmados: number; noAsistieron: number; total: number }>
> {
  const supabase = getClient();
  const r = getRangeUTC(range);

  // 1) Traer asistencias del rango (solo lo necesario)
  let q1 = supabase.from('asistencia').select('progreso_id, asistio');
  if (r) q1 = q1.gte('creado_en', r.from).lt('creado_en', r.to);

  const { data: asRows, error: e1 } = await q1;
  if (e1) {
    console.error('getAsistenciasPorEtapa/asistencia:', e1.message);
    return [];
  }
  if (!asRows || asRows.length === 0) return [];

  // 2) Buscar las etapas para esos progreso_id (evita embed)
  const ids = Array.from(new Set(asRows.map(a => a.progreso_id).filter(Boolean))) as string[];
  if (ids.length === 0) return [];

  const { data: progRows, error: e2 } = await supabase
    .from('progreso')
    .select('id, etapa')
    .in('id', ids);

  if (e2) {
    console.error('getAsistenciasPorEtapa/progreso:', e2.message);
    // devolvemos todo como Desconocido para no romper UI
    const agg = new Map<Etapa, { confirmados: number; noAsistieron: number; total: number }>();
    for (const a of asRows as AsRow[]) {
      const key: Etapa = 'Desconocido';
      if (!agg.has(key)) agg.set(key, { confirmados: 0, noAsistieron: 0, total: 0 });
      const g = agg.get(key)!;
      if (a.asistio) g.confirmados++; else g.noAsistieron++;
      g.total++;
    }
    return Array.from(agg.entries()).map(([etapa, v]) => ({ etapa, ...v }));
  }

  const etapaMap = new Map<string, Etapa>(
    (progRows as ProgRow[]).map(p => [p.id, normalizeEtapa(p.etapa)])
  );

  // 3) Agrupar
  const grupos = new Map<Etapa, { confirmados: number; noAsistieron: number; total: number }>();
  for (const a of asRows as AsRow[]) {
    const etapa = a.progreso_id ? etapaMap.get(a.progreso_id) ?? 'Desconocido' : 'Desconocido';
    if (!grupos.has(etapa)) grupos.set(etapa, { confirmados: 0, noAsistieron: 0, total: 0 });
    const g = grupos.get(etapa)!;
    if (a.asistio) g.confirmados++; else g.noAsistieron++;
    g.total++;
  }

  return Array.from(grupos.entries()).map(([etapa, v]) => ({ etapa, ...v }));
}


/* ---------- Agendados por semana (vista v_agendados) ---------- */
export async function getAgendadosPorSemana(): Promise<
  Array<{ etapa_modulo: string; agendados_pendientes: number }>
> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('v_agendados')
    .select('etapa, modulo');

  if (error) {
    console.error('getAgendadosPorSemana:', error.message);
    return [];
  }
  if (!data) return [];

  // Agrupamos manualmente porque Supabase no hace group by directo con count
  const agg = new Map<string, number>();

  for (const row of data as { etapa: string; modulo: number }[]) {
    const key = `${row.etapa} ${row.modulo}`;
    agg.set(key, (agg.get(key) ?? 0) + 1);
  }

  return Array.from(agg.entries()).map(([etapa_modulo, agendados_pendientes]) => ({
    etapa_modulo,
    agendados_pendientes,
  }));
}
