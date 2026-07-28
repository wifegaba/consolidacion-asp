// src/app/api/kids/asistencias/route.ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseClient'

/* ── Hora y fecha en zona horaria de Colombia (UTC-5) ── */
function getColombia() {
  const now = new Date()
  const fmt  = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', ...opts }).format(now)

  const fecha = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }) // YYYY-MM-DD
  const hora  = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) // HH:MM:SS
  return { fecha, hora }
}

/* ── GET /api/kids/asistencias?fecha=YYYY-MM-DD&grupo=X&latest=N ── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const grupo  = searchParams.get('grupo')
    const latest = searchParams.get('latest')   // número → últimas N asistencias sin filtro de fecha

    const supabase = getServerSupabase()

    const SELECT = `
      id, nino_id, fecha, hora, metodo, registrado_por, creado_en,
      nino:kids_ninos(id, nombre, apellido, edad, grupo, foto_url, activo)
    `

    let data: any[] | null = null
    let error: any = null

    if (latest) {
      // Modo "últimas N": sin filtro de fecha, ordenadas por creado_en DESC
      const limit  = Math.min(parseInt(latest) || 20, 100)
      const ninoId = searchParams.get('nino_id')
      let q = supabase
        .from('kids_asistencias')
        .select(SELECT)
        .order('creado_en', { ascending: false })
        .limit(limit)
      if (ninoId) q = q.eq('nino_id', ninoId)
      const res = await q
      data  = res.data
      error = res.error
    } else {
      const fecha = searchParams.get('fecha') ?? getColombia().fecha
      const res = await supabase
        .from('kids_asistencias')
        .select(SELECT)
        .eq('fecha', fecha)
        .order('hora', { ascending: false })
      data  = res.data
      error = res.error
    }

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

    // Fecha y hora en Colombia
    const { fecha: hoy, hora } = getColombia()

    // Verificar si ya fue registrado hoy
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
      .insert({ nino_id, metodo, registrado_por, fecha: hoy, hora })
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
