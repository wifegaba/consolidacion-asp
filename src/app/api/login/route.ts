// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';

const normalizeCedula = (raw: string) => raw?.trim() ?? '';

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('CRITICAL: JWT_SECRET no está definido en el entorno.');
    return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cedula = normalizeCedula(body?.cedula);

    if (!cedula) {
      return NextResponse.json({ error: 'Cédula o usuario es requerido.' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // PASO 1: Autenticación básica (esta es la única consulta que debe ser secuencial)
    const { data: servidor, error: errServ } = await supabase
      .from('servidores')
      .select('id, activo')
      .eq('cedula', cedula)
      .maybeSingle();

    if (errServ) throw new Error('Error al buscar servidor en la base de datos.');
    if (!servidor) return NextResponse.json({ error: 'Cédula o usuario no encontrado.' }, { status: 404 });
    if (!servidor.activo) return NextResponse.json({ error: 'Este usuario se encuentra inactivo.' }, { status: 403 });

    const servidorId = servidor.id;

    // --- OPTIMIZACIÓN: EJECUTAR TODAS LAS CONSULTAS DE ROLES EN PARALELO ---
    const [
      rolAdminResult,
      contactoResult,
      maestroResult
    ] = await Promise.all([
      // Consulta para el rol de Director
      supabase
        .from('servidores_roles')
        .select('rol')
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
        .eq('rol', 'Director')
        .maybeSingle(),
      // Consulta para la asignación de Contacto
      supabase
        .from('asignaciones_contacto')
        .select('etapa, dia, semana')
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
        .maybeSingle(),
      // Consulta para la asignación de Maestro
      supabase
        .from('asignaciones_maestro')
        .select('etapa, dia')
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
        .maybeSingle()
    ]);

    // Verificar si alguna de las consultas en paralelo falló
    if (rolAdminResult.error || contactoResult.error || maestroResult.error) {
      console.error("Error en consultas paralelas:", rolAdminResult.error || contactoResult.error || maestroResult.error);
      throw new Error('Error al verificar los roles del usuario.');
    }

    const rolAdmin = rolAdminResult.data;
    const contacto = contactoResult.data;
    const maestro = maestroResult.data;
    
    // --- LÓGICA DE DECISIÓN (Ahora con los datos ya cargados) ---

    // Prioridad 1: ¿Es Director?
    if (rolAdmin) {
      const token = jwt.sign({ cedula, rol: 'Director', servidorId }, secret, { expiresIn: '8h' });
      const res = NextResponse.json({ redirect: '/panel' });
      res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
      return res;
    }

    // Prioridad 2: ¿Es Contacto o Maestro?
    if (contacto || maestro) {
      const rolOperativo: 'contacto' | 'maestro' = contacto ? 'contacto' : 'maestro';
      const asignacion = contacto || maestro;
      const redirect = rolOperativo === 'contacto' ? '/login/contactos1' : '/login/maestros';

      const tokenPayload = {
        cedula,
        rol: rolOperativo,
        servidorId,
        etapa: asignacion!.etapa ?? null,
        dia: asignacion!.dia ?? null,
        ...(rolOperativo === 'contacto' && { semana: contacto!.semana ?? null }),
      };

      const token = jwt.sign(tokenPayload, secret, { expiresIn: '8h' });
      const res = NextResponse.json({ redirect });
      res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
      return res;
    }

    // Si no es ninguno de los anteriores
    return NextResponse.json({ error: 'No tiene roles asignados' }, { status: 401 });

  } catch (e: any) {
    console.error('Error inesperado en API de login:', e.message);
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}