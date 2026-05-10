// src/app/api/kids/administradores/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// ── GET — Listar todos los administradores kids ──────────────────────────────
export async function GET() {
  try {
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('kids_administradores')
      .select('id, cedula, nombre, apellido, telefono, foto_url, activo, creado_en')
      .order('creado_en', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS ADMINS GET] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST — Crear nuevo administrador kids ────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cedula, nombre, apellido, telefono, foto_url } = body;

    if (!cedula || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'Cédula, nombre y apellido son obligatorios.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Verificar si la cédula ya existe
    const { data: existe } = await supabase
      .from('kids_administradores')
      .select('id')
      .eq('cedula', cedula.trim())
      .single();

    if (existe) {
      return NextResponse.json(
        { error: 'Ya existe un administrador con esa cédula.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('kids_administradores')
      .insert({
        cedula:   cedula.trim(),
        nombre:   nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() ?? null,
        foto_url: foto_url ?? null,
        activo:   true,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[KIDS ADMINS] ✅ Creado: ${nombre} ${apellido}`);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('[KIDS ADMINS POST] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
