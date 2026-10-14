import { NextRequest, NextResponse } from 'next/server';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';
const permissionMessage = 'No encontramos una cuenta activa para tu sesión. Envía este mensaje al administrador: «Hola, no puedo abrir Pendientes. ¿Puedes revisar si mi cuenta está activa? Referencia: PENDIENTES-ACCESO. Gracias». Cuando te confirme el ajuste, cierra sesión y vuelve a ingresar.';
const systemMessage = 'Por el momento, el sistema no pudo cargar Pendientes. Intenta de nuevo en unos minutos. Si continúa, envía este mensaje al administrador: «Hola, al abrir Pendientes aparece una falla del sistema. ¿Puedes revisar el servicio? Referencia: PENDIENTES-CONSULTA. Gracias».';
async function user(req: NextRequest) {
  const token = req.cookies.get('__Host-session')?.value ?? req.cookies.get('session')?.value;
  const expired = () => NextResponse.json({ error: 'Tu sesión terminó o no es válida. Vuelve a iniciar sesión para consultar Pendientes.' }, { status: 401 });
  if (!process.env.JWT_SECRET) return NextResponse.json({ error: systemMessage }, { status: 503 });
  if (!token) return expired();
  let payload: JwtPayload;
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof verified === 'string' || typeof verified.servidorId !== 'string') return expired();
    payload = verified;
  } catch { return expired(); }
  try {
    const db = getServerSupabase();
    // Pendientes es compartido: no requiere un rol ni una asignación adicional.
    const { data, error } = await db.from('servidores').select('id, activo')
      .eq('id', payload.servidorId).maybeSingle();
    if (error) throw error;
    if (!data?.activo) {
      return NextResponse.json({ error: permissionMessage }, { status: 403 });
    }
    return { id: payload.servidorId, canAssign: true };
  } catch (error) {
    console.error('[ingresos] No se pudo comprobar el acceso:', error);
    return NextResponse.json({ error: systemMessage }, { status: 503 });
  }
}
export async function GET(req: NextRequest) {
  const session = await user(req);
  if (session instanceof NextResponse) return session;
  try {
    const db = getServerSupabase();
    const [{ data: rows, error }, { data: groups, error: groupError }] = await Promise.all([
      db.rpc('fn_pendientes_ingreso'), db.rpc('fn_grupos_ingreso'),
    ]);
    if (error || groupError) throw error || groupError;
    return NextResponse.json({ pendientes: rows, groups, canAssign: session.canAssign });
  } catch (error) {
    console.error('[ingresos] Error al consultar pendientes:', error);
    return NextResponse.json({ error: systemMessage }, { status: 503 });
  }
}
export async function POST(req: NextRequest) {
  const session = await user(req);
  if (session instanceof NextResponse) return session;
  try {
    const body = await req.json();
    const db = getServerSupabase();
    if (body.action === 'detect' || body.action === 'queue') {
      if (typeof body.nombre !== 'string' || typeof body.telefono !== 'string') {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      const { data, error } = await db.rpc('fn_historial_ingreso', {
        p_nombre: body.nombre, p_telefono: body.telefono,
        p_cedula: body.cedula || null, p_email: body.email || null,
      });
      if (error) throw error;
      if (body.action === 'queue') {
        if (!body.nombre.trim() || (body.telefono.replace(/\D/g, '').length < 7 && !body.cedula?.trim() && !body.email?.trim())) {
          return NextResponse.json({ error: 'Nombre y un teléfono, documento o correo válido requeridos' }, { status: 400 });
        }
        const { data: id, error: queueError } = await db.rpc('fn_encolar_ingreso', {
          p_nombre: body.nombre, p_telefono: body.telefono, p_culto: body.culto || null,
          p_observaciones: body.observaciones || null, p_creado_por: session.id,
          p_cedula: body.cedula || null, p_email: body.email || null,
        });
        if (queueError) throw queueError;
        return NextResponse.json({ history: data, id });
      }
      return NextResponse.json({ history: data });
    }
    if (body.action !== 'assign' || !session.canAssign) {
      return NextResponse.json({ error: permissionMessage }, { status: 403 });
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(body.pendienteId || '') || typeof body.groupKey !== 'string'
      || (body.identityId && (!uuid.test(body.identityId) || !['persona','entrevista'].includes(body.identitySource)))) {
      return NextResponse.json({ error: 'Datos de asignación inválidos' }, { status: 400 });
    }
    const { error } = await db.rpc('fn_asignar_ingreso', {
      p_pendiente: body.pendienteId, p_usuario: session.id,
      p_identidad_fuente: body.identitySource || null, p_identidad: body.identityId || null,
      p_grupo_key: body.groupKey, p_confirmada: body.confirmed === true,
      p_descartar_historial: body.distinctPerson === true,
    });
    if (error) {
      if (error.code === 'P0001') {
        return NextResponse.json({ error: error.message === 'El usuario no tiene acceso al panel de Pendientes'
          ? permissionMessage : error.message }, { status: error.message === 'El usuario no tiene acceso al panel de Pendientes' ? 403 : 409 });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ingresos] Error al procesar ingreso:', error);
    return NextResponse.json({ error: 'El sistema no pudo completar la operación. Antes de repetirla, actualiza Pendientes para comprobar si el ingreso ya se guardó. Si continúa, envía este mensaje al administrador: «Hola, tuve un problema al revisar o guardar un ingreso en Pendientes. ¿Puedes comprobar si se guardó y revisar el servicio? Referencia: PENDIENTES-GUARDADO. Gracias».' }, { status: 503 });
  }
}
