// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET    = process.env.JWT_SECRET;
const COOKIE_NAME   = process.env.NODE_ENV === 'production' ? '__Host-session'            : 'session';
const KIDS_COOKIE   = process.env.NODE_ENV === 'production' ? '__Host-kids-session'       : 'kids_session';
const COORD_COOKIE  = process.env.NODE_ENV === 'production' ? '__Host-kids-coord-session' : 'kids_coord_session';

interface JwtPayload {
  rol:   string;
  tipo?: string;
  [key: string]: any;
}

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // ── Root redirect ────────────────────────────────────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', origin));
  }

  if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET no está configurado en el middleware.');
    return NextResponse.redirect(new URL('/login?error=config', origin));
  }

  // ── Kids Coordinador routes ──────────────────────────────────────────────
  if (pathname.startsWith('/kids/coordinador')) {
    const coordToken = req.cookies.get(COORD_COOKIE)?.value;

    if (!coordToken) {
      return NextResponse.redirect(new URL('/login', origin));
    }

    try {
      const { payload } = await jwtVerify<JwtPayload>(
        coordToken,
        new TextEncoder().encode(JWT_SECRET),
      );

      if (payload.tipo === 'kids_coord' && payload.rol === 'coordinador') {
        return NextResponse.next();
      }
      throw new Error('Rol coordinador no autorizado');
    } catch {
      const response = NextResponse.redirect(new URL('/login', origin));
      response.cookies.set(COORD_COOKIE, '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ── Kids Admin routes ────────────────────────────────────────────────────
  if (pathname.startsWith('/kids/admin')) {
    const kidsToken = req.cookies.get(KIDS_COOKIE)?.value;

    if (!kidsToken) {
      return NextResponse.redirect(new URL('/login', origin));
    }

    try {
      const { payload } = await jwtVerify<JwtPayload>(
        kidsToken,
        new TextEncoder().encode(JWT_SECRET),
      );

      if (payload.tipo === 'kids' && payload.rol === 'administrador') {
        return NextResponse.next();
      }
      throw new Error('Rol kids no autorizado');
    } catch {
      const response = NextResponse.redirect(new URL('/login', origin));
      response.cookies.set(KIDS_COOKIE, '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ── Main app routes ──────────────────────────────────────────────────────
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify<JwtPayload>(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );

    if (
      payload.rol === 'Director'     ||
      payload.rol === 'Administrador' ||
      payload.rol === 'Maestro Ptm'
    ) {
      return NextResponse.next();
    }
    throw new Error('Acceso denegado: rol no autorizado');
  } catch (err) {
    console.warn('Fallo de verificación en middleware:', (err as Error).message);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('redirectTo', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }
}

export const config = {
  matcher: [
    '/',
    '/panel/:path*',
    '/panel',
    '/admin/:path*',
    '/admin',
    '/restauracion/estudiante/:path*',
    '/restauracion/estudiante',
    '/kids/admin',
    '/kids/admin/:path*',
    '/kids/coordinador',
    '/kids/coordinador/:path*',
  ],
};