'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function BienvenidaClient({ cedula: cedulaProp }: { cedula?: string }) {
    const search = useSearchParams();
    const router = useRouter();

    // ✅ uso seguro de search params
    const cedula: string = cedulaProp ?? (search?.get('cedula') ?? '');

    const [nombre, setNombre] = useState('');
    const [rol, setRol] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!cedula) {
            router.replace('/login'); // si no hay cédula, vuelve al login
            return;
        }

        const loadData = async () => {
            try {
                // 1) obtener nombre del servidor
                const { data: s, error: sErr } = await supabase
                    .from('servidores')
                    .select('nombre')
                    .eq('cedula', cedula)
                    .eq('activo', true)
                    .maybeSingle();

                if (sErr) throw sErr;
                if (s?.nombre) setNombre(s.nombre);

                // 2) resolver rol
                const { data: r, error: rErr } = await supabase.rpc('fn_resolver_rol', {
                    p_cedula: cedula,
                });
                if (rErr) throw rErr;
                if (r) setRol(r);
            } catch (err: any) {
                setError(err.message ?? 'Error cargando datos');
            } finally {
                setLoading(false);
            }
        };

        void loadData();
    }, [cedula, router]);

    if (loading) {
        return (
            <main className="min-h-screen grid place-items-center bg-gradient-to-br from-gray-50 via-white to-blue-100">
                <div className="bg-white/40 backdrop-blur-xl p-8 rounded-2xl shadow-xl">
                    Cargando…
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen grid place-items-center bg-red-50">
                <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                    <p className="text-red-600 font-semibold">❌ {error}</p>
                    <button
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                        onClick={() => router.replace('/login')}
                    >
                        Volver al login
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-100 overflow-hidden"
              style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,'Helvetica Neue',Arial,sans-serif" }}>
            {/* Efectos de fondo */}
            <div className="pointer-events-none absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full bg-blue-300/40 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 w-[420px] h-[420px] rounded-full bg-purple-300/40 blur-3xl animate-pulse" />

            {/* Tarjeta principal */}
            <div className="relative z-10 w-full max-w-lg bg-white/30 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-2xl p-10 text-center">
                <h1 className="text-3xl font-extrabold text-gray-800">¡Bienvenido!</h1>
                <p className="mt-2 text-xl text-gray-700">{nombre}</p>

                {/* Botones según rol */}
                <div className="mt-8 grid gap-4">
                    {rol === 'contactos' && (
                        <button
                            className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition"
                            onClick={() => router.push(`/login/contactos1`)}
                        >
                            📞 Llamadas pendientes
                        </button>
                    )}

                    {rol === 'maestro' && (
                        <button
                            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 transition"
                            onClick={() => router.push(`/login/maestros`)}
                        >
                            📋 Asistencias de hoy
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
