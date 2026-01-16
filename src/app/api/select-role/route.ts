import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getServerSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    const isProd = process.env.NODE_ENV === 'production';
    const secret = process.env.JWT_SECRET;
    const cookieStore = await cookies();
    const tokenName = isProd ? '__Host-session' : 'session';
    const currentToken = cookieStore.get(tokenName)?.value;

    if (!secret || !currentToken) {
        return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    let payload: any;
    try {
        payload = jwt.verify(currentToken, secret);
    } catch {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }

    const { cedula, servidorId, asignaciones } = payload;
    if (!cedula || !servidorId) {
        return NextResponse.json({ error: 'Datos de sesión incompletos' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { tipo, key } = body; // tipo: 'contacto' | 'maestro' | 'logistica'
        console.log('--- SELECT ROLE DEBUG ---');
        console.log('Body:', body);

        const supabase = getServerSupabase();
        // IMPORTANTE: Preservar 'asignaciones' para que el LogoutButton sepa que hay más roles
        let newPayload: any = { cedula, servidorId, rol: tipo, asignaciones };
        let redirectUrl = '';

        // VERIFICACIÓN ESTRICTA EN BD (Surgical approach: trust but verify)
        if (tipo === 'contacto') {
            const { data, error } = await supabase
                .from('asignaciones_contacto')
                .select('etapa, dia, semana')
                .eq('servidor_id', servidorId)
                .eq('vigente', true)
                // Es posible que tenga múltiples contactos, necesitamos encontrar el correcto si pasamos más datos
                // Pero por ahora asumimos que el Portal filtró correctamente. 
                // Para ser más estrictos, deberíamos recibir 'etapa' y 'dia' del body para matchear exacto.
                .match({ etapa: body.etapa, dia: body.dia, semana: body.semana })
                .maybeSingle();

            if (error || !data) throw new Error('Rol no encontrado o no vigente');

            newPayload = { ...newPayload, etapa: data.etapa, dia: data.dia, semana: data.semana };
            redirectUrl = `/login/contactos1?etapa=${encodeURIComponent(data.etapa)}&dia=${encodeURIComponent(data.dia)}&semana=${data.semana}`;

        } else if (tipo === 'maestro') {
            const { data, error } = await supabase
                .from('asignaciones_maestro')
                .select('etapa, dia')
                .eq('servidor_id', servidorId)
                .eq('vigente', true)
                .match({ etapa: body.etapa, dia: body.dia })
                .maybeSingle();

            console.log('Maestro Query Result:', { data, error });

            if (error || !data) throw new Error('Rol no encontrado o no vigente');

            newPayload = { ...newPayload, etapa: data.etapa, dia: data.dia };
            redirectUrl = `/login/maestros?etapa=${encodeURIComponent(data.etapa)}&dia=${encodeURIComponent(data.dia)}`;

        } else if (tipo === 'logistica') {
            // Validación relajada para Logística como hicimos en el login
            const { data, error } = await supabase
                .from('asignaciones_logistica')
                .select('dia:dia_culto, franja') // Alias
                .eq('servidor_id', servidorId)
                .eq('vigente', true)
                .match({ dia_culto: body.dia, franja: body.franja }) // Match uses database column name
                .maybeSingle();

            if (error || !data) throw new Error('Rol no encontrado o no vigente');

            newPayload = { ...newPayload, dia: data.dia, franja: data.franja };
            redirectUrl = `/login/logistica?dia=${encodeURIComponent(data.dia)}`;

        } else if (tipo === 'director' || tipo === 'administrador') {
            // Verificar que el servidor tiene el rol administrativo vigente

            const { data, error } = await supabase
                .from('servidores_roles')
                .select('rol')
                .eq('servidor_id', servidorId)
                .eq('vigente', true)
                .eq('rol', body.etapa) // body.etapa contiene 'Director' o 'Administrador'
                .maybeSingle();


            if (error || !data) {
                throw new Error('Rol administrativo no encontrado o no vigente');
            }

            // IMPORTANTE: Usar 'rol' (no 'area') para que el middleware lo acepte
            newPayload = { ...newPayload, rol: data.rol };

            // Redirigir según el rol específico
            if (data.rol === 'Director') {
                redirectUrl = '/panel';
            } else if (data.rol === 'Administrador') {
                redirectUrl = '/admin';
            } else {
                redirectUrl = '/panel/admin'; // Fallback
            }


        } else {
            throw new Error('Tipo de rol no válido');
        }

        // Generar NUEVO token específico
        const newToken = jwt.sign(newPayload, secret, { expiresIn: '8h' });

        // Establecer nueva cookie (Sobrescribe la del portal)
        const res = NextResponse.json({ redirect: redirectUrl });
        res.cookies.set(tokenName, newToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8
        });

        return res;

    } catch (e: any) {
        console.error('Error switching role:', e.message);
        return NextResponse.json({ error: e.message || 'Error al cambiar de rol' }, { status: 400 });
    }
}
