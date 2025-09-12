// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';

const normalizeCedula = (raw: string) => raw?.replace(/\D+/g, '').trim() ?? '';

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

    // 2) Roles por servidor_id (vigente=true)
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

    // 3) Decidir rol y asignación (prioridad contacto; ajusta si prefieres maestro)
    const rol: 'contacto' | 'maestro' = tieneContacto ? 'contacto' : 'maestro';
    const asignacion = tieneContacto ? contacto! : maestro!;
    const redirect = rol === 'contacto' ? '/login/contactos1' : '/login/maestros';

    // 4) JWT
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
        // semana solo aplica a contacto (maestro no tiene semana)
        semana: rol === 'contacto' ? contacto?.semana ?? null : null,
      },
      secret,
      { expiresIn: '8h' }
    );

    // 5) Cookies + respuesta
    const res = NextResponse.json({ redirect });

    // Cookie principal (prod y dev)
    res.cookies.set('__Host-session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8h
    });

    // Compatibilidad con tu panel en desarrollo (lee "session")
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
