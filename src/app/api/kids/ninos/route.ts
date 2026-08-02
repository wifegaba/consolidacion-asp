// src/app/api/kids/ninos/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';
import { canCreateKids, getKidsNinosActor } from '@/lib/kidsNinosAuth';
import { findPossibleKidsDuplicates } from '@/lib/kidsDuplicateDetection';

// foto_url SIEMPRE existe en la tabla (text, nullable) → va en BASE_FIELDS
const BASE_FIELDS = [
  'id', 'nombre', 'apellido', 'edad',
  'nombre_acudiente', 'telefono_acudiente',
  'foto_url',                            // ← siempre presente
  'activo', 'creado_en',
];
// Solo columnas que PUEDEN no existir en tablas más viejas
const EXTRA_FIELDS  = ['grupo', 'acudiente', 'telefono', 'observaciones', 'ti', 'face_descriptor'];
const OPTIONAL_COLS = new Set(EXTRA_FIELDS);

function validFaceDescriptor(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length === 128
    && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getKidsNinosActor(req);
    if (!actor) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const grupo = searchParams.get('grupo');
    const supabase  = getServerSupabase();
    const selectAll = [...BASE_FIELDS, ...EXTRA_FIELDS].join(', ');

    let query = supabase.from('kids_ninos').select(selectAll).order('creado_en', { ascending: false });
    if (grupo) query = query.eq('grupo', grupo);

    let { data, error } = await query;
    if (error && error.message.includes('column')) {
      const f = await supabase.from('kids_ninos').select(BASE_FIELDS.join(', ')).order('creado_en', { ascending: false });
      if (f.error) throw f.error;
      data = f.data;
    } else if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[NINOS GET] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getKidsNinosActor(req);
    if (!canCreateKids(actor)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const body = await req.json();
    const { nombre, apellido, edad, acudiente, telefono, grupo, observaciones, foto_url, face_descriptor } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    if (face_descriptor != null && !validFaceDescriptor(face_descriptor)) {
      return NextResponse.json({ error: 'El descriptor facial debe contener 128 valores numéricos.' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Validación final en servidor: previene duplicados incluso si se salta la
    // interfaz o si otro dispositivo registra al mismo niño a la vez.
    const duplicateFields = [...BASE_FIELDS, ...EXTRA_FIELDS].join(', ');
    let { data: existingKids, error: duplicateError } = await supabase
      .from('kids_ninos')
      .select(duplicateFields);
    if (duplicateError && duplicateError.message.includes('column')) {
      const fallback = await supabase.from('kids_ninos').select(BASE_FIELDS.join(', '));
      if (fallback.error) throw fallback.error;
      existingKids = fallback.data;
      duplicateError = null;
    }
    if (duplicateError) throw duplicateError;

    const duplicates = findPossibleKidsDuplicates(
      {
        nombre,
        apellido,
        edad: edad != null ? Number(edad) : null,
        telefono,
        face_descriptor: validFaceDescriptor(face_descriptor) ? face_descriptor : null,
      },
      (existingKids ?? []).map((kid: any) => ({
        id: kid.id,
        nombre: kid.nombre,
        apellido: kid.apellido,
        edad: kid.edad,
        telefono: kid.telefono ?? kid.telefono_acudiente,
        face_descriptor: validFaceDescriptor(kid.face_descriptor) ? kid.face_descriptor : null,
        activo: kid.activo,
      })),
    );
    if (duplicates.length > 0) {
      const duplicate = duplicates[0];
      return NextResponse.json({
        error: `Posible duplicado: ya existe ${duplicate.nombre} ${duplicate.apellido}. Revisa el registro antes de crear otro.`,
        code: 'POSSIBLE_DUPLICATE',
        duplicates,
      }, { status: 409 });
    }

    const record: Record<string, any> = {
      nombre:             nombre.trim(),
      apellido:           apellido?.trim() || '',
      edad:               edad != null ? Number(edad) : 0,
      nombre_acudiente:   acudiente?.trim() || '',
      telefono_acudiente: telefono?.trim()  || '',
      activo:             true,
    };

    if (grupo)                 record.grupo         = grupo;
    if (acudiente?.trim())     record.acudiente     = acudiente.trim();
    if (telefono?.trim())      record.telefono      = telefono.trim();
    if (observaciones?.trim()) record.observaciones = observaciones.trim();
    if (foto_url)              record.foto_url      = foto_url;  // proxy URL ya listo
    if (face_descriptor)       record.face_descriptor = face_descriptor;

    const selectFields = [...BASE_FIELDS, ...EXTRA_FIELDS].join(', ');
    let { data, error } = await supabase.from('kids_ninos').insert(record).select(selectFields).single();

    if (error && error.message.includes('column')) {
      const safe: Record<string, any> = { ...record };
      for (const col of OPTIONAL_COLS) delete safe[col];
      const retry = await supabase.from('kids_ninos').insert(safe).select(BASE_FIELDS.join(', ')).single();
      if (retry.error) throw retry.error;
      data = retry.data;
    } else if (error) throw error;

    console.log(`[NINOS] ✅ Creado: ${nombre}`);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('[NINOS POST] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
