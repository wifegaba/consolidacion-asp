// File: src/app/api/notas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST: Guardar estudiante
export async function POST(req: NextRequest) {
  try {
    const {
      nombre,
      telefono,
      cedula,
      pais,
      ciudad,
      direccion,
      congregacion
    } = await req.json();

    // ✅ Validación obligatoria de los campos mínimos requeridos
    if (!nombre || !telefono || !cedula || !pais || !ciudad || !direccion || !congregacion) {
      return NextResponse.json(
          { error: 'Todos los campos son obligatorios' },
          { status: 400 }
      );
    }

    // ✅ Insertar en Supabase
    const { data, error } = await supabase
        .from('estudiantes')
        .insert([
          {
            nombre,
            telefono,
            cedula,
            pais,
            ciudad,
            direccion,
            congregacion
          }
        ])
        .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ estudiante: data?.[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Actualizar estudiante
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    // Campos permitidos
    const allow = ['nombre', 'telefono', 'cedula', 'pais', 'ciudad', 'direccion', 'congregacion'] as const;
    const update: Record<string, string | null> = {};

    for (const k of allow) {
      if (body[k] !== undefined) {
        const v = body[k];
        // cadenas vacías -> null (para limpiar campos)
        update[k] = v === '' ? null : String(v);
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('estudiantes')
        .update(update)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, estudiante: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Eliminar estudiante (y sus notas)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id as string;

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    // 1) Borrar notas del estudiante (por si no hay ON DELETE CASCADE en FK)
    const delNotas = await supabase.from('notas').delete().eq('estudiante_id', id);
    if (delNotas.error) {
      return NextResponse.json({ error: delNotas.error.message }, { status: 500 });
    }

    // 2) Borrar estudiante
    const delEst = await supabase.from('estudiantes').delete().eq('id', id).select('id').single();
    if (delEst.error) {
      return NextResponse.json({ error: delEst.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: delEst.data?.id }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
