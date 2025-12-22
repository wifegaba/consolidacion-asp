import { supabase } from './supabaseClient';

/**
 * Cuenta el número total de roles/asignaciones vigentes de un servidor.
 * Retorna el conteo para determinar si mostrar portal o ir directo a login.
 */
export async function getUserAssignmentsCount(servidorId: string): Promise<number> {
    if (!servidorId) return 0;

    const [contactosRes, maestrosRes, logisticaRes, rolesRes] = await Promise.all([
        supabase
            .from('asignaciones_contacto')
            .select('id', { count: 'exact', head: true })
            .eq('servidor_id', servidorId)
            .eq('vigente', true),
        supabase
            .from('asignaciones_maestro')
            .select('id', { count: 'exact', head: true })
            .eq('servidor_id', servidorId)
            .eq('vigente', true),
        supabase
            .from('asignaciones_logistica')
            .select('id', { count: 'exact', head: true })
            .eq('servidor_id', servidorId)
            .eq('vigente', true),
        supabase
            .from('servidores_roles')
            .select('id', { count: 'exact', head: true })
            .eq('servidor_id', servidorId)
            .eq('vigente', true)
            .in('rol', ['Director', 'Administrador'])
    ]);

    const total =
        (contactosRes.count || 0) +
        (maestrosRes.count || 0) +
        (logisticaRes.count || 0) +
        (rolesRes.count || 0);

    return total;
}
