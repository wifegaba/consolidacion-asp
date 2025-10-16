"use server";

import { createClient } from '@supabase/supabase-js';

// ============================ Tipos ============================
type Persona = {
  nombre: string;
  telefono: string | null;
};

// Se añade el nuevo tipo para los detalles del servidor
type ServidorDetalle = {
  nombre: string;
  telefono: string | null;
  cedula: string;
};


// ============================ Server Actions ============================

/**
 * Server Action para obtener los contactos (personas) filtrados por etapa, módulo y día.
 * (Esta función se mantiene sin cambios)
 */
export async function getContactosPorFiltro(etapa: string, modulo: number, dia: string): Promise<Persona[]> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabaseAdmin
    .from('progreso')
    .select('persona (nombre, telefono)')
    .eq('activo', true)
    .eq('etapa', etapa)
    .eq('modulo', modulo)
    .eq('dia', dia)
    .order('nombre', { referencedTable: 'persona', ascending: true });

  if (error) {
    console.error("Error fetching filtered contacts:", error.message);
    return [];
  }
  if (!data) {
    return [];
  }
  
  const personas = data.flatMap((item: any) => item.persona ?? []);
  return personas;
}

/**
 * NUEVA SERVER ACTION para obtener los detalles de los servidores por filtro.
 * (Versión corregida que soluciona el error de TypeScript)
 */
export async function getServidoresPorFiltro(rol: string, etapa_det: string, dia: string): Promise<ServidorDetalle[]> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  let query;

  // ✅ CORRECCIÓN: La lógica condicional ahora construye una única cadena de consulta
  // para cada caso, aplicando los filtros '.eq()' directamente después del '.select()'.
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
    // Caso por defecto para roles sin asignación de etapa/día (ej. Timoteos, Coordinadores)
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