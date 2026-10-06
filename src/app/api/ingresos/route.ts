import { NextRequest, NextResponse } from 'next/server';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';
async function user(req: NextRequest) {
  const token = req.cookies.get('__Host-session')?.value ?? req.cookies.get('session')?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    const db = getServerSupabase();
    const { data, error } = await db.from('servidores_roles').select('rol, servidores!inner(activo)')
      .eq('servidor_id', payload.servidorId).eq('vigente', true);
    if (error || !data?.some(r => ['Contactos','Maestros','Maestro Ptm','Director','Administrador'].includes(r.rol)
      && (r.servidores as unknown as { activo: boolean }).activo)) return null;
    return { id: payload.servidorId, canAssign: true };
  } catch { return null; }
}
export async function GET(req: NextRequest) {
  const session = await user(req);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const db = getServerSupabase();
    const [{ data: rows, error }, { data: groups, error: groupError }] = await Promise.all([
      db.rpc('fn_pendientes_ingreso'), db.rpc('fn_grupos_ingreso'),
    ]);
    if (error || groupError) throw error || groupError;
    return NextResponse.json({ pendientes: rows, groups, canAssign: session.canAssign });
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar el historial de ingresos' }, { status: 503 });
  }
}
export async function POST(req: NextRequest) {
  const session = await user(req);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
      return NextResponse.json({ error: 'No tiene acceso al panel de Pendientes' }, { status: 403 });
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
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar o guardar el ingreso' }, { status: 503 });
  }
}
