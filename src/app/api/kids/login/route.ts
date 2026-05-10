// src/app/api/kids/login/route.ts
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';

const normalizeCedula = (raw: string) => raw?.trim().replace(/\./g, '') ?? '';

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET;
  const cookieName = isProd ? '__Host-kids-session' : 'kids_session';

  if (!secret) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cedula = normalizeCedula(body?.cedula ?? '');

    if (!cedula) {
      return NextResponse.json({ error: 'La cédula es requerida.' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Buscar en kids_administradores
    const { data: admin, error: errAdmin } = await supabase
      .from('kids_administradores')
      .select('id, cedula, nombre, apellido, telefono, foto_url, activo')
      .eq('cedula', cedula)
      .single();

    if (errAdmin || !admin) {
      return NextResponse.json({ error: 'Cédula no encontrada en el sistema Kids.' }, { status: 401 });
    }

    if (!admin.activo) {
      return NextResponse.json({ error: 'Cuenta inactiva. Contacte al administrador.' }, { status: 403 });
    }

    // Crear JWT del módulo kids
    const token = jwt.sign(
      {
        tipo: 'kids',
        rol:  'administrador',
        id:   admin.id,
        cedula: admin.cedula,
        nombre: admin.nombre,
        apellido: admin.apellido,
        foto_url: admin.foto_url ?? null,
      },
      secret,
      { expiresIn: '8h' }
    );

    console.log(`[KIDS LOGIN] ✅ ${admin.nombre} ${admin.apellido} — Administrador Kids`);

    const res = NextResponse.json({
      ok: true,
      redirect: '/kids/admin',
      usuario: {
        nombre:   admin.nombre,
        apellido: admin.apellido,
        foto_url: admin.foto_url,
      },
    });

    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'lax',
      maxAge:   60 * 60 * 8,
      path:     '/',
    });

    return res;
  } catch (e: any) {
    console.error('[KIDS LOGIN] ❌', e.message);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
