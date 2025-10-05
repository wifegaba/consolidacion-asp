// src/lib/metrics.ts
import { createClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from "next/cache";

export type Range = 'today' | 'week' | 'month' | undefined;

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

// =================================================================
// FUNCIÓN DE RANGOS CORREGIDA Y FINAL
// =================================================================
function getRangeUTC(range: Range) {
  if (!range) return undefined;
  const now = new Date();

  if (range === 'today') {
    // CORREGIDO: Usa la hora local del servidor para definir "Hoy"
    const start = new Date(now);
    start.setHours(0, 0, 0, 0); 
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (range === 'week') {
    // RESTAURADO: Tu lógica original que funciona correctamente
    const start = new Date(now);
    const dow = start.getUTCDay();
    const diff = (dow === 0 ? -6 : 1 - dow);
    start.setUTCDate(start.getUTCDate() + diff);
    start.setUTCHours(0,0,0,0);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  // month
  // RESTAURADO: Tu lógica original que funciona correctamente
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

// =================================================================
// FUNCIONES DE MÉTRICAS (KPIs y otras) - SIN CAMBIOS
// =================================================================

export async function getContactosCount(): Promise<number> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from('persona')
    .select('id', { count: 'exact', head: true });
  if (error) { console.error('getContactosCount:', error.message); return 0; }
  return count ?? 0;
}

export async function getServidoresCount(): Promise<number> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from('servidores')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true);
  if (error) { console.error('getServidoresCount:', error.message); return 0; }
  return count ?? 0;
}

export async function getRestauracionCount(): Promise<number> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from('progreso')
    .select('id', { count: 'exact', head: true })
    .eq('etapa', 'Restauracion')
    .eq('activo', true);
  if (error) { console.error('getRestauracionCount:', error.message); return 0; }
  return count ?? 0;
}

export async function getAsistenciasConfirmadosYNo(
  range: Range = 'month'
): Promise<{ confirmados: number; noAsistieron: number; total: number }> {
  const supabase = getClient();
  const r = getRangeUTC(range);

  let qOk = supabase
    .from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('asistio', true);

  let qNo = supabase
    .from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('asistio', false);

  if (r) {
    qOk = qOk.gte('creado_en', r.from).lt('creado_en', r.to);
    qNo = qNo.gte('creado_en', r.from).lt('creado_en', r.to);
  }

  const [{ count: c, error: e1 }, { count: n, error: e2 }] = await Promise.all([qOk, qNo]);

  if (e1 || e2) {
    console.error('getAsistenciasConfirmadosYNo:', { e1: e1?.message, e2: e2?.message });
    return { confirmados: 0, noAsistieron: 0, total: 0 };
  }

  const confirmados = c ?? 0;
  const noAsistieron = n ?? 0;
  const total = confirmados + noAsistieron;

  return { confirmados, noAsistieron, total };
}

export async function getAgendadosPorSemana(): Promise<
  Array<{ etapa_modulo: string; agendados_pendientes: number }>
> {
  const supabase = getClient();
  const { data, error } = await supabase.from('v_agendados').select('etapa, modulo');

  if (error) {
    console.error('getAgendadosPorSemana:', error.message);
    return [];
  }
  if (!data) return [];

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


// =================================================================
// FUNCIONES PARA GRÁFICOS - OPTIMIZADAS Y CORREGIDAS
// =================================================================

export type Etapa = 'Semillas' | 'Devocionales' | 'Restauracion' | string;

/**
 * Agrupa asistencias por MÓDULO.
 * Esta versión es RÁPIDA y LÓGICAMENTE CORRECTA, ya que usa los datos históricos
 * de la tabla 'asistencia' que modificamos anteriormente.
 */
export async function getAsistenciasPorModulo(
  range: Range = 'month'
): Promise<Array<{ etapa: string; modulo: number; confirmados: number; noAsistieron: number; total: number }>> {
  noStore();
  const supabase = getClient();
  const r = getRangeUTC(range);

  let query = supabase
    .from('asistencia')
    .select('etapa, modulo, asistio, creado_en');

  if (r) {
    query = query.gte('creado_en', r.from).lt('creado_en', r.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getAsistenciasPorModulo:', error.message);
    return [];
  }
  if (!data || data.length === 0) {
    return [];
  }

  const agg = new Map<string, { etapa: string; modulo: number; confirmados: number; noAsistieron: number }>();

  for (const row of data as { etapa?: string; modulo?: number; asistio?: boolean }[]) {
    const etapa = row.etapa ?? 'Desconocido';
    const modulo = row.modulo ?? 0;
    const key = `${etapa}#${modulo}`;

    if (!agg.has(key)) {
      agg.set(key, { etapa, modulo, confirmados: 0, noAsistieron: 0 });
    }

    const current = agg.get(key)!;
    if (row.asistio) {
      current.confirmados++;
    } else {
      current.noAsistieron++;
    }
  }

  return [...agg.values()]
    .map(v => ({
      ...v,
      total: v.confirmados + v.noAsistieron,
    }))
    .sort((a, b) => {
      const et = a.etapa.localeCompare(b.etapa, 'es', { sensitivity: 'base' });
      return et !== 0 ? et : a.modulo - b.modulo;
    });
}

/**
 * Agrupa asistencias por ETAPA.
 * Esta versión también es RÁPIDA y CORRECTA. Reemplaza la versión anterior
 * que era lenta y tenía el error de datos históricos.
 */
export async function getAsistenciasPorEtapa(range: Range = 'month'): Promise<
  Array<{ etapa: Etapa; confirmados: number; noAsistieron: number; total: number }>
> {
  noStore();
  const supabase = getClient();
  const r = getRangeUTC(range);

  let query = supabase
    .from('asistencia')
    .select('etapa, asistio, creado_en');
    
  if (r) {
    query = query.gte('creado_en', r.from).lt('creado_en', r.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getAsistenciasPorEtapa:', error.message);
    return [];
  }
  if (!data || data.length === 0) {
    return [];
  }

  const grupos = new Map<Etapa, { confirmados: number; noAsistieron: number; total: number }>();
  
  for (const row of data as { etapa?: string; asistio?: boolean }[]) {
    const etapa: Etapa = row.etapa ?? 'Desconocido';
    if (!grupos.has(etapa)) {
      grupos.set(etapa, { confirmados: 0, noAsistieron: 0, total: 0 });
    }
    
    const g = grupos.get(etapa)!;
    if (row.asistio) {
      g.confirmados++;
    } else {
      g.noAsistieron++;
    }
    g.total++;
  }

  return Array.from(grupos.entries()).map(([etapa, v]) => ({ etapa, ...v }));
}