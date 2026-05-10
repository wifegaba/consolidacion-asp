// src/app/api/kids/maestros/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// ── PUT — Actualizar maestro ──────────────────────────────────────────────────
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const body = await req.json();
    const {
      cedula, nombre, apellido, telefono, foto_url,
      grupo, puede_dirigir,
      direccion, estudios, profesion, estado_civil, hijos,
      sirve_entre_semana, horario_servicio, grupo_servicio, activo,
    } = body;

    const supabase = getServerSupabase();
    const updates: Record<string, any> = {};

    if (cedula            !== undefined) updates.cedula            = cedula.trim();
    if (nombre            !== undefined) updates.nombre            = nombre.trim();
    if (apellido          !== undefined) updates.apellido          = apellido.trim();
    if (telefono          !== undefined) updates.telefono          = telefono?.trim() || null;
    if (foto_url          !== undefined) updates.foto_url          = foto_url;
    if (grupo             !== undefined) updates.grupo             = grupo.trim();
    if (puede_dirigir     !== undefined) updates.puede_dirigir     = puede_dirigir;
    if (direccion         !== undefined) updates.direccion         = direccion?.trim() || null;
    if (estudios          !== undefined) updates.estudios          = estudios || null;
    if (profesion         !== undefined) updates.profesion         = profesion?.trim() || null;
    if (estado_civil      !== undefined) updates.estado_civil      = estado_civil || null;
    if (hijos             !== undefined) updates.hijos             = hijos != null ? Number(hijos) : 0;
    if (sirve_entre_semana !== undefined) updates.sirve_entre_semana = sirve_entre_semana;
    if (horario_servicio  !== undefined) updates.horario_servicio  = horario_servicio?.trim() || null;
    if (grupo_servicio    !== undefined) updates.grupo_servicio    = grupo_servicio?.trim() || null;
    if (activo            !== undefined) updates.activo            = activo;

    const { data, error } = await supabase
      .from('kids_maestros')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[KIDS MAESTROS] ✅ Actualizado: ${id}`);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS MAESTROS PUT] ❌', e.message);
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
      .from('kids_maestros')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;

    console.log(`[KIDS MAESTROS] 🗑️ Desactivado: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[KIDS MAESTROS DELETE] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
