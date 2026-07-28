// src/app/api/kids/observaciones/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

const SELECT_FIELDS = [
  'id','maestro_id','coordinador_id','grupo',
  'tipo','titulo','descripcion','fecha',
  'activo','creado_en',
].join(', ');

// ── GET — Listar observaciones ────────────────────────────────────────────────
// Query params opcionales:
//   ?maestro_id=uuid   → observaciones de un maestro específico
//   ?grupo=Grupo+5     → observaciones de un grupo (vista coordinadora)
//   (sin params)       → todas — solo para admins
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const maestro_id = searchParams.get('maestro_id');
    const grupo      = searchParams.get('grupo');

    const supabase = getServerSupabase();

    let query = supabase
      .from('kids_observaciones')
      .select(SELECT_FIELDS)
      .eq('activo', true)
      .order('fecha',      { ascending: false })
      .order('creado_en',  { ascending: false });

    if (maestro_id) query = query.eq('maestro_id', maestro_id);
    if (grupo)      query = query.eq('grupo', grupo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[OBS GET] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST — Crear observación ──────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      maestro_id, coordinador_id, grupo,
      tipo, titulo, descripcion, fecha,
    } = body;

    if (!maestro_id || !coordinador_id || !grupo || !titulo?.trim()) {
      return NextResponse.json(
        { error: 'maestro_id, coordinador_id, grupo y título son obligatorios.' },
        { status: 400 },
      );
    }

    const TIPOS_VALIDOS = ['general','puntualidad','desempeño','logro','conducta','asistencia'];
    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'general';

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('kids_observaciones')
      .insert({
        maestro_id,
        coordinador_id,
        grupo,
        tipo:        tipoFinal,
        titulo:      titulo.trim(),
        descripcion: descripcion?.trim() || null,
        fecha:       fecha || new Date().toISOString().split('T')[0],
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    console.log(`[OBS] ✅ Creada para maestro ${maestro_id} por coordinador ${coordinador_id}`);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('[OBS POST] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
