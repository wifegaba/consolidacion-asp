// File: src/app/api/estudiantes/buscar/route.ts
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🔑 Inicializa Supabase (Edge OK)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    const id = searchParams.get('id');
    const resumenFlag = searchParams.get('resumen') === '1';
    const detalleFlag = searchParams.get('detalle') === '1';
    const semestreNum = searchParams.get('semestre'); // número (1..5)

    // ---------- DETALLE de semestre (series + clases con nota) ----------
    // GET /api/estudiantes/buscar?id=UUID&detalle=1&semestre=3
    if (id && detalleFlag && semestreNum) {
      // 1) Traer el semestre por su número con series -> clases (solo IDs)
      const { data: semestreRow, error: errSem } = await supabase
          .from('semestres')
          .select(`
          id, numero, nombre,
          series:series (
            id, titulo,
            clases:clases ( id )
          )
        `)
          .eq('numero', Number(semestreNum))
          .maybeSingle();
      if (errSem) throw errSem;

      if (!semestreRow) {
        return NextResponse.json(
            { ok: true, semestre: null, series: [] },
            { status: 200 }
        );
      }

      // 2) Notas actuales del estudiante para las clases de este semestre
      const classIds: number[] = (semestreRow.series ?? [])
          .flatMap((s: any) => (s.clases ?? []).map((c: any) => c.id))
          .filter((v: any) => typeof v === 'number');

      let notasMap: Record<number, number> = {};
      if (classIds.length > 0) {
        const { data: notas, error: errNotas } = await supabase
            .from('notas')
            .select('clase_id, nota')
            .eq('estudiante_id', id)
            .in('clase_id', classIds);
        if (errNotas) throw errNotas;

        notasMap = Object.fromEntries(
            (notas ?? [])
                .filter((n: any) => typeof n.clase_id === 'number')
                .map((n: any) => [n.clase_id as number, n.nota as number])
        );
      }

      // 3) Construir payload: series -> clases con {id, nota}
      const series = (semestreRow.series ?? []).map((s: any) => ({
        id: s.id,
        titulo: s.titulo,
        clases: (s.clases ?? []).map((c: any, i: number) => ({
          id: c.id,
          etiqueta: `Clase #${i + 1}`,
          nota: notasMap[c.id] ?? null,
        })),
      }));

      return NextResponse.json(
          {
            ok: true,
            semestre: {
              id: semestreRow.id,
              numero: semestreRow.numero,
              nombre: semestreRow.nombre,
            },
            series,
          },
          { status: 200 }
      );
    }

    // ---------- RESUMEN (avance + promedio por semestre) ----------
    // GET /api/estudiantes/buscar?id=UUID&resumen=1
    if (id && resumenFlag) {
      // 2 consultas en paralelo (menos latencia)
      const [semRes, notasRes] = await Promise.all([
        supabase
            .from('semestres')
            .select(`
            id, numero, nombre,
            series:series (
              id, titulo, semestre_id,
              clases:clases ( id )
            )
          `)
            .order('numero', { ascending: true }),

        supabase
            .from('notas')
            .select(`
            id, nota, clase_id,
            clases:clases!inner (
              id, serie_id,
              series:series!inner ( semestre_id )
            )
          `)
            .eq('estudiante_id', id),
      ]);

      const { data: semestres, error: errSem } = semRes;
      if (errSem) throw errSem;

      const { data: notas, error: errNotas } = notasRes;
      if (errNotas) throw errNotas;

      type NotaRow = {
        id: number;
        nota: number | null;
        clase_id: number | null;
        clases: { id: number; serie_id: number; series: { semestre_id: number } } | null;
      };

      const getSemId = (n: NotaRow) => n?.clases?.series?.semestre_id;
      const getSerieId = (n: NotaRow) => n?.clases?.serie_id;

      const resumen = (semestres ?? []).map((sem: any) => {
        const series = sem.series ?? [];
        let seriesCompletas = 0;

        const notasSemestre = (notas ?? []).filter(
            (n: any) => getSemId(n as NotaRow) === sem.id && typeof n.nota === 'number'
        );

        const promedioSemestre =
            notasSemestre.length > 0
                ? Number(
                    (
                        notasSemestre.reduce((acc: number, n: any) => acc + (n.nota as number), 0) /
                        notasSemestre.length
                    ).toFixed(2)
                )
                : null;

        const detalleSeries = series.map((s: any) => {
          const totalSesiones = s.clases?.length ?? 0;

          const notasSerie = (notas ?? []).filter(
              (n: any) => getSerieId(n as NotaRow) === s.id && typeof n.nota === 'number'
          );

          const sesionesConNota = notasSerie.length;
          const completada = totalSesiones > 0 && sesionesConNota === totalSesiones;

          if (completada) seriesCompletas += 1;

          const promedioSerie =
              notasSerie.length > 0
                  ? Number(
                      (
                          notasSerie.reduce((acc: number, n: any) => acc + (n.nota as number), 0) /
                          notasSerie.length
                      ).toFixed(2)
                  )
                  : null;

          return {
            id: s.id,
            titulo: s.titulo,
            totalSesiones,
            sesionesConNota,
            completada,
            promedio: promedioSerie,
          };
        });

        const avance = series.length > 0 ? Math.round((seriesCompletas / series.length) * 100) : 0;

        return {
          semestreId: sem.id,
          numero: sem.numero,
          nombre: sem.nombre,
          avance,
          promedio: promedioSemestre,
          series: detalleSeries,
        };
      });

      return NextResponse.json({ ok: true, resumen }, { status: 200 });
    }

    // ---------- BÚSQUEDA (tu lógica original) ----------
    if (!query) {
      return NextResponse.json({ estudiantes: [] }, { status: 200 });
    }

    const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .or(`nombre.ilike.%${query}%,telefono.ilike.%${query}%,cedula.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
      console.error('Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ estudiantes: data }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Server error:', err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ---------- POST: Upsert masivo de notas ----------
// Body esperado:
// { estudianteId: string, notas: [{ clase_id: number, nota: number|null }, ...] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const estudianteId = body?.estudianteId as string;
    const notas = (body?.notas ?? []) as Array<{ clase_id: number; nota: number | null }>;

    if (!estudianteId || !Array.isArray(notas)) {
      return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 });
    }

    // Filtra registros válidos
    const rows = notas
        .filter((n) => typeof n?.clase_id === 'number')
        .map((n) => ({
          estudiante_id: estudianteId,
          clase_id: n.clase_id,
          nota: n.nota,
        }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, count: 0 }, { status: 200 });
    }

    // Requiere constraint único (estudiante_id,clase_id) para upsert.
    // Si no lo tienes, créalo en Postgres o cambia a delete+insert.
    const { error } = await supabase.from('notas').upsert(rows, {
      onConflict: 'estudiante_id,clase_id',
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, count: rows.length }, { status: 200 });
  } catch (err: any) {
    console.error('POST /estudiantes/buscar:', err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || 'Error' }, { status: 500 });
  }
}
