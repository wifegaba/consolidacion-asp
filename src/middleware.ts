// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// La clave secreta para verificar el JWT. Debe estar en tus variables de entorno.
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-session' : 'session';

// Define la estructura esperada del payload del JWT
interface JwtPayload {
  rol: string;
  [key: string]: any; // Permite otras propiedades en el payload
}

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // Redirigir la ruta raíz "/" a "/login"
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', origin));
  }

  // Si no tenemos una clave secreta configurada, no podemos verificar nada.
  // Es mejor bloquear el acceso por seguridad.
  if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET no está configurado en el middleware.');
    // Redirigir a una página de error o al login podría ser una opción.
    // Por ahora, simplemente bloqueamos el acceso al panel.
    return NextResponse.redirect(new URL('/login?error=config', origin));
  }

  // 1. Obtener el token de la cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;

  // 2. Si no hay token, redirigir al login
  if (!token) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Verificar y decodificar el token
  try {
    // `jwtVerify` se encarga de validar la firma del token. Si es inválida, lanzará un error.
    const { payload } = await jwtVerify<JwtPayload>(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    // --- CAMBIO AQUÍ ---
    // 4. Comprobar si el rol es 'Director', 'Administrador' O 'Maestro Ptm'
    if (
      payload.rol === 'Director' ||
      payload.rol === 'Administrador' ||
      payload.rol === 'Maestro Ptm' // <-- AÑADIDO
    ) {
      // Si el token es válido y el rol es correcto, permite que la solicitud continúe.
      return NextResponse.next();
    } else {
      // Si el rol no es ninguno de los permitidos, no tiene permiso.
      throw new Error('Acceso denegado: rol no autorizado');
    }
  } catch (err) {
    // Si el token es inválido (expirado, malformado, etc.) o el rol no es correcto,
    // lo tratamos como si no estuviera autenticado.
    console.warn('Fallo de verificación en middleware:', (err as Error).message);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('redirectTo', pathname);

    // Borramos la cookie inválida para evitar bucles de redirección
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }
}

// --- CAMBIO AQUÍ ---
// Añadimos la nueva ruta a proteger.
export const config = {
  matcher: [
    '/',  // Ruta raíz para redirección
    '/panel/:path*',
    '/panel',
    '/admin/:path*',
    '/admin',
    '/restauracion/estudiante/:path*',
    '/restauracion/estudiante'
  ],
};