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

    // PASO 1: Autenticación básica (ahora incluye nombre para optimización)
    const { data: servidor, error: errServ } = await supabase
      .from('servidores')
      .select('id, activo, nombre')
      .eq('cedula', cedula)
      .maybeSingle();

    if (errServ) throw new Error('Error al buscar servidor en la base de datos.');
    if (!servidor) return NextResponse.json({ error: 'Cédula o usuario no encontrado.' }, { status: 404 });
    if (!servidor.activo) return NextResponse.json({ error: 'Este usuario se encuentra inactivo.' }, { status: 403 });

    const servidorId = servidor.id;

    // --- OPTIMIZACIÓN: EJECUTAR TODAS LAS CONSULTAS DE ROLES EN PARALELO ---
    // Usamos select() en lugar de maybeSingle() para obtener TODOS los registros,
    // ya que ahora permitimos múltiples asignaciones por rol.
    const [
      rolDirectorResult,
      rolAdministradorResult,
      rolMaestroPtmResult,
      contactosResult,
      maestrosResult,
      logisticaResult
    ] = await Promise.all([
      // Consulta para el rol de Director
      supabase
        .from('servidores_roles')
        .select('rol')
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
        .eq('rol', 'Director')
        .maybeSingle(),

      // Consulta para el rol 'Administrador'
      supabase
        .from('servidores_roles')
        .select('rol')
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
        .eq('rol', 'Administrador')
        .maybeSingle(),

      // Consulta para el rol 'Maestro Ptm'
      supabase
        .from('servidores_roles')
        .select('rol')
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
        .eq('rol', 'Maestro Ptm')
        .maybeSingle(),

      // Consulta para las asignaciones de Contacto (Array)
      supabase
        .from('asignaciones_contacto')
        .select('etapa, dia, semana')
        .eq('servidor_id', servidorId)
        .eq('vigente', true),

      // Consulta para las asignaciones de Maestro (Array)
      supabase
        .from('asignaciones_maestro')
        .select('etapa, dia')
        .eq('servidor_id', servidorId)
        .eq('vigente', true),

      // Consulta para las asignaciones de Logística (Array)
      supabase
        .from('asignaciones_logistica')
        .select('dia:dia_culto, franja') // Alias dia_culto -> dia for compatibility
        .eq('servidor_id', servidorId)
        .eq('vigente', true)
    ]);

    // Verificar si alguna de las consultas CRÍTICAS falló
    if (rolDirectorResult.error || rolAdministradorResult.error || rolMaestroPtmResult.error || contactosResult.error || maestrosResult.error) {
      console.error("Error en consultas paralelas:", rolDirectorResult.error || rolAdministradorResult.error || rolMaestroPtmResult.error || contactosResult.error || maestrosResult.error);
      throw new Error('Error al verificar los roles del usuario.');
    }

    const rolDirector = rolDirectorResult.data;
    const rolAdministrador = rolAdministradorResult.data;
    const rolMaestroPtm = rolMaestroPtmResult.data;

    // Arrays de asignaciones (declarados UNA SOLA VEZ al inicio)
    const contactos = contactosResult.data || [];
    const maestros = maestrosResult.data || [];
    const logistica = logisticaResult.data || [];

    // --- LÓGICA DE DECISIÓN ---

    // Contar roles administrativos
    const rolesAdmin = [rolDirector, rolAdministrador].filter(Boolean).length;

    // Prioridad 1: ¿Es Estudiante? (tiene precedencia sobre todo)
    if (rolMaestroPtm) {
      const token = jwt.sign({ cedula, rol: 'Maestro Ptm', servidorId }, secret, { expiresIn: '8h' });
      const res = NextResponse.json({ redirect: '/restauracion/estudiante' });
      res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
      return res;
    }

    // Prioridad 2: Roles Administrativos (Director / Administrador)
    if (rolesAdmin > 0) {
      const totalAsignaciones = contactos.length + maestros.length + logistica.length;

      // Si tiene múltiples roles administrativos O roles admin + roles operativos, va al portal
      if (rolesAdmin > 1 || (rolesAdmin > 0 && totalAsignaciones > 0)) {
        // OPTIMIZACIÓN: Incluir asignaciones en el token para evitar queries en el portal
        const asignaciones = [
          ...contactos.map((c: any) => ({ tipo: 'contacto', etapa: c.etapa, dia: c.dia, semana: c.semana })),
          ...maestros.map((m: any) => ({ tipo: 'maestro', etapa: m.etapa, dia: m.dia })),
          ...logistica.map((l: any) => ({ tipo: 'logistica', dia: l.dia, franja: l.franja })),
          ...(rolDirector ? [{ tipo: 'director', etapa: 'Director' }] : []),
          ...(rolAdministrador ? [{ tipo: 'administrador', etapa: 'Administrador' }] : [])
        ];
        const token = jwt.sign({ cedula, roles: ['portal'], servidorId, nombre: servidor.nombre, asignaciones }, secret, { expiresIn: '8h' });
        const res = NextResponse.json({ redirect: '/login/portal' });
        res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
        return res;
      }

      // Si solo tiene UN rol administrativo (y ningún operativo), redirige directo
      if (rolDirector) {
        const token = jwt.sign({ cedula, rol: 'Director', servidorId }, secret, { expiresIn: '8h' });
        const res = NextResponse.json({ redirect: '/panel' });
        res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
        return res;
      }

      if (rolAdministrador) {
        const token = jwt.sign({ cedula, rol: 'Administrador', servidorId }, secret, { expiresIn: '8h' });
        const res = NextResponse.json({ redirect: '/admin' });
        res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
        return res;
      }
    }

    // Prioridad 3: Roles Operativos (Timoteo, Coordinador, Logística)
    // Contamos el TOTAL de asignaciones individuales
    const totalAsignaciones = contactos.length + maestros.length + logistica.length;

    if (totalAsignaciones > 0) {
      // Si tiene MÁS de una asignación (total > 1), enviamos al PORTAL
      if (totalAsignaciones > 1) {
        // OPTIMIZACIÓN: Incluir asignaciones en el token para evitar queries en el portal
        const asignaciones = [
          ...contactos.map((c: any) => ({ tipo: 'contacto', etapa: c.etapa, dia: c.dia, semana: c.semana })),
          ...maestros.map((m: any) => ({ tipo: 'maestro', etapa: m.etapa, dia: m.dia })),
          ...logistica.map((l: any) => ({ tipo: 'logistica', dia: l.dia, franja: l.franja }))
        ];
        const token = jwt.sign({ cedula, roles: ['portal'], servidorId, nombre: servidor.nombre, asignaciones }, secret, { expiresIn: '8h' });
        const res = NextResponse.json({ redirect: '/login/portal' });
        res.cookies.set(isProd ? '__Host-session' : 'session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
        return res;
      }

      // Si tiene SOLO UNA asignación exacta, redirigimos directo
      let redirect = '';
      let rolName = '';
      let extraData = {};

      if (contactos.length === 1) {
        rolName = 'contacto';
        redirect = '/login/contactos1';
        extraData = { etapa: contactos[0].etapa, dia: contactos[0].dia };
      } else if (maestros.length === 1) {
        rolName = 'maestro';
        redirect = '/login/maestros';
        extraData = { etapa: maestros[0].etapa, dia: maestros[0].dia };
      } else if (logistica.length === 1) {
        rolName = 'logistica';
        redirect = '/login/logistica';
        extraData = { dia: logistica[0].dia };
      }

      const tokenPayload = {
        cedula,
        rol: rolName,
        servidorId,
        ...extraData
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