// src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// --- CAMBIO: Importar JwtPayload para mejor tipado ---
import type { JwtPayload } from 'jsonwebtoken';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME_A = '__Host-session';
const COOKIE_NAME_B = 'session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME_A)?.value ?? req.cookies.get(COOKIE_NAME_B)?.value;
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: 'Falta JWT_SECRET' }, { status: 500 });

    // --- CAMBIO: Usar JwtPayload para un tipado seguro en lugar de 'as any' ---
    const payload = jwt.verify(token, secret) as JwtPayload;

    // --- CAMBIO: Extraer 'servidorId' del payload ---
    const { cedula, rol, servidorId } = payload || {};

    // --- CAMBIO: 'servidorId' ahora es requerido para la sesión ---
    if (!cedula || !servidorId) {
      return NextResponse.json({ error: 'Token inválido o incompleto' }, { status: 401 });
    }

    // --- CAMBIO: Devolver 'servidorId' en la respuesta ---
    return NextResponse.json({
      isLoggedIn: true, // Añadido para que el hook lo entienda
      cedula,
      rol,
      servidorId,
      // Exponemos las asignaciones y el conteo para el frontend (Admin/Panel)
      asignaciones: payload.asignaciones || [],
      roleCount: payload.asignaciones && Array.isArray(payload.asignaciones) ? payload.asignaciones.length : 1
    });

  } catch (err) {
    // El 'catch' genérico está bien, si el token expira o es inválido, jwt.verify falla
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
}