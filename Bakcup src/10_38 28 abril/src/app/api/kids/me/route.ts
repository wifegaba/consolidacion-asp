// src/app/api/kids/me/route.ts
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const isProd     = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-kids-session' : 'kids_session';
  const secret     = process.env.JWT_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 });
  }

  const token = req.cookies.get(cookieName)?.value;
  if (!token) {
    return NextResponse.json({ error: 'No hay sesión activa.' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    return NextResponse.json({
      ok: true,
      usuario: {
        id:       payload['id'],
        nombre:   payload['nombre'],
        apellido: payload['apellido'],
        cedula:   payload['cedula'],
        foto_url: payload['foto_url'] ?? null,
        rol:      payload['rol'],
      },
    });
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }
}
