'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import './mini-metricas.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Metricas = {
    totalEstudiantes: number;
    activos: number;           // estudiantes con al menos 1 nota
    promedioNotas: number;     // promedio global 0..100 (o el rango que uses)
};

export default function MiniMetricas() {
    const [loading, setLoading] = useState(true);
    const [m, setM] = useState<Metricas>({
        totalEstudiantes: 0,
        activos: 0,
        promedioNotas: 0,
    });

    useEffect(() => {
        const cargar = async () => {
            try {
                // 1) Total de estudiantes
                const { count: totalEstudiantes, error: e1 } = await supabase
                    .from('estudiantes')
                    .select('*', { count: 'exact', head: true });
                if (e1) throw e1;

                // 2) Activos = estudiantes con al menos 1 nota
                const { data: notas, error: e2 } = await supabase
                    .from('notas')
                    .select('estudiante_id');
                if (e2) throw e2;
                const activos = new Set((notas ?? []).map(n => n.estudiante_id)).size;

                // 3) Promedio de notas (global)
                const { data: notasAll, error: e3 } = await supabase
                    .from('notas')
                    .select('nota');
                if (e3) throw e3;
                const arr = (notasAll ?? []).map(n => Number(n.nota)).filter(n => !Number.isNaN(n));
                const promedioNotas = arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

                setM({
                    totalEstudiantes: totalEstudiantes ?? 0,
                    activos,
                    promedioNotas: Number(promedioNotas.toFixed(2)),
                });
            } catch (err: any) {
                toast.error(`No pude cargar métricas: ${err.message ?? 'Error desconocido'}`);
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, []);

    return (
        <section className="mini-metricas" aria-label="Mini métricas del dashboard">
            <article className="card-mini" data-estado={loading ? 'loading' : 'ok'}>
                <span className="label">Total estudiantes</span>
                <span className="valor">{loading ? '—' : m.totalEstudiantes}</span>
            </article>

            <article className="card-mini" data-estado={loading ? 'loading' : 'ok'}>
                <span className="label">Activos</span>
                <span className="valor">{loading ? '—' : m.activos}</span>
            </article>

            <article className="card-mini" data-estado={loading ? 'loading' : 'ok'}>
                <span className="label">Promedio notas</span>
                <span className="valor">
          {loading ? '—' : m.promedioNotas}
        </span>
            </article>
        </section>
    );
}
