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


// ============================ Server Actions ============================

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

export async function getAsistentesPorEtapaFiltro(
  etapa: string,
  modulo: number,
  dia: string,
  asistio: boolean
): Promise<Persona[]> {
  unstable_noStore();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // ✅ **SOLUCIÓN DEFINITIVA:**
  // Esta consulta ahora se origina en 'asistencia' y se asegura de que por cada registro
  // de asistencia que coincida, se devuelva un registro de persona, incluso si es un duplicado.
  // Esto alinea la lógica de obtención de detalles con la lógica de agregación en metrics.ts.
  const query = supabaseAdmin
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

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching asistentes por etapa:', error.message);
    return [];
  }

  if (!data) {
    return [];
  }
  
  // ✅ **CORRECCIÓN:** Lógica de procesamiento simplificada y robusta que extrae
  // el objeto 'persona' de cada registro de 'asistencia' devuelto.
  // Esto garantiza que si hay 6 registros de asistencia, se devuelvan 6 personas.
  const personas: Persona[] = data
      .map((item: any) => item.progreso?.persona)
      .filter(Boolean); // Filtra cualquier resultado nulo o indefinido

  return personas;
}