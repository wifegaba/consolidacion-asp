// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = isProd ? '__Host-session' : 'session';

function roleToRoute(rol: string) {
  if (rol === 'admin') return '/panel';
  if (rol === 'maestro') return '/login/maestros';
  if (rol === 'contactos') return '/login/contactos1';
  return '/bienvenida';
}

export async function POST(req: NextRequest) {
  try {
    // 1) Validar envs aquí (si faltan, devolvemos JSON)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const jwtSecret = process.env.JWT_SECRET;
    if (!url || !serviceKey || !jwtSecret) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno requeridas.' },
        { status: 500 }
      );
    }

    // 2) Leer body y normalizar cédula
    const body = await req.json().catch(() => ({}));
    const cedula = String(body?.cedula || '').replace(/\D+/g, '').trim();
    if (!cedula) {
      return NextResponse.json({ error: 'Falta la cédula.' }, { status: 400 });
    }

    // 3) Llamar a tus RPCs en el servidor (service_role)
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: isAdmin, error: e1 } = await supabase.rpc('fn_es_admin', { p_cedula: cedula });
    if (e1) {
      console.error('[fn_es_admin]', e1);
      return NextResponse.json({ error: 'Error de validación.' }, { status: 500 });
    }

    let rol = 'unknown';
    if (isAdmin === true) {
      rol = 'admin';
    } else {
      const { data: r, error: e2 } = await supabase.rpc('fn_resolver_rol', { p_cedula: cedula });
      if (e2) {
        console.error('[fn_resolver_rol]', e2);
        return NextResponse.json({ error: 'Error de validación.' }, { status: 500 });
      }
      rol = r || 'unknown';
    }

    // 4) Firmar JWT y setear cookie HttpOnly
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ cedula, rol })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);

    const res = NextResponse.json({ ok: true, redirect: roleToRoute(rol) });
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2,
    });
    return res;
  } catch (err) {
    console.error('[LOGIN API]', err);
    // <- SIEMPRE devolvemos JSON
    return NextResponse.json({ error: 'Error en el login.' }, { status: 500 });
  }
}
