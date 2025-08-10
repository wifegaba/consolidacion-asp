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

    return NextResponse.json({ estudiante: data[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
