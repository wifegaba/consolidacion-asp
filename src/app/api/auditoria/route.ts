
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = getServerSupabase();

        // Consultar logs (últimos 100)
        // Asumimos que la tabla 'auditoria_accesos' existe.
        // Si no existe, esto devolverá error, el cual manejaremos en el cliente.
        const { data, error } = await supabase
            .from('auditoria_accesos')
            .select('*')
            .order('fecha_acceso', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Error fetching logs:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
