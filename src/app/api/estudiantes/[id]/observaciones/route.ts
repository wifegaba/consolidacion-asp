import { NextRequest, NextResponse } from 'next/server';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { getServerSupabase } from '../../../../../lib/supabaseClient';

const SESSION_COOKIES = ['__Host-session', 'session'] as const;
const OBSERVACION_SEGURA_PREFIX = '__OBSERVACION_SEGURA_V1__:';
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

type ObservacionCifrada = {
  autorId: string;
  autor: string;
  creadoEn: string;
  contenido: string;
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

function tablaSeguraNoDisponible(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST205' || /entrevistas_observaciones.*does not exist/i.test(error?.message ?? '');
}

function claveDeCifrado() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET');
  return createHash('sha256').update(secret).digest();
}

function cifrarObservacion(payload: ObservacionCifrada) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', claveDeCifrado(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${OBSERVACION_SEGURA_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function descifrarObservacion(linea: string): ObservacionCifrada | null {
  if (!linea.startsWith(OBSERVACION_SEGURA_PREFIX)) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = linea.slice(OBSERVACION_SEGURA_PREFIX.length).split('.');
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv('aes-256-gcm', claveDeCifrado(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(decrypted) as ObservacionCifrada;
  } catch {
    return null;
  }
}

function leerObservacionesLegadas(notas: string | null, usuario: SessionUser): ObservacionRespuesta[] {
  if (!notas) return [];

  return notas.split('\n').filter(linea => linea.trim()).map((linea, index) => {
    if (linea.startsWith(OBSERVACION_SEGURA_PREFIX)) {
      const observacion = descifrarObservacion(linea);
      if (!observacion) {
        return {
          id: `segura-no-disponible-${index}`,
          autor: 'Registro confidencial',
          creado_en: 'Registro protegido',
          contenido: null,
          confidencial: true,
        };
      }
      const puedeVer = usuario.puedeVerTodo || observacion.autorId === usuario.servidorId;
      return {
        id: `segura-${index}`,
        autor: observacion.autor,
        creado_en: observacion.creadoEn,
        contenido: puedeVer ? observacion.contenido : null,
        confidencial: !puedeVer,
      };
    }

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

async function guardarObservacionCifradaEnNotas(
  entrevistaId: string,
  usuario: SessionUser,
  contenido: string,
): Promise<ObservacionRespuesta> {
  const supabase = getServerSupabase();
  const creadoEn = new Date().toISOString();
  const { data: entrevista, error: readError } = await supabase
    .from('entrevistas')
    .select('notas')
    .eq('id', entrevistaId)
    .maybeSingle();
  if (readError || !entrevista) throw readError ?? new Error('Estudiante no encontrado');

  const lineaCifrada = cifrarObservacion({
    autorId: usuario.servidorId,
    autor: usuario.nombre,
    creadoEn,
    contenido,
  });
  const notasActuales = typeof entrevista.notas === 'string' ? entrevista.notas : '';
  const nuevasNotas = notasActuales ? `${lineaCifrada}\n${notasActuales}` : lineaCifrada;
  const { error: updateError } = await supabase
    .from('entrevistas')
    .update({ notas: nuevasNotas, updated_at: creadoEn })
    .eq('id', entrevistaId);
  if (updateError) throw updateError;

  return {
    id: `segura-${Date.now()}`,
    autor: usuario.nombre,
    creado_en: creadoEn,
    contenido,
    confidencial: false,
  };
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

  if (tablaSeguraNoDisponible(error)) {
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

  const observacionesTabla = (data ?? []).map((item: any) => {
    const puedeVer = usuario.puedeVerTodo || item.autor_servidor_id === usuario.servidorId;
    return {
      id: item.id,
      autor: item.autor?.nombre ?? 'Usuario',
      creado_en: item.creado_en,
      contenido: puedeVer ? item.contenido : null,
      confidencial: !puedeVer,
    };
  });

  // Conserva visibles los registros históricos o cifrados en `notas` incluso
  // después de instalar la tabla segura.
  const observacionesLegadas = await cargarObservacionesLegadas(entrevistaId, usuario).catch(() => []);
  const observaciones = [...observacionesTabla, ...observacionesLegadas];

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

  if (tablaSeguraNoDisponible(error)) {
    try {
      const observacion = await guardarObservacionCifradaEnNotas(entrevistaId, usuario, contenido);
      return NextResponse.json(
        { observacion, almacenamientoCompatible: true },
        { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
      );
    } catch {
      return NextResponse.json({ error: 'No se pudo guardar la observación' }, { status: 500 });
    }
  }
  if (error) return NextResponse.json({ error: 'No se pudo guardar la observación' }, { status: 500 });
  return NextResponse.json(
    { observacion: { ...data, autor: usuario.nombre, contenido, confidencial: false } },
    { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
