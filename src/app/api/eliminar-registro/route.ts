
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { progreso_id, persona_id } = body;

        if (!progreso_id) {
            return NextResponse.json({ error: 'Falta progreso_id' }, { status: 400 });
        }

        // Usamos el cliente con rol de servicio para bypass de RLS
        const supabase = getServerSupabase();

        // 1. Logs para debug en servidor
        console.log(`[API DELETE] Intentando eliminar Progreso: ${progreso_id}, Persona: ${persona_id}`);

        // 2. Eliminar Progreso (Historial)
        const { error: errP } = await supabase.from('progreso').delete().eq('id', progreso_id);

        if (errP) {
            console.error('[API DELETE] Error borrando progreso:', errP);
            return NextResponse.json({ error: 'Error al borrar progreso: ' + errP.message }, { status: 500 });
        }

        // 3. Eliminar Persona (Estudiante) - Solo si se proporcionó ID
        if (persona_id) {
            const { error: errPer } = await supabase.from('persona').delete().eq('id', persona_id);

            if (errPer) {
                console.warn('[API DELETE] Advertencia borrando persona (puede tener otras dependencias):', errPer);
                // No fallamos la respuesta completa si solo falla borrar la persona, 
                // ya que lo principal (el historial en el banco) se borró.
                return NextResponse.json({
                    success: true,
                    message: 'Progreso eliminado. Persona no eliminada por dependencias.',
                    partial_error: errPer.message
                });
            }
        }

        console.log('[API DELETE] Eliminación exitosa.');
        return NextResponse.json({ success: true, message: 'Registro eliminado correctamente.' });

    } catch (e: any) {
        console.error('[API DELETE] Error crítico:', e);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
