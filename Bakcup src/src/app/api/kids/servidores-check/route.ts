// src/app/api/kids/servidores-check/route.ts
// Verifica si una cédula existe en la tabla `servidores` (sistema principal).
// Usado por el modal de Kids Admin para pre-validar antes de crear un administrador.

import { NextResponse }      from 'next/server';
import { jwtVerify }         from 'jose';
import { getServerSupabase } from '@/lib/supabaseClient';
import type { NextRequest }  from 'next/server';

export async function GET(req: NextRequest) {
  const isProd     = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-kids-session' : 'kids_session';
  const secret     = process.env.JWT_SECRET;

  // ── Auth check (requiere sesión Kids válida) ──────────────────────────────
  const token = req.cookies.get(cookieName)?.value;
  if (!token || !secret) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
  } catch {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  // ── Parámetro cedula ──────────────────────────────────────────────────────
  const cedula = req.nextUrl.searchParams.get('cedula')?.trim();
  if (!cedula) {
    return NextResponse.json({ found: false });
  }

  // ── Buscar en servidores ──────────────────────────────────────────────────
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('servidores')
    .select('id, nombre, cedula, activo')
    .eq('cedula', cedula)
    .maybeSingle();

  if (error) {
    console.warn('[KIDS SERV CHECK] ⚠️', error.message);
    return NextResponse.json({ found: false });
  }

  if (!data) {
    return NextResponse.json({ found: false });
  }

  if (!data.activo) {
    return NextResponse.json({ found: false, inactivo: true, nombre: data.nombre });
  }

  return NextResponse.json({ found: true, nombre: data.nombre, id: data.id });
}
