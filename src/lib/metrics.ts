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

// --- INICIO DE MODIFICACIÓN ---
/**
 * Actualizado para aceptar un 'valor' opcional para rangos históricos.
 * @param range - El tipo de rango ('today', 'week', 'month')
 * @param valor - El valor específico (ej. "2025-10" para mes, "2025-10-27" para semana)
 */
function getRangeUTC(range: Range, valor?: string) {
  if (!range) return undefined;
  const now = new Date();

  if (range === 'today') {
    // (Lógica sin cambios)
    const start = new Date(now);
    start.setHours(0, 0, 0, 0); 
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (range === 'week') {
    // Si se provee un 'valor' (fecha de inicio de la semana), se usa ese
    if (valor) {
      try {
        // Asume 'valor' es YYYY-MM-DD
        const start = new Date(valor); 
        start.setUTCHours(0,0,0,0);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7); // 7 días después
        return { from: start.toISOString(), to: end.toISOString() };
      } catch (e) {
        console.error("Error parsing week 'valor':", e);
        // Fallback al comportamiento original si el valor es inválido
      }
    }
    // (Lógica original para la semana actual como fallback)
    const start = new Date(now);
    const dow = start.getUTCDay();
    const diff = (dow === 0 ? -6 : 1 - dow);
    start.setUTCDate(start.getUTCDate() + diff);
    start.setUTCHours(0,0,0,0);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  // (Lógica para 'month')
  // Si se provee un 'valor' (ej. "2025-10"), se usa ese
  if (valor) {
    try {
      const [year, month] = valor.split('-').map(Number);
      // month - 1 porque los meses en JS Date UTC son 0-indexados
      const start = new Date(Date.UTC(year, month - 1, 1)); 
      const end = new Date(Date.UTC(year, month, 1)); // Siguiente mes, día 1
      return { from: start.toISOString(), to: end.toISOString() };
    } catch (e) {
      console.error("Error parsing month 'valor':", e);
      // Fallback al comportamiento original si el valor es inválido
    }
  }
  // (Lógica original para el mes actual como fallback)
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}
// --- FIN DE MODIFICACIÓN ---


function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}


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
  // --- INICIO DE MODIFICACIÓN ---
  range: Range = 'month',
  valor?: string // 1. AÑADIR PARÁMETRO 'valor'
  // --- FIN DE MODIFICACIÓN ---
): Promise<{ confirmados: number; noAsistieron: number; total: number }> {
  const supabase = getClient();
  // --- INICIO DE MODIFICACIÓN ---
  const r = getRangeUTC(range, valor); // 2. PASAR 'valor'
  // --- FIN DE MODIFICACIÓN ---
  let qOk = supabase.from('asistencia').select('id', { count: 'exact', head: true }).eq('asistio', true);
  let qNo = supabase.from('asistencia').select('id', { count: 'exact', head: true }).eq('asistio', false);
  if (r) { qOk = qOk.gte('creado_en', r.from).lt('creado_en', r.to); qNo = qNo.gte('creado_en', r.from).lt('creado_en', r.to); }
  const [{ count: c, error: e1 }, { count: n, error: e2 }] = await Promise.all([qOk, qNo]);
  if (e1 || e2) { console.error('getAsistenciasConfirmadosYNo:', { e1: e1?.message, e2: e2?.message }); return { confirmados: 0, noAsistieron: 0, total: 0 }; }
  const confirmados = c ?? 0;
  const noAsistieron = n ?? 0;
  const total = confirmados + noAsistieron;
  return { confirmados, noAsistieron, total };
}

export async function getAgendadosPorSemana(): Promise<
  Array<{ etapa_modulo: string; agendados_pendientes: number }>
> {
  // (Esta función no usa rango, no se modifica)
  const supabase = getClient();
  const { data, error } = await supabase.from('v_agendados').select('etapa, modulo, dia');
  if (error) { console.error('getAgendadosPorSemana:', error.message); return []; }
  if (!data) return [];
  const agg = new Map<string, number>();
  for (const row of data as { etapa: string; modulo: number; dia: string }[]) {
    const key = `${row.etapa} ${row.modulo} (${row.dia})`;
    agg.set(key, (agg.get(key) ?? 0) + 1);
  }
  return Array.from(agg.entries()).map(([etapa_modulo, agendados_pendientes]) => ({ etapa_modulo, agendados_pendientes, }));
}

export type Etapa = 'Semillas' | 'Devocionales' | 'Restauracion' | string;

export async function getAsistenciasPorModulo(
  // --- INICIO DE MODIFICACIÓN ---
  range: Range = 'month',
  valor?: string // 1. AÑADIR PARÁMETRO 'valor'
  // --- FIN DE MODIFICACIÓN ---
): Promise<Array<{ etapa: string; modulo: number; dia: string; confirmados: number; noAsistieron: number; total: number }>> {
  noStore();
  const supabase = getClient();
  // --- INICIO DE MODIFICACIÓN ---
  const r = getRangeUTC(range, valor); // 2. PASAR 'valor'
  // --- FIN DE MODIFICACIÓN ---
  
  // ✅ **CORRECCIÓN:** Se realiza un JOIN para obtener los datos de la tabla 'progreso'.
  let query = supabase.from('asistencia').select(`
    asistio,
    creado_en,
    progreso:progreso_id (
      etapa,
      modulo,
      dia
    )
  `);

  if (r) { query = query.gte('creado_en', r.from).lt('creado_en', r.to); }
  const { data, error } = await query;
  
  if (error) { console.error('getAsistenciasPorModulo:', error.message); return []; }
  if (!data || data.length === 0) { return []; }

  const agg = new Map<string, { etapa: string; modulo: number; dia: string; confirmados: number; noAsistieron: number }>();
  
  // ✅ **CORRECCIÓN:** Se procesa la nueva estructura de datos anidada.
  type AsistenciaConProgreso = {
      asistio?: boolean;
      progreso: {
          etapa?: string;
          modulo?: number;
          dia?: string;
      } | null;
  };

  for (const row of data as AsistenciaConProgreso[]) {
    if (!row.progreso) continue; // Si no hay progreso asociado, se ignora.

    const etapa = row.progreso.etapa ?? 'Desconocido';
    const modulo = row.progreso.modulo ?? 0;
    const dia = row.progreso.dia ?? 'Sin día';
    const key = `${etapa}#${modulo}#${dia}`;

    if (!agg.has(key)) { agg.set(key, { etapa, modulo, dia, confirmados: 0, noAsistieron: 0 }); }
    const current = agg.get(key)!;
    if (row.asistio) { current.confirmados++; } else { current.noAsistieron++; }
  }
  
  return [...agg.values()].map(v => ({ ...v, total: v.confirmados + v.noAsistieron, })).sort((a, b) => { const et = a.etapa.localeCompare(b.etapa, 'es', { sensitivity: 'base' }); if (et !== 0) return et; const diaCompare = a.dia.localeCompare(b.dia, 'es', { sensitivity: 'base' }); if (diaCompare !== 0) return diaCompare; return a.modulo - b.modulo; });
}

export async function getAsistenciasPorEtapa(
  // --- INICIO DE MODIFICACIÓN ---
  range: Range = 'month',
  valor?: string // 1. AÑADIR PARÁMETRO 'valor'
  // --- FIN DE MODIFICACIÓN ---
): Promise<
  Array<{ etapa: Etapa; confirmados: number; noAsistieron: number; total: number }>
> {
  noStore();
  const supabase = getClient();
  // --- INICIO DE MODIFICACIÓN ---
  const r = getRangeUTC(range, valor); // 2. PASAR 'valor'
  // --- FIN DE MODIFICACIÓN ---

  // ✅ **CORRECCIÓN:** Se realiza un JOIN para obtener 'etapa' de la tabla 'progreso'.
  let query = supabase.from('asistencia').select(`
    asistio,
    creado_en,
    progreso:progreso_id (
      etapa
    )
  `);

  if (r) { query = query.gte('creado_en', r.from).lt('creado_en', r.to); }
  const { data, error } = await query;
  
  if (error) { console.error('getAsistenciasPorEtapa:', error.message); return []; }
  if (!data || data.length === 0) { return []; }
  
  const grupos = new Map<Etapa, { confirmados: number; noAsistieron: number; total: number }>();

  // ✅ **CORRECCIÓN:** Se procesa la nueva estructura de datos anidada.
  type AsistenciaConEtapa = {
      asistio?: boolean;
      progreso: { etapa?: string } | null;
  };

  for (const row of data as AsistenciaConEtapa[]) {
    if (!row.progreso) continue;

    const etapa: Etapa = row.progreso.etapa ?? 'Desconocido';
    if (!grupos.has(etapa)) { grupos.set(etapa, { confirmados: 0, noAsistieron: 0, total: 0 }); }
    const g = grupos.get(etapa)!;
    if (row.asistio) { g.confirmados++; } else { g.noAsistieron++; }
    g.total++;
  }
  return Array.from(grupos.entries()).map(([etapa, v]) => ({ etapa, ...v }));
}

export async function getContactosPorEtapaDia(): Promise<
  Array<{ key: string; value: number; color: string }>
> {
  // (Esta función no usa rango, no se modifica)
  noStore();
  const supabase = getClient();
  const { data, error } = await supabase.from('progreso').select('etapa, modulo, dia').eq('activo', true);
  if (error) { console.error('getContactosPorEtapaDia:', error.message); return []; }
  if (!data) return [];
  const agg = new Map<string, number>();
  for (const row of data as { etapa: string; modulo: number; dia: string }[]) {
    const etapaNorm = normalizeString(row.etapa);
    const diaNorm = normalizeString(row.dia);
    const key = `${etapaNorm} ${row.modulo} (${diaNorm})`;
    agg.set(key, (agg.get(key) ?? 0) + 1);
  }
  const colors = [ "bg-pink-300 dark:bg-pink-400", "bg-purple-300 dark:bg-purple-400", "bg-indigo-300 dark:bg-indigo-400", "bg-sky-300 dark:bg-sky-400", "bg-orange-300 dark:bg-orange-400", "bg-lime-400 dark:bg-lime-500", "bg-emerald-300 dark:bg-emerald-400", ];
  return Array.from(agg.entries()).map(([key, value], index) => ({ key, value, color: colors[index % colors.length], })).sort((a, b) => b.value - a.value);
}

export async function getServidoresPorRolEtapaDia(): Promise<
  Array<{ key: string; value: number; color: string }>
> {
  // (Esta función no usa rango, no se modifica)
  noStore();
  const supabase = getClient();

  const { data, error } = await supabase
    .from('servidores')
    .select(`
      id,
      rol:servidores_roles!inner ( rol ),
      asig_maestro:asignaciones_maestro ( etapa, dia ),
      asig_contacto:asignaciones_contacto ( etapa, dia )
    `)
    .eq('activo', true)
    .eq('servidores_roles.vigente', true);

  if (error) {
    console.error('Error fetching servers data:', JSON.stringify(error, null, 2));
    return [];
  }
  if (!data) return [];

  const agg = new Map<string, number>();
  
  for (const row of data as any[]) {
    const rol = row.rol[0]?.rol;
    const asig_maestro = row.asig_maestro[0];
    const asig_contacto = row.asig_contacto[0];
    
    let etapa_det = null;
    let dia = null;

    if (asig_maestro) {
      etapa_det = asig_maestro.etapa;
      dia = asig_maestro.dia;
    } else if (asig_contacto) {
      etapa_det = asig_contacto.etapa;
      dia = asig_contacto.dia;
    }

    const rolNorm = normalizeString(rol);
    let key: string;

    if (etapa_det && dia) {
      let etapaNorm = normalizeString(etapa_det);
      const diaNorm = normalizeString(dia);

      // This logic is correct as it handles inconsistencies from other sources
      if (etapaNorm.startsWith('Semilla ')) {
        etapaNorm = etapaNorm.replace('Semilla ', 'Semillas ');
      }
      
      key = `${rolNorm} - ${etapaNorm} (${diaNorm})`;
    } else {
      key = rolNorm;
    }

    if (key) {
      agg.set(key, (agg.get(key) ?? 0) + 1);
    }
  }

  const colors = [ "bg-blue-300 dark:bg-blue-400", "bg-cyan-300 dark:bg-cyan-400", "bg-teal-300 dark:bg-teal-400", "bg-gray-300 dark:bg-gray-400", "bg-orange-300 dark:bg-orange-400", "bg-yellow-300 dark:bg-yellow-400", ];

  return Array.from(agg.entries())
    .map(([key, value], index) => ({
      key,
      value,
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value);
}