// src/app/api/kids/foto/route.ts
// Proxy seguro que sirve imágenes del bucket de Supabase Storage usando service_role.
// Funciona con buckets privados y sin URLs que expiren.
// Uso: /api/kids/foto?f=administradores/1234567890-abc.jpg

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const f = req.nextUrl.searchParams.get('f');

  if (!f || f.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const supabase = getServerSupabase();

    const { data, error } = await supabase.storage
      .from('kids-fotos')
      .download(f);

    if (error || !data) {
      console.warn('[KIDS FOTO] ⚠️ No encontrada:', f, error?.message);
      return new NextResponse('Not found', { status: 404 });
    }

    const buffer      = Buffer.from(await data.arrayBuffer());
    const contentType = data.type || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (e: any) {
    console.error('[KIDS FOTO] ❌', e.message);
    return new NextResponse('Error', { status: 500 });
  }
}
