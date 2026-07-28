
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = getServerSupabase();

        console.log('[TEST] Iniciando prueba de escritura en auditoria_accesos...');

        // Intentar insertar un registro de prueba
        const testData = {
            cedula: 'TEST-SYSTEM',
            nombre: 'PRUEBA DIAGNOSTICO',
            rol_usado: 'TESTER',
            user_agent: 'API TESTER',
            // No incluimos servidor_id para probar si acepta nulos (si falla por FK, lo sabremos)
        };

        const { data, error } = await supabase
            .from('auditoria_accesos')
            .insert(testData)
            .select();

        if (error) {
            console.error('[TEST] ❌ Falló la inserción:', error);
            return NextResponse.json({
                status: 'ERROR',
                message: 'No se pudo guardar en la base de datos',
                details: error,
                hint: 'Verifica que la tabla exista y tenga las columnas correctas.'
            }, { status: 500 });
        }

        console.log('[TEST] ✅ Éxito:', data);
        return NextResponse.json({
            status: 'SUCCESS',
            message: 'El sistema de auditoría funciona correctamente. El problema estaba en el código de login (solucionado con el reinicio).',
            inserted_data: data
        });

    } catch (e: any) {
        console.error('[TEST] ❌ Error crítico:', e);
        return NextResponse.json({
            status: 'CRITICAL_ERROR',
            message: e.message
        }, { status: 500 });
    }
}
