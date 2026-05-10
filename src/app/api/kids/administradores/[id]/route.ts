// src/app/api/kids/administradores/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// ── PUT — Actualizar administrador ───────────────────────────────────────────
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body   = await req.json();
    const { cedula, nombre, apellido, telefono, foto_url, activo } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const supabase = getServerSupabase();

    const updates: Record<string, any> = {};
    if (cedula    !== undefined) updates.cedula    = cedula.trim();
    if (nombre    !== undefined) updates.nombre    = nombre.trim();
    if (apellido  !== undefined) updates.apellido  = apellido.trim();
    if (telefono  !== undefined) updates.telefono  = telefono?.trim() ?? null;
    if (foto_url  !== undefined) updates.foto_url  = foto_url;
    if (activo    !== undefined) updates.activo    = activo;

    const { data, error } = await supabase
      .from('kids_administradores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[KIDS ADMINS] ✅ Actualizado: ${id}`);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS ADMINS PUT] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE — Desactivar (soft delete) administrador ──────────────────────────
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const supabase = getServerSupabase();

    // Soft delete: solo desactivamos, no borramos el registro
    const { error } = await supabase
      .from('kids_administradores')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;

    console.log(`[KIDS ADMINS] 🗑️ Desactivado: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[KIDS ADMINS DELETE] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
