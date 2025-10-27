// src/app/actions.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import { unstable_noStore } from 'next/cache';

// ============================ Tipos ============================
type Persona = {
  nombre: string;
  telefono: string | null;
};

type ServidorDetalle = {
  nombre: string;
  telefono: string | null;
  cedula: string;
};

// --- INICIO DE CÓDIGO AÑADIDO ---
// Lógica de Rango (necesaria para filtrar las asistencias en el modal)
export type Range = 'today' | 'week' | 'month' | undefined;

function getRangeUTC(range: Range) {
  if (!range) return undefined;
  const now = new Date();

  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0); 
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (range === 'week') {
    // Lógica idéntica a metrics.ts para consistencia
    const start = new Date(now);
    const dow = start.getUTCDay();
    const diff = (dow === 0 ? -6 : 1 - dow);
    start.setUTCDate(start.getUTCDate() + diff);
    start.setUTCHours(0,0,0,0);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  
  // 'month'
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}
// --- FIN DE CÓDIGO AÑADIDO ---


// ============================ Server Actions ============================

// (Esta función no se modifica)
export async function getContactosPorFiltro(etapa: string, modulo: number, dia: string): Promise<Persona[]> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  // Alineamos la fuente de datos con la que usa getAgendadosPorSemana (v_agendados)
  // para que el modal muestre exactamente los registros contados.
  // Primero intentamos la vista `v_agendados` (la que usa el contador).
  // Si no devuelve filas, hacemos fallback a la consulta original sobre `progreso`
  // para mantener compatibilidad con otros usos del modal.
  try {
    const { data: vdata, error: verror } = await supabaseAdmin
      .from('v_agendados')
      .select('progreso_id, nombre, telefono, semana')
      .eq('etapa', etapa)
      .eq('modulo', modulo)
      .eq('dia', dia)
      .order('nombre', { ascending: true });

    if (!verror && Array.isArray(vdata) && vdata.length > 0) {
      return vdata.map((p: any) => ({ nombre: p.nombre ?? '', telefono: p.telefono ?? null }));
    }
  } catch (e) {
    // fallthrough a la consulta original
    console.error('Warning: v_agendados query failed, falling back to progreso:', (e as any)?.message || e);
  }

  // Fallback: consulta por progreso -> persona { nombre, telefono }
  try {
    const { data, error } = await supabaseAdmin
      .from('progreso')
      .select('persona (nombre, telefono)')
      .eq('activo', true)
      .eq('etapa', etapa)
      .eq('modulo', modulo)
      .eq('dia', dia)
      .order('nombre', { referencedTable: 'persona', ascending: true });

    if (error) {
      console.error("Error fetching filtered contacts from progreso:", error.message);
      return [];
    }
    if (!data) return [];

    const personasRaw: any[] = data.flatMap((item: any) => {
      const p = item.persona;
      if (!p) return [];
      if (Array.isArray(p)) return p;
      return [p];
    });

    return personasRaw.filter(Boolean).map((p: any) => ({ nombre: p?.nombre ?? '', telefono: p?.telefono ?? null }));
  } catch (e) {
    console.error('Error in fallback progreso query:', (e as any)?.message || e);
    return [];
  }
}

/**
 * NUEVA FUNCIÓN AÑADIDA
 * Obtiene contactos activos consultando *directamente* la tabla 'progreso'.
 * Esto asegura que el modal de "Contactos" coincida con el contador de 'getContactosPorEtapaDia'.
 */
// (Esta función no se modifica)
export async function getActivosPorFiltro(etapa: string, modulo: number, dia: string): Promise<Persona[]> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Consulta directa a 'progreso' (lógica del fallback original de getContactosPorFiltro)
  try {
    const { data, error } = await supabaseAdmin
      .from('progreso')
      .select('persona (nombre, telefono)')
      .eq('activo', true)
      .eq('etapa', etapa)
      .eq('modulo', modulo)
      .eq('dia', dia)
      .order('nombre', { referencedTable: 'persona', ascending: true });

    if (error) {
      console.error("Error fetching filtered contacts from progreso:", error.message);
      return [];
    }
    if (!data) return [];

    const personasRaw: any[] = data.flatMap((item: any) => {
      const p = item.persona;
      if (!p) return [];
      if (Array.isArray(p)) return p;
      return [p];
    });

    return personasRaw.filter(Boolean).map((p: any) => ({ nombre: p?.nombre ?? '', telefono: p?.telefono ?? null }));
  } catch (e) {
    console.error('Error in getActivosPorFiltro query:', (e as any)?.message || e);
    return [];
  }
}

// (Esta función no se modifica)
export async function getServidoresPorFiltro(rol: string, etapa_det: string, dia: string): Promise<ServidorDetalle[]> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  let query;

  if (rol === 'Maestros') {
    query = supabaseAdmin
      .from('servidores')
      .select(`
        nombre, telefono, cedula,
        rol:servidores_roles!inner(rol),
        asig:asignaciones_maestro!inner(etapa, dia)
      `)
      .eq('activo', true)
      .eq('rol.rol', rol)
      .eq('asig.etapa', etapa_det)
      .eq('asig.dia', dia);
  } else if (rol === 'Contactos') {
     query = supabaseAdmin
      .from('servidores')
      .select(`
        nombre, telefono, cedula,
        rol:servidores_roles!inner(rol),
        asig:asignaciones_contacto!inner(etapa, dia)
      `)
      .eq('activo', true)
      .eq('rol.rol', rol)
      .eq('asig.etapa', etapa_det)
      .eq('asig.dia', dia);
  } else {
    query = supabaseAdmin
      .from('servidores')
      .select('nombre, telefono, cedula, rol:servidores_roles!inner(rol)')
      .eq('activo', true)
      .eq('rol.rol', rol);
  }
  
  const { data, error } = await query.order('nombre', { ascending: true });

  if (error) {
    console.error(`Error fetching filtered servers for role ${rol}:`, JSON.stringify(error, null, 2));
    return [];
  }
  
  return data || [];
}

// --- INICIO DE MODIFICACIÓN ---
export async function getAsistentesPorEtapaFiltro(
  etapa: string,
  modulo: number,
  dia: string,
  asistio: boolean,
  range: Range // 1. AÑADIR PARÁMETRO 'range'
): Promise<Persona[]> {
// --- FIN DE MODIFICACIÓN ---
  unstable_noStore();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // --- INICIO DE MODIFICACIÓN ---
  // 2. OBTENER RANGO UTC
  const r = getRangeUTC(range);

  // 3. CAMBIAR 'const query' POR 'let query'
  let query = supabaseAdmin
  // --- FIN DE MODIFICACIÓN ---
    .from('asistencia')
    .select(`
      progreso:progreso_id!inner (
        etapa,
        modulo,
        dia,
        persona:persona_id!inner (
          nombre,
          telefono
        )
      )
    `)
    .eq('asistio', asistio)
    .eq('progreso_id.etapa', etapa)
    .eq('progreso_id.modulo', modulo)
    .eq('progreso_id.dia', dia);

  // --- INICIO DE MODIFICACIÓN ---
  // 4. APLICAR FILTRO DE RANGO SI EXISTE
  if (r) {
    query = query.gte('creado_en', r.from).lt('creado_en', r.to);
  }
  // --- FIN DE MODIFICACIÓN ---

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching asistentes por etapa:', error.message);
    return [];
  }

  if (!data) {
    return [];
  }
  
  // (La lógica de procesamiento de datos no se modifica)
  const personas: Persona[] = data
      .map((item: any) => item.progreso?.persona)
      .filter(Boolean); // Filtra cualquier resultado nulo o indefinido

  return personas;
}