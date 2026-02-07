
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        // Calcular rangos para Supabase (0-based start, inclusive end)
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const supabase = getServerSupabase();

        // Consultar logs con paginación
        const { data, error, count } = await supabase
            .from('auditoria_accesos')
            .select('*', { count: 'exact' })
            .order('fecha_acceso', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error fetching logs:', error);
            // Mensaje más amigable si la tabla no existe
            const msg = error.code === '42P01' ? 'Tabla auditoria_accesos no encontrada' : error.message;
            return NextResponse.json({ error: msg }, { status: 500 });
        }

        return NextResponse.json({
            data,
            meta: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
