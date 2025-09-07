import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = isProd ? '__Host-session' : 'session';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me');

function roleToHome(rol: string) {
  const r = (rol || '').toLowerCase();

  if (r === 'admin') return '/panel';
  if (r === 'coordinador') return '/panel';
  if (r === 'director') return '/panel';
  if (r === 'maestro') return '/login/maestros';
  if (r === 'contactos') return '/login/contactos1';

  // si no coincide, lo mandamos fuera
  return '/login';
}


// Qué es público (entra sin sesión)
function isPublicPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  );
}

export async function middleware(req: NextRequest) {
  console.log('[MW HIT]:', req.nextUrl.pathname);

  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value || null;
  console.log('[MW HIT]:', req.nextUrl.pathname);


  // (opcional) debug para comprobar que el middleware sí corre
  // console.log('[MW HIT]', pathname);

  // Público
  if (isPublicPath(pathname)) {
    // Si ya hay sesión y entra a /login → mándalo a su home
    if (pathname === '/login' && token) {
      try {
        const { payload } = await jwtVerify(token, SECRET);
        const rol = (payload as any)?.rol ?? 'admin';
        return NextResponse.redirect(new URL(roleToHome(rol), req.url));
      } catch {
        // token inválido => dejar ver /login
      }
    }
    return NextResponse.next();
  }

  // Protegido
  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'credenciales');
    if (pathname !== '/login') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'credenciales');
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

// Matcher robusto: TODO, excepto assets estáticos y /api/login (que ya tratamos como público)
export const config = {
  matcher: [
    // todo lo que no sea assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|public|api/login).*)',
  ],
};
