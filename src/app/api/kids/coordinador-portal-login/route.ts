// src/app/api/kids/coordinador-portal-login/route.ts
// Crea una kids_coord_session a partir de una sesión principal válida.
// El usuario ya está autenticado en el sistema general y tiene rol 'kids_coordinador'.

import { NextResponse }      from 'next/server';
import { jwtVerify }         from 'jose';
import jwt                   from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';
import type { NextRequest }  from 'next/server';

export async function POST(req: NextRequest) {
  const isProd      = process.env.NODE_ENV === 'production';
  const mainCookie  = isProd ? '__Host-session'            : 'session';
  const coordCookie = isProd ? '__Host-kids-coord-session' : 'kids_coord_session';
  const secret      = process.env.JWT_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 });
  }

  // ── 1. Verificar sesión principal ─────────────────────────────────────────
  const mainToken = req.cookies.get(mainCookie)?.value;
  if (!mainToken) {
    return NextResponse.json({ error: 'Sesión principal no encontrada.' }, { status: 401 });
  }

  let cedula: string;
  try {
    const { payload } = await jwtVerify(mainToken, new TextEncoder().encode(secret));
    cedula = payload['cedula'] as string;
    if (!cedula) throw new Error('cedula no encontrada en el token');
  } catch {
    return NextResponse.json({ error: 'Sesión principal inválida.' }, { status: 401 });
  }

  // ── 2. Buscar en kids_coordinadores ───────────────────────────────────────
  const supabase = getServerSupabase();
  const { data: coord, error } = await supabase
    .from('kids_coordinadores')
    .select('id, cedula, nombre, apellido, telefono, foto_url, grupo_asignado, activo')
    .eq('cedula', cedula)
    .maybeSingle();

  if (error || !coord) {
    return NextResponse.json({ error: 'No tienes acceso como coordinador Kids.' }, { status: 403 });
  }
  if (!coord.activo) {
    return NextResponse.json({ error: 'Tu cuenta de coordinador está inactiva.' }, { status: 403 });
  }

  // ── 3. Crear kids_coord_session JWT ───────────────────────────────────────
  const token = jwt.sign(
    {
      tipo:     'kids_coord',
      rol:      'coordinador',
      id:       coord.id,
      cedula:   coord.cedula,
      nombre:   coord.nombre,
      apellido: coord.apellido,
      foto_url: coord.foto_url ?? null,
      grupo:    coord.grupo_asignado,
    },
    secret,
    { expiresIn: '8h' },
  );

  console.log(`[KIDS COORD PORTAL-LOGIN] ✅ ${coord.nombre} ${coord.apellido} — ${coord.grupo_asignado}`);

  const res = NextResponse.json({ ok: true, redirect: '/kids/ninos' });
  res.cookies.set(coordCookie, token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  });

  return res;
}
