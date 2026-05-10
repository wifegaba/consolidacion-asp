// src/app/api/kids/ninos/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

const BASE_FIELDS = [
  'id', 'nombre', 'apellido', 'edad',
  'nombre_acudiente', 'telefono_acudiente',
  'foto_url',                            // ← siempre existe en la tabla
  'activo', 'creado_en',
];
const EXTRA_FIELDS  = ['grupo', 'acudiente', 'telefono', 'observaciones', 'ti', 'face_descriptor'];
const ALL_FIELDS    = [...BASE_FIELDS, ...EXTRA_FIELDS].join(', ');
const OPTIONAL_COLS = new Set(EXTRA_FIELDS);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body   = await req.json();

    // Mapear campos del formulario → columnas NOT NULL reales
    if (body.acudiente !== undefined) body.nombre_acudiente   = body.acudiente?.trim() || '';
    if (body.telefono  !== undefined) body.telefono_acudiente = body.telefono?.trim()  || '';
    if (body.apellido  !== undefined) body.apellido           = body.apellido?.trim()  || '';

    // foto_url llega como proxy URL ya lista (subida desde el cliente antes del PATCH)
    // No hay base64 que procesar aquí

    const supabase = getServerSupabase();
    let { data, error } = await supabase.from('kids_ninos').update(body).eq('id', id).select(ALL_FIELDS).single();

    if (error && error.message.includes('column')) {
      const safe: Record<string, any> = {};
      for (const [k, v] of Object.entries(body)) {
        if (!OPTIONAL_COLS.has(k)) safe[k] = v;
      }
      const retry = await supabase.from('kids_ninos').update(safe).eq('id', id).select(BASE_FIELDS.join(', ')).single();
      if (retry.error) throw retry.error;
      data = retry.data;
    } else if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[NINOS PATCH] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = getServerSupabase();
    const { error } = await supabase.from('kids_ninos').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[NINOS DELETE] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
