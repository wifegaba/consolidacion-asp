// src/lib/academico.ts
import { createClient } from '@supabase/supabase-js';
const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Escapa % y _ para usar en ILIKE
const esc = (s: string) => s.replace(/[%_]/g, (m) => `\\${m}`);

// ——— Estudiantes ———
export async function buscarEstudiantes(q: string, limit = 8) {
    const term = (q ?? '').trim();
    if (term.length < 2) return [];

    const { data, error } = await sb
        .from('estudiantes')
        .select(
            `
      id,
      nombre,
      telefono,
      cedula,
      pais,
      ciudad,
      direccion,
      congregacion
    `
        )
        .or(
            `nombre.ilike.%${esc(term)}%,cedula.ilike.%${esc(
                term
            )}%,telefono.ilike.%${esc(term)}%`
        )
        .order('nombre', { ascending: true })
        .limit(Math.min(limit, 25));

    if (error) throw error;
    return data ?? [];
}

// ——— Académico ———
export async function getSeriesBySemestre(semestreId: number) {
    const { data, error } = await sb
        .from('series')
        .select('id,titulo,profesor,sesiones,semestre_id')
        .eq('semestre_id', semestreId)
        .order('titulo', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function getClasesBySerie(serieId: number) {
    const { data, error } = await sb
        .from('clases')
        .select('id,numero,serie_id')
        .eq('serie_id', serieId)
        .order('numero', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function getNotas(
    estudianteId: string,
    serieId: number,
    semestreId: number
) {
    // Usa joins explícitos (!inner) para poder filtrar por campos de series
    const { data, error } = await sb
        .from('notas')
        .select(
            `
      id,
      nota,
      clase_id,
      fecha_registro,
      clases!inner (
        id,
        numero,
        series!inner (
          id,
          titulo,
          profesor,
          semestre_id
        )
      )
    `
        )
        .eq('estudiante_id', estudianteId)
        .eq('clases.series.id', serieId)
        .eq('clases.series.semestre_id', semestreId)
        .order('fecha_registro', { ascending: false });

    if (error) throw error;

    // Normaliza
    return (data ?? []).map((n: any) => {
        const clase = n.clases; // con !inner no viene como array
        const serie = clase?.series;
        return {
            id: n.id,
            clase: clase?.numero ?? '—',
            nota: n.nota,
            serieTitulo: serie?.titulo ?? '—',
            profesor: serie?.profesor ?? '—',
            semestreId: serie?.semestre_id ?? null,
            fecha: n.fecha_registro,
        };
    });
}

export async function saveNota(
    estudianteId: string,
    claseId: number,
    nota: number
) {
    const { data, error } = await sb
        .from('notas')
        .insert({ estudiante_id: estudianteId, clase_id: claseId, nota })
        .select('id')
        .single();

    if (error) throw error;
    return data;
}
