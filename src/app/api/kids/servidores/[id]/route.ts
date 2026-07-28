// src/app/api/kids/servidores/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// ── PUT — Actualizar servidor ──────────────────────────────────────────────────
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const body = await req.json();
    const {
      cedula, nombre, apellido, telefono, foto_url, roles,
      direccion, edad, hijos, estado_civil, profesion, estudios,
      grupo_asignado, grupo_timoteos_asignado, puede_dirigir, sirve_entre_semana, horario_servicio, grupo_servicio,
      cumpleanos, disponibilidad_domingo_7, disponibilidad_domingo_9, disponibilidad_domingo_11, activo,
    } = body;

    const supabase = getServerSupabase();
    const updates: Record<string, any> = {};

    if (cedula                 !== undefined) updates.cedula                 = cedula.trim();
    if (nombre                 !== undefined) updates.nombre                 = nombre.trim();
    if (apellido               !== undefined) updates.apellido               = apellido.trim();
    if (telefono               !== undefined) updates.telefono               = telefono?.trim() || null;
    if (foto_url               !== undefined) updates.foto_url               = foto_url;
    if (roles                  !== undefined) {
      const rolesArr = Array.isArray(roles) ? roles : [];
      if (rolesArr.length === 0) {
        return NextResponse.json({ error: 'El servidor debe tener al menos un rol.' }, { status: 400 });
      }
      updates.roles = rolesArr.map(r => r.toUpperCase());
    }
    if (direccion              !== undefined) updates.direccion              = direccion?.trim() || null;
    if (edad                   !== undefined) updates.edad                   = edad != null ? Number(edad) : null;
    if (hijos                  !== undefined) updates.hijos                  = hijos?.trim() || null;
    if (estado_civil           !== undefined) updates.estado_civil           = estado_civil?.trim() || null;
    if (profesion              !== undefined) updates.profesion              = profesion?.trim() || null;
    if (estudios               !== undefined) updates.estudios               = estudios?.trim() || null;
    if (grupo_asignado         !== undefined) updates.grupo_asignado         = grupo_asignado?.trim() || null;
    if (grupo_timoteos_asignado!== undefined) updates.grupo_timoteos_asignado = grupo_timoteos_asignado?.trim() || null;
    if (puede_dirigir          !== undefined) updates.puede_dirigir          = puede_dirigir;
    if (sirve_entre_semana!== undefined) updates.sirve_entre_semana= sirve_entre_semana;
    if (horario_servicio  !== undefined) updates.horario_servicio  = horario_servicio?.trim() || null;
    if (grupo_servicio    !== undefined) updates.grupo_servicio    = grupo_servicio?.trim() || null;
    if (cumpleanos        !== undefined) updates.cumpleanos        = cumpleanos?.trim() || null;
    if (disponibilidad_domingo_7  !== undefined) updates.disponibilidad_domingo_7  = Boolean(disponibilidad_domingo_7);
    if (disponibilidad_domingo_9  !== undefined) updates.disponibilidad_domingo_9  = Boolean(disponibilidad_domingo_9);
    if (disponibilidad_domingo_11 !== undefined) updates.disponibilidad_domingo_11 = Boolean(disponibilidad_domingo_11);
    if (activo            !== undefined) updates.activo            = activo;

    const { data, error } = await supabase
      .from('kids_servidores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[KIDS SERVIDORES] ✅ Actualizado: ${id}`);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS SERVIDORES PUT] ❌', e.message);
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
      .from('kids_servidores')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;

    console.log(`[KIDS SERVIDORES] 🗑️ Desactivado: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[KIDS SERVIDORES DELETE] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
