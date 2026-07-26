// src/app/api/kids/portal-login/route.ts
// Crea una kids_session a partir de una sesión principal válida (session cookie).
// El usuario ya está autenticado en el sistema general; este endpoint simplemente
// genera el token del módulo Kids si tiene acceso como administrador Kids.

import { NextResponse }      from 'next/server';
import { jwtVerify }         from 'jose';
import jwt                   from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';
import type { NextRequest }  from 'next/server';

export async function POST(req: NextRequest) {
  const isProd        = process.env.NODE_ENV === 'production';
  const mainCookie    = isProd ? '__Host-session'      : 'session';
  const kidsCookie    = isProd ? '__Host-kids-session' : 'kids_session';
  const secret        = process.env.JWT_SECRET;

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

  // ── 2. Buscar en kids_servidores, kids_administradores o servidores_roles ──
  const supabase = getServerSupabase();
  const cleanCedula = cedula.replace(/\D/g, '');

  let admin: any = null;

  // A) Intentar buscar en kids_servidores
  const { data: servidorKids } = await supabase
    .from('kids_servidores')
    .select('id, cedula, nombre, apellido, foto_url, activo, roles')
    .or(`cedula.eq.${cedula}${cleanCedula ? `,cedula.eq.${cleanCedula}` : ''}`)
    .maybeSingle();

  if (servidorKids && servidorKids.roles?.includes('ADMINISTRADOR')) {
    admin = servidorKids;
  }

  // B) Si no está en kids_servidores o no tiene rol ADMINISTRADOR ahí, buscar en kids_administradores
  if (!admin) {
    const { data: ka } = await supabase
      .from('kids_administradores')
      .select('id, cedula, nombre, apellido, foto_url, activo')
      .or(`cedula.eq.${cedula}${cleanCedula ? `,cedula.eq.${cleanCedula}` : ''}`)
      .maybeSingle();

    if (ka) {
      admin = { ...ka, roles: ['ADMINISTRADOR'] };
    }
  }

  // C) Si aún no se encuentra, verificar si es Director o Administrador general del sistema
  if (!admin) {
    const { data: s } = await supabase
      .from('servidores')
      .select('id, cedula, nombre, apellido, activo')
      .or(`cedula.eq.${cedula}${cleanCedula ? `,cedula.eq.${cleanCedula}` : ''}`)
      .maybeSingle();

    if (s && s.activo) {
      const { data: sr } = await supabase
        .from('servidores_roles')
        .select('rol')
        .eq('servidor_id', s.id)
        .eq('vigente', true)
        .in('rol', ['Director', 'Administrador']);

      if (sr && sr.length > 0) {
        admin = {
          id: s.id,
          cedula: s.cedula,
          nombre: s.nombre,
          apellido: s.apellido ?? '',
          foto_url: null,
          activo: true,
          roles: ['ADMINISTRADOR']
        };
      }
    }
  }

  if (!admin) {
    return NextResponse.json({ error: 'No tienes acceso al módulo Kids.' }, { status: 403 });
  }

  if (!admin.activo) {
    return NextResponse.json({ error: 'Tu cuenta Kids está inactiva.' }, { status: 403 });
  }

  // ── 3. Crear kids_session JWT ─────────────────────────────────────────────
  const token = jwt.sign(
    {
      tipo:     'kids',
      rol:      'administrador',
      id:       admin.id,
      cedula:   admin.cedula,
      nombre:   admin.nombre,
      apellido: admin.apellido,
      foto_url: admin.foto_url ?? null,
    },
    secret,
    { expiresIn: '8h' }
  );

  console.log(`[KIDS PORTAL-LOGIN] ✅ ${admin.nombre} ${admin.apellido}`);

  const res = NextResponse.json({ ok: true, redirect: '/kids/admin' });
  res.cookies.set(kidsCookie, token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  });

  return res;
}
