// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';

// CAMBIO 1: La función se modifica para aceptar cualquier caracter.
// Solo quita espacios en blanco al inicio y al final.
const normalizeCedula = (raw: string) => raw?.trim() ?? '';

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === 'production';

  try {
    const body = await req.json().catch(() => ({}));
    const cedula = normalizeCedula(body?.cedula);

    if (!cedula) {
      return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // 1) Servidor por cédula
    // Esta consulta ahora buscará un valor que puede contener letras.
    const { data: servidor, error: errServ } = await supabase
      .from('servidores')
      .select('id, activo')
      .eq('cedula', cedula)
      .maybeSingle();

    if (errServ) {
      return NextResponse.json({ error: 'Error consultando servidor' }, { status: 500 });
    }
    if (!servidor) {
      return NextResponse.json({ error: 'Servidor no encontrado' }, { status: 404 });
    }
    if (servidor.activo === false) {
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });
    }

    const servidorId = servidor.id;

    // ... el resto del código no necesita cambios ...

    const { data: contacto, error: errC } = await supabase
      .from('asignaciones_contacto')
      .select('etapa, dia, semana, vigente')
      .eq('servidor_id', servidorId)
      .eq('vigente', true)
      .maybeSingle();

    const { data: maestro, error: errM } = await supabase
      .from('asignaciones_maestro')
      .select('etapa, dia, vigente')
      .eq('servidor_id', servidorId)
      .eq('vigente', true)
      .maybeSingle();

    if (errC || errM) {
      return NextResponse.json({ error: 'Error consultando roles' }, { status: 500 });
    }

    const tieneContacto = !!contacto;
    const tieneMaestro = !!maestro;

    if (!tieneContacto && !tieneMaestro) {
      return NextResponse.json({ error: 'No tiene roles asignados' }, { status: 401 });
    }

    const rol: 'contacto' | 'maestro' = tieneContacto ? 'contacto' : 'maestro';
    const asignacion = tieneContacto ? contacto! : maestro!;
    const redirect = rol === 'contacto' ? '/login/contactos1' : '/login/maestros';

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Falta JWT_SECRET en .env' }, { status: 500 });
    }

    const token = jwt.sign(
      {
        cedula,
        rol,
        servidorId,
        etapa: asignacion?.etapa ?? null,
        dia: asignacion?.dia ?? null,
        semana: rol === 'contacto' ? contacto?.semana ?? null : null,
      },
      secret,
      { expiresIn: '8h' }
    );
    
    const res = NextResponse.json({ redirect });

    res.cookies.set('__Host-session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8h
    });

    if (!isProd) {
      res.cookies.set('session', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      });
    }

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error interno' },
      { status: 500 }
    );
  }
}