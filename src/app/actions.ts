"use server";

// ✅ CORRECCIÓN: Importamos el creador de cliente de Supabase directamente.
import { createClient } from '@supabase/supabase-js';

// Definimos el tipo de dato que devolverá la función
type Persona = {
  nombre: string;
  telefono: string | null;
};

/**
 * Server Action para obtener los contactos (personas) filtrados por etapa, módulo y día.
 */
export async function getContactosPorFiltro(etapa: string, modulo: number, dia: string): Promise<Persona[]> {
  
  // ✅ CORRECCIÓN DEFINITIVA:
  // Creamos un cliente de Supabase con permisos de administrador (service_role)
  // directamente dentro de la Server Action. Esto es seguro porque el código
  // solo se ejecuta en el servidor y garantiza que la función pueda leer los datos
  // sin ser bloqueada por las políticas de Row Level Security (RLS).
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabaseAdmin
    .from('progreso')
    .select('persona (nombre, telefono)') // Hacemos un join para traer los datos de la tabla 'persona'
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

  // La consulta devuelve un array de objetos { persona: Persona | null } o { persona: Persona[] | null }
  // flatMap maneja ambos casos de forma segura.
  const personas = data.flatMap((item: { persona: Persona | Persona[] | null }) => item.persona ?? []);
  
  return personas;
}