import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const id = params.id;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { data, error } = await sb
        .from('v_resumen_estudiante_semestre')
        .select('semestre_id, porcentaje_avance, promedio_simple, promedio_ponderado')
        .eq('estudiante_id', id)
        .order('semestre_id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mapa 1..5
    const out: Record<number, { avance: number; prom: number | null }> = {
        1: { avance: 0, prom: null },
        2: { avance: 0, prom: null },
        3: { avance: 0, prom: null },
        4: { avance: 0, prom: null },
        5: { avance: 0, prom: null },
    };

    (data ?? []).forEach((r: any) => {
        const s = Number(r.semestre_id);
        out[s] = {
            avance: Number(r.porcentaje_avance ?? 0),
            // prioriza ponderado; si viene null usa simple
            prom: r.promedio_ponderado ?? r.promedio_simple ?? null,
        };
    });

    return NextResponse.json({ resumen: out }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
