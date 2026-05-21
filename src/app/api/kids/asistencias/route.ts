// src/app/api/kids/asistencias/route.ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseClient'

/* ── GET /api/kids/asistencias?fecha=YYYY-MM-DD&grupo=X ── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const fecha = searchParams.get('fecha') ?? new Date().toISOString().slice(0, 10)
    const grupo = searchParams.get('grupo')

    const supabase = getServerSupabase()

    let query = supabase
      .from('kids_asistencias')
      .select(`
        id, nino_id, fecha, hora, metodo, registrado_por, creado_en,
        nino:kids_ninos(id, nombre, apellido, edad, grupo, foto_url, activo)
      `)
      .eq('fecha', fecha)
      .order('hora', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    // Filtrar por grupo en memoria si se solicita
    const filtered = grupo
      ? (data ?? []).filter((r: any) => r.nino?.grupo === grupo)
      : (data ?? [])

    return NextResponse.json({ ok: true, data: filtered })
  } catch (e: any) {
    console.error('[ASISTENCIAS GET] ❌', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/* ── POST /api/kids/asistencias ── */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { nino_id, metodo = 'facial', registrado_por } = body

    if (!nino_id) {
      return NextResponse.json({ error: 'nino_id es requerido.' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    // Verificar si ya fue registrado hoy
    const hoy = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase
      .from('kids_asistencias')
      .select('id')
      .eq('nino_id', nino_id)
      .eq('fecha', hoy)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, already: true, data: existing })
    }

    const { data, error } = await supabase
      .from('kids_asistencias')
      .insert({ nino_id, metodo, registrado_por })
      .select(`
        id, nino_id, fecha, hora, metodo, registrado_por, creado_en,
        nino:kids_ninos(id, nombre, apellido, edad, grupo, foto_url, activo)
      `)
      .single()

    if (error) throw error

    console.log(`[ASISTENCIAS] ✅ Registrada: ${nino_id}`)
    return NextResponse.json({ ok: true, already: false, data }, { status: 201 })
  } catch (e: any) {
    console.error('[ASISTENCIAS POST] ❌', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
