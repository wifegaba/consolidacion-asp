// src/app/api/kids/coordinadores/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

const SELECT_FIELDS = 'id, cedula, nombre, apellido, telefono, foto_url, grupo_asignado, direccion, edad, activo, creado_en';

// ── GET — Listar coordinadores ────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('kids_coordinadores')
      .select(SELECT_FIELDS)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS COORDINADORES GET] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST — Crear coordinador ──────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cedula, nombre, apellido, telefono, foto_url, grupo_asignado, direccion, edad } = body;

    if (!cedula || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'Cédula, nombre y apellido son obligatorios.' },
        { status: 400 },
      );
    }

    const supabase = getServerSupabase();

    const { data: existe } = await supabase
      .from('kids_coordinadores')
      .select('id')
      .eq('cedula', cedula.trim())
      .single();

    if (existe) {
      return NextResponse.json(
        { error: 'Ya existe un coordinador con esa cédula.' },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('kids_coordinadores')
      .insert({
        cedula:         cedula.trim(),
        nombre:         nombre.trim(),
        apellido:       apellido.trim(),
        telefono:       telefono?.trim()       || null,
        foto_url:       foto_url              || null,
        grupo_asignado: grupo_asignado?.trim() || null,
        direccion:      direccion?.trim()      || null,
        edad:           edad != null ? Number(edad) : null,
        activo:         true,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    console.log(`[KIDS COORDINADORES] ✅ Creado: ${nombre} ${apellido}`);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('[KIDS COORDINADORES POST] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
