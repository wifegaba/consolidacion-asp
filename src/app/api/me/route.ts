// src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME_A = '__Host-session';
const COOKIE_NAME_B = 'session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME_A)?.value ?? req.cookies.get(COOKIE_NAME_B)?.value;
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: 'Falta JWT_SECRET' }, { status: 500 });

    const payload = jwt.verify(token, secret) as any;
    const { cedula, rol } = payload || {};
    if (!cedula) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    return NextResponse.json({ cedula, rol });
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
}
