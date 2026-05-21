// src/app/api/kids/upload/route.ts
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getServerSupabase } from '@/lib/supabaseClient';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const isProd      = process.env.NODE_ENV === 'production';
  const secret      = process.env.JWT_SECRET;

  // ── Auth check — acepta admin (kids_session) O coordinador (kids_coord_session) ──
  const adminCookie = isProd ? '__Host-kids-session'       : 'kids_session';
  const coordCookie = isProd ? '__Host-kids-coord-session' : 'kids_coord_session';

  const token = req.cookies.get(adminCookie)?.value
             ?? req.cookies.get(coordCookie)?.value;

  if (!token || !secret) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
  } catch {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  // ── Parse form-data ───────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Formato de solicitud inválido.' }, { status: 400 });
  }

  const file   = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'administradores';

  if (!file) {
    return NextResponse.json({ error: 'Archivo requerido.' }, { status: 400 });
  }

  // Validate type
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Solo se permiten imágenes.' }, { status: 400 });
  }

  // Validate size (15 MB — client compresses before upload, this is a safety net)
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'La imagen no debe superar 15 MB.' }, { status: 400 });
  }

  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const supabase    = getServerSupabase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('kids-fotos')
      .upload(fileName, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    // Servimos la imagen a través de nuestro proxy (/api/kids/foto?f=<path>)
    // para que funcione con buckets privados y sin URLs que expiren.
    const proxyUrl = `/api/kids/foto?f=${encodeURIComponent(fileName)}`;

    console.log(`[KIDS UPLOAD] ✅ ${fileName}`);
    return NextResponse.json({ ok: true, url: proxyUrl });
  } catch (e: any) {
    console.error('[KIDS UPLOAD] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
