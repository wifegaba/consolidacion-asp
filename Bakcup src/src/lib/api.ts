// src/lib/api.ts
import { supabase } from './supabaseClient'

export async function getPendientes(mod:number, sem:number, dia:'Domingo'|'Martes'|'Virtual'){
    const { data, error } = await supabase
        .from('v_llamadas_pendientes')
        .select('progreso_id,nombre,telefono')
        .eq('modulo', mod).eq('semana', sem).eq('dia', dia)
        .order('nombre', { ascending:true })
    if (error) throw error
    return data as { progreso_id:string; nombre:string; telefono:string|null }[]
}

export async function guardarLlamada(opts:{
    progresoId:string; semana:1|2|3; dia:'Domingo'|'Martes'|'Virtual';
    resultado:
        | 'no_contesta' | 'no_por_ahora' | 'llamar_de_nuevo' | 'confirmo_asistencia'
        | 'salio_de_viaje' | 'ya_esta_en_ptmd' | 'no_tiene_transporte' | 'vive_fuera'
        | 'murio' | 'rechazado';
    notas?:string
}){
    const { error } = await supabase.rpc('fn_guardar_llamada', {
        p_progreso: opts.progresoId,
        p_semana: opts.semana,
        p_dia: opts.dia,
        p_resultado: opts.resultado,
        p_notas: opts.notas ?? null
    })
    if (error) throw error
}

export async function getAgendados(mod:number, dia:'Domingo'|'Martes'|'Virtual'){
    const { data, error } = await supabase
        .from('v_agendados')
        .select('progreso_id,nombre,telefono,semana')
        .eq('modulo', mod).eq('dia', dia)
        .order('nombre', { ascending:true })
    if (error) throw error
    return data as { progreso_id:string; nombre:string; telefono:string|null; semana:number }[]
}

export async function marcarAsistencia(progresoId:string, asistio:boolean){
    const { error } = await supabase.rpc('fn_marcar_asistencia', {
        p_progreso: progresoId, p_asistio: asistio
    })
    if (error) throw error
}

export async function getPersonaIdDesdeProgreso(progresoId:string){
    const { data, error } = await supabase
        .from('progreso').select('persona_id').eq('id', progresoId).single()
    if (error) throw error
    return data.persona_id as string
}

export async function getObservacionesPersona(personaId:string){
    const { data, error } = await supabase
        .from('v_observaciones_por_persona')
        .select('fecha,notas,fuente')
        .eq('persona_id', personaId)
        .order('fecha', { ascending:false })
    if (error) throw error
    return data as { fecha:string; notas:string; fuente:'registro'|'llamada' }[]
}
