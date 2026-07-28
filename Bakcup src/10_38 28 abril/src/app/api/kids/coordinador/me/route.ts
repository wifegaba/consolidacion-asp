// src/app/api/kids/coordinador/me/route.ts
// Devuelve los datos del coordinador autenticado a partir del kids_coord_session cookie.

import { NextResponse } from 'next/server';
import { jwtVerify }    from 'jose';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const isProd     = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-kids-coord-session' : 'kids_coord_session';
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

    if (payload['tipo'] !== 'kids_coord' || payload['rol'] !== 'coordinador') {
      return NextResponse.json({ error: 'Sesión no válida para coordinador.' }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      coordinador: {
        id:             payload['id'],
        cedula:         payload['cedula'],
        nombre:         payload['nombre'],
        apellido:       payload['apellido'],
        foto_url:       payload['foto_url'] ?? null,
        grupo_asignado: payload['grupo']    ?? null,
        telefono:       null,
        activo:         true,
        creado_en:      '',
        edad:           null,
        direccion:      null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }
}
