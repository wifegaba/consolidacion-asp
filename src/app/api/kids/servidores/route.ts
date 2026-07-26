// src/app/api/kids/servidores/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

const SELECT_FIELDS = [
  'id', 'cedula', 'nombre', 'apellido', 'telefono', 'foto_url',
  'roles', 'direccion', 'edad', 'hijos', 'estado_civil', 'profesion', 'estudios',
  'grupo_asignado', 'grupo_timoteos_asignado', 'puede_dirigir', 'sirve_entre_semana', 'horario_servicio', 'grupo_servicio',
  'activo', 'creado_en'
].join(', ');

// ── GET — Listar servidores ──────────────────────────────────────────────────
// Query params opcionales:
//   ?rol=MAESTRO  → filtra por rol
//   ?grupo_asignado=Grupo+5 → filtra por grupo
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rol = searchParams.get('rol');
    const grupo = searchParams.get('grupo_asignado');

    const supabase = getServerSupabase();

    let query = supabase
      .from('kids_servidores')
      .select(SELECT_FIELDS)
      .order('creado_en', { ascending: false });

    if (rol) {
      // Supabase arrays check: contains
      query = query.contains('roles', [rol.toUpperCase()]);
    }
    if (grupo) {
      query = query.eq('grupo_asignado', grupo);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[KIDS SERVIDORES GET] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST — Crear servidor ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      cedula, nombre, apellido, telefono, foto_url, roles,
      direccion, edad, hijos, estado_civil, profesion, estudios,
      grupo_asignado, grupo_timoteos_asignado, puede_dirigir, sirve_entre_semana, horario_servicio, grupo_servicio,
    } = body;

    if (!cedula || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'Cédula, nombre y apellido son obligatorios.' },
        { status: 400 },
      );
    }

    const rolesArr = Array.isArray(roles) ? roles : [];
    if (rolesArr.length === 0) {
      return NextResponse.json(
        { error: 'Debe asignar al menos un rol al servidor.' },
        { status: 400 },
      );
    }

    const supabase = getServerSupabase();

    // Verificar cédula duplicada
    const { data: existe } = await supabase
      .from('kids_servidores')
      .select('id')
      .eq('cedula', cedula.trim())
      .single();

    if (existe) {
      return NextResponse.json(
        { error: 'Ya existe un servidor con esa cédula.' },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('kids_servidores')
      .insert({
        cedula:             cedula.trim(),
        nombre:             nombre.trim(),
        apellido:           apellido.trim(),
        telefono:           telefono?.trim()       || null,
        foto_url:           foto_url               || null,
        roles:              rolesArr.map(r => r.toUpperCase()),
        direccion:          direccion?.trim()      || null,
        edad:               edad != null ? Number(edad) : null,
        hijos:              hijos?.trim()          || null,
        estado_civil:       estado_civil?.trim()   || null,
        profesion:               profesion?.trim()               || null,
        estudios:                estudios?.trim()                || null,
        grupo_asignado:          grupo_asignado?.trim()          || null,
        grupo_timoteos_asignado: grupo_timoteos_asignado?.trim() || null,
        puede_dirigir:           puede_dirigir                   ?? false,
        sirve_entre_semana: sirve_entre_semana     ?? false,
        horario_servicio:   horario_servicio?.trim() || null,
        grupo_servicio:     grupo_servicio?.trim()   || null,
        activo:             true,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    console.log(`[KIDS SERVIDORES] ✅ Creado: ${nombre} ${apellido}`);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('[KIDS SERVIDORES POST] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
