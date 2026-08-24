import { NextRequest, NextResponse } from 'next/server';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { getServerSupabase } from '../../../../../lib/supabaseClient';

const SESSION_COOKIES = ['__Host-session', 'session'] as const;
const DIRECTIVOS_AUTORIZADOS = new Set([
  'liliana ibarra camilo',
  'lady hidalgo',
  'pastora diana',
  'johana hidalgo vinasco',
]);

type SessionUser = {
  servidorId: string;
  nombre: string;
  puedeVerTodo: boolean;
};

type ObservacionRespuesta = {
  id: string;
  autor: string;
  creado_en: string;
  contenido: string | null;
  confidencial: boolean;
};

function normalizarNombre(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es-CO');
}

async function obtenerUsuario(req: NextRequest): Promise<SessionUser | null> {
  const token = SESSION_COOKIES.map(cookie => req.cookies.get(cookie)?.value).find(Boolean);
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    const servidorId = typeof payload.servidorId === 'string' ? payload.servidorId : null;
    if (!servidorId) return null;

    const supabase = getServerSupabase();
    const { data: servidor } = await supabase
      .from('servidores')
      .select('nombre')
      .eq('id', servidorId)
      .maybeSingle();
    const nombre = servidor?.nombre ?? '';

    return {
      servidorId,
      nombre,
      puedeVerTodo: DIRECTIVOS_AUTORIZADOS.has(normalizarNombre(nombre)),
    };
  } catch {
    return null;
  }
}

function puedeVerContenido(usuario: SessionUser, autor: string) {
  return usuario.puedeVerTodo || normalizarNombre(autor) === normalizarNombre(usuario.nombre);
}

function leerObservacionesLegadas(notas: string | null, usuario: SessionUser): ObservacionRespuesta[] {
  if (!notas) return [];

  return notas.split('\n').filter(linea => linea.trim()).map((linea, index) => {
    const coincidencia = linea.match(/^\[(.*?)\]\s+(?:\((.*?)\)|([^:]+)):\s*(.*)$/);
    const creado_en = coincidencia?.[1] ?? 'Registro anterior';
    const autor = (coincidencia?.[2] ?? coincidencia?.[3] ?? 'Autor no identificado').trim();
    const contenido = coincidencia?.[4] ?? linea;
    const puedeVer = puedeVerContenido(usuario, autor);

    return {
      id: `legada-${index}`,
      autor,
      creado_en,
      contenido: puedeVer ? contenido : null,
      confidencial: !puedeVer,
    };
  });
}

async function cargarObservacionesLegadas(entrevistaId: string, usuario: SessionUser) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('entrevistas')
    .select('notas')
    .eq('id', entrevistaId)
    .maybeSingle();
  if (error) throw error;
  return leerObservacionesLegadas(data?.notas ?? null, usuario);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario(req);
  if (!usuario) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id: entrevistaId } = await params;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('entrevistas_observaciones')
    .select('id, autor_servidor_id, contenido, creado_en, autor:servidores!autor_servidor_id(nombre)')
    .eq('entrevista_id', entrevistaId)
    .order('creado_en', { ascending: false });

  // Permite que los historiales existentes sigan disponibles mientras se ejecuta
  // la migración. Las nuevas observaciones nunca se guardan en este formato.
  if (error?.code === 'PGRST205' || /entrevistas_observaciones.*does not exist/i.test(error?.message ?? '')) {
    try {
      const observaciones = await cargarObservacionesLegadas(entrevistaId, usuario);
      return NextResponse.json(
        { observaciones, modoLegado: true },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    } catch {
      return NextResponse.json({ error: 'No se pudo cargar el historial anterior' }, { status: 500 });
    }
  }
  if (error) return NextResponse.json({ error: 'No se pudieron consultar las observaciones' }, { status: 500 });

  const observaciones = (data ?? []).map((item: any) => {
    const puedeVer = usuario.puedeVerTodo || item.autor_servidor_id === usuario.servidorId;
    return {
      id: item.id,
      autor: item.autor?.nombre ?? 'Usuario',
      creado_en: item.creado_en,
      contenido: puedeVer ? item.contenido : null,
      confidencial: !puedeVer,
    };
  });

  return NextResponse.json(
    { observaciones },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario(req);
  if (!usuario) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const contenido = typeof body?.contenido === 'string' ? body.contenido.trim() : '';
  if (!contenido) return NextResponse.json({ error: 'La observación no puede estar vacía' }, { status: 400 });
  if (contenido.length > 4000) return NextResponse.json({ error: 'La observación supera el límite permitido' }, { status: 400 });

  const { id: entrevistaId } = await params;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('entrevistas_observaciones')
    .insert({ entrevista_id: entrevistaId, autor_servidor_id: usuario.servidorId, contenido })
    .select('id, creado_en')
    .single();

  if (error?.code === 'PGRST205' || /entrevistas_observaciones.*does not exist/i.test(error?.message ?? '')) {
    return NextResponse.json(
      { error: 'La configuración segura de observaciones aún no está instalada. Ejecute la migración de Supabase.' },
      { status: 503 },
    );
  }
  if (error) return NextResponse.json({ error: 'No se pudo guardar la observación' }, { status: 500 });
  return NextResponse.json(
    { observacion: { ...data, autor: usuario.nombre, contenido, confidencial: false } },
    { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
