// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// <-- CORRECCIÓN: El nombre de la variable ahora coincide con tu archivo .env.local
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente para BROWSER (persistencia de sesión en el cliente)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true },
});

// Helper para crear un cliente en SERVER (API routes / server components)
export function getServerSupabase(): SupabaseClient {
  // Ahora, la función buscará la llave correcta.
  const key = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON;
  
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'server' } },
  });
}