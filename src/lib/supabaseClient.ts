// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // opcional, solo en server

// Cliente para BROWSER (persistencia de sesión en el cliente)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true }, // está bien en browser
});

// Helper para crear un cliente en SERVER (API routes / server components)
export function getServerSupabase(): SupabaseClient {
  // Si tienes SERVICE ROLE, úsalo (solo en servidor). Si no, usa anon igualmente.
  const key = SUPABASE_SERVICE_ROLE ?? SUPABASE_ANON;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'server' } },
  });
}
