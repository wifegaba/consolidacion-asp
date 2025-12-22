import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';
import PortalClient from './PortalClient';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === 'production';
    const tokenName = isProd ? '__Host-session' : 'session';
    const token = cookieStore.get(tokenName)?.value;

    if (!token || !process.env.JWT_SECRET) {
        redirect('/login');
    }

    let payload: any;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        redirect('/login');
    }

    const { servidorId, nombre: nombreToken, asignaciones: asignacionesToken } = payload;
    if (!servidorId) redirect('/login');

    let nombre = nombreToken || 'Servidor';
    let asignaciones: any[] = [];

    // OPTIMIZACIÓN: Si el token ya tiene las asignaciones, las usamos directamente
    // Esto evita 5 consultas a la base de datos, reduciendo el tiempo de carga ~80%
    if (asignacionesToken && Array.isArray(asignacionesToken) && asignacionesToken.length > 0) {
        // Transformar a la estructura esperada con keys
        asignaciones = asignacionesToken.map((a: any) => {
            const key = a.tipo === 'contacto' ? `c-${a.etapa}-${a.dia}-${a.semana}` :
                a.tipo === 'maestro' ? `m-${a.etapa}-${a.dia}` :
                    a.tipo === 'logistica' ? `l-${a.franja}-${a.dia}` :
                        `r-${a.etapa}`;

            return {
                ...a,
                tipo: a.tipo as 'contacto' | 'maestro' | 'logistica' | 'director' | 'administrador',
                etapa: a.etapa || 'Logística',
                dia: a.dia || '',
                key
            };
        });
    } else {
        // FALLBACK: Si el token no tiene asignaciones (login antiguo), consultamos BD
        const supabase = getServerSupabase();

        const [contactosRes, maestrosRes, logisticaRes, rolesRes, servidorRes] = await Promise.all([
            supabase
                .from('asignaciones_contacto')
                .select('etapa, dia, semana')
                .eq('servidor_id', servidorId)
                .eq('vigente', true),
            supabase
                .from('asignaciones_maestro')
                .select('etapa, dia')
                .eq('servidor_id', servidorId)
                .eq('vigente', true),
            supabase
                .from('asignaciones_logistica')
                .select('dia:dia_culto, franja')
                .eq('servidor_id', servidorId)
                .eq('vigente', true),
            supabase
                .from('servidores_roles')
                .select('rol')
                .eq('servidor_id', servidorId)
                .eq('vigente', true)
                .in('rol', ['Director', 'Administrador']),
            supabase
                .from('servidores')
                .select('nombre')
                .eq('id', servidorId)
                .single()
        ]);

        const contactos = contactosRes.data || [];
        const maestros = maestrosRes.data || [];
        const logistica = logisticaRes.data || [];
        const roles = rolesRes.data || [];
        nombre = servidorRes.data?.nombre || 'Servidor';

        asignaciones = [
            ...contactos.map((c: any) => ({
                tipo: 'contacto' as const,
                etapa: c.etapa,
                dia: c.dia,
                semana: c.semana,
                key: `c-${c.etapa}-${c.dia}-${c.semana}`
            })),
            ...maestros.map((m: any) => ({
                tipo: 'maestro' as const,
                etapa: m.etapa,
                dia: m.dia,
                key: `m-${m.etapa}-${m.dia}`
            })),
            ...logistica.map((l: any) => ({
                tipo: 'logistica' as const,
                etapa: 'Logística',
                dia: l.dia,
                franja: l.franja,
                key: `l-${l.franja}-${l.dia}`
            })),
            ...roles.map((r: any) => ({
                tipo: r.rol.toLowerCase() as 'director' | 'administrador',
                etapa: r.rol,
                dia: '',
                key: `r-${r.rol}`
            }))
        ];
    }

    if (asignaciones.length === 0) {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-slate-800">Sin asignaciones vigentes</h1>
                    <p className="text-slate-600 mt-2">No se encontraron roles activos para tu usuario.</p>
                    <a href="/login" className="mt-4 inline-block text-sky-600 hover:underline">Volver al inicio</a>
                </div>
            </div>
        );
    }

    // If only 1 assignment, redirect automatically (failsafe)
    if (asignaciones.length === 1) {
        const a: any = asignaciones[0];
        if (a.tipo === 'contacto') {
            redirect(`/login/contactos1?etapa=${encodeURIComponent(a.etapa)}&dia=${encodeURIComponent(a.dia)}&semana=${a.semana}`);
        } else if (a.tipo === 'maestro') {
            redirect(`/login/maestros?etapa=${encodeURIComponent(a.etapa)}&dia=${encodeURIComponent(a.dia)}`);
        } else if (a.tipo === 'logistica') {
            redirect(`/login/logistica?dia=${encodeURIComponent(a.dia)}`);
        } else if (a.tipo === 'director') {
            redirect('/panel');
        } else if (a.tipo === 'administrador') {
            redirect('/admin');
        }
    }

    return (
        <PortalClient
            nombre={nombre}
            asignaciones={asignaciones}
        />
    );
}
