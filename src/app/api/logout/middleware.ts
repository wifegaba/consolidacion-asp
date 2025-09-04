// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = isProd ? '__Host-session' : 'session';

function roleToHome(rol: string) {
  if (rol === 'admin') return '/panel';
  if (rol === 'maestro') return '/login/maestros';
  if (rol === 'contactos') return '/login/contactos1';
  return '/bienvenida';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname === '/' ||
    pathname.startsWith('/favicon');

  if (isPublic) {
    if (pathname.startsWith('/login') && token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        return NextResponse.redirect(new URL(roleToHome(payload.rol), req.url));
      } catch { /* token inválido => permitir login */ }
    }
    return NextResponse.next();
  }

  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  try {
    jwt.verify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: ['/panel/:path*', '/login/maestros', '/login/contactos1', '/bienvenida'],
};
