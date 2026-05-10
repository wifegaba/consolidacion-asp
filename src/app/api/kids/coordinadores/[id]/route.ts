// src/app/api/kids/coordinadores/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// ── PUT — Actualizar coordinador ──────────────────────────────────────────────
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const body = await req.json();
    const { cedula, nombre, apellido, telefono, foto_url, grupo_asignado, direccion, edad, activo } = body;

    const supabase = getServerSupabase();
    const updates: Record<string, any> = {};

    if (cedula         !== undefined) updates.cedula         = cedula.trim();
    if (nombre         !== undefined) updates.nombre         = nombre.trim();
    if (apellido       !== undefined) updates.apellido       = apellido.trim();
    if (telefono       !== undefined) updates.telefono       = telefono?.trim()       || null;
    if (foto_url       !== undefined) updates.foto_url       = foto_url;
    if (grupo_asignado !== undefined) updates.grupo_asignado = grupo_asignado?.trim() || null;
    if (direccion      !== undefined) updates.direccion      = direccion?.trim()      || null;
    if (edad           !== undefined) updates.edad           = edad != null ? Number(edad) : null;
    if (activo         !== undefined) updates.activo         = activo;

    const { data, error } = await supabase
      .from('kids_coordinadores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[KIDS COORDINADORES] ✅ Actualizado: ${id}`);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS COORDINADORES PUT] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE — Soft delete ──────────────────────────────────────────────────────
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('kids_coordinadores')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;

    console.log(`[KIDS COORDINADORES] 🗑️ Desactivado: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[KIDS COORDINADORES DELETE] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
