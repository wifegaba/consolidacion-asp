// src/app/api/kids/administradores/upsert/route.ts
// Upsert seguro usando service_role key (necesario por RLS de kids_administradores).
// Llamado desde el panel de Gestión de Servidores al asignar el rol "Adm Kids".

import { NextResponse }      from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cedula, nombre, apellido, telefono, activo } = body;

    if (!cedula) {
      return NextResponse.json({ error: 'Cédula es obligatoria.' }, { status: 400 });
    }

    const supabase   = getServerSupabase();
    const cedulaTrim = cedula.trim();

    // ── Modo desactivación (cuando se quita el rol Kids del panel) ────────────
    if (activo === false) {
      const { error } = await supabase
        .from('kids_administradores')
        .update({ activo: false })
        .eq('cedula', cedulaTrim);

      if (error) console.warn('[KIDS UPSERT] No se pudo desactivar:', error.message);
      console.log(`[KIDS UPSERT] 🔴 Desactivado: ${cedulaTrim}`);
      return NextResponse.json({ ok: true, action: 'deactivated' });
    }

    // ── Modo activación/creación ──────────────────────────────────────────────
    if (!nombre || !apellido) {
      return NextResponse.json(
        { error: 'Nombre y apellido son obligatorios para crear/activar.' },
        { status: 400 }
      );
    }

    // Verificar si ya existe
    const { data: existente } = await supabase
      .from('kids_administradores')
      .select('id')
      .eq('cedula', cedulaTrim)
      .maybeSingle();

    if (existente) {
      // Ya existe → reactivar y actualizar datos
      const { data, error } = await supabase
        .from('kids_administradores')
        .update({
          nombre:   nombre.trim(),
          apellido: apellido.trim(),
          telefono: telefono?.trim() ?? null,
          activo:   true,
        })
        .eq('cedula', cedulaTrim)
        .select()
        .single();

      if (error) throw error;

      console.log(`[KIDS UPSERT] ✅ Reactivado: ${cedulaTrim}`);
      return NextResponse.json({ ok: true, data, action: 'updated' });
    }

    // No existe → insertar nuevo
    const { data, error } = await supabase
      .from('kids_administradores')
      .insert({
        cedula:   cedulaTrim,
        nombre:   nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() ?? null,
        activo:   true,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[KIDS UPSERT] ✅ Creado: ${nombre} ${apellido}`);
    return NextResponse.json({ ok: true, data, action: 'created' }, { status: 201 });

  } catch (e: any) {
    console.error('[KIDS UPSERT] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
