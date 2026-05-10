// src/app/api/kids/maestros/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

const SELECT_FIELDS = [
  'id','cedula','nombre','apellido','telefono','foto_url',
  'grupo','puede_dirigir',
  'direccion','estudios','profesion','estado_civil','hijos',
  'sirve_entre_semana','horario_servicio','grupo_servicio',
  'activo','creado_en',
].join(', ');

// ── GET — Listar maestros ─────────────────────────────────────────────────────
// Query params opcionales:
//   ?grupo=Grupo+5  → filtra por grupo (para el panel de coordinador)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const grupo = searchParams.get('grupo');

    const supabase = getServerSupabase();

    let query = supabase
      .from('kids_maestros')
      .select(SELECT_FIELDS)
      .order('creado_en', { ascending: false });

    if (grupo) query = query.eq('grupo', grupo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS MAESTROS GET] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST — Crear maestro ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      cedula, nombre, apellido, telefono, foto_url,
      grupo, puede_dirigir,
      direccion, estudios, profesion, estado_civil, hijos,
      sirve_entre_semana, horario_servicio, grupo_servicio,
    } = body;

    if (!cedula || !nombre || !apellido || !grupo) {
      return NextResponse.json(
        { error: 'Cédula, nombre, apellido y grupo son obligatorios.' },
        { status: 400 },
      );
    }

    const supabase = getServerSupabase();

    // Verificar cédula duplicada
    const { data: existe } = await supabase
      .from('kids_maestros')
      .select('id')
      .eq('cedula', cedula.trim())
      .single();

    if (existe) {
      return NextResponse.json(
        { error: 'Ya existe un maestro con esa cédula.' },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('kids_maestros')
      .insert({
        cedula:             cedula.trim(),
        nombre:             nombre.trim(),
        apellido:           apellido.trim(),
        telefono:           telefono?.trim()       || null,
        foto_url:           foto_url               || null,
        grupo:              grupo.trim(),
        puede_dirigir:      puede_dirigir          ?? false,
        direccion:          direccion?.trim()       || null,
        estudios:           estudios               || null,
        profesion:          profesion?.trim()       || null,
        estado_civil:       estado_civil           || null,
        hijos:              hijos != null ? Number(hijos) : 0,
        sirve_entre_semana: sirve_entre_semana     ?? false,
        horario_servicio:   horario_servicio?.trim() || null,
        grupo_servicio:     grupo_servicio?.trim()   || null,
        activo:             true,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    console.log(`[KIDS MAESTROS] ✅ Creado: ${nombre} ${apellido}`);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('[KIDS MAESTROS POST] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
