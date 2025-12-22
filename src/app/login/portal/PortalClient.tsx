'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PremiumLoader from '../../components/PremiumLoader';
import { Fire, Student } from '@phosphor-icons/react';
import Image from 'next/image';

type Asignacion = {
    tipo: 'maestro' | 'contacto' | 'logistica' | 'director' | 'administrador';
    etapa: string;
    dia: string;
    semana?: number;
    franja?: string;
    key: string;
};

// Custom SVG Icons matching the panel
const ContactoIcon = () => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className="text-white drop-shadow-lg">
        <circle cx="12" cy="12" r="6" fillOpacity="0.9" />
    </svg>
);

const MaestroIcon = () => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-600 drop-shadow-md">
        <circle cx="12" cy="6" r="3.5" fillOpacity="0.9" />
        <circle cx="6" cy="16" r="3.5" fillOpacity="0.7" />
        <circle cx="18" cy="16" r="3.5" fillOpacity="0.7" />
        <path d="M12 9.5 V12.5 M9 14 L10.5 11.5 M15 14 L13.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
);

const LogisticaIcon = () => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white drop-shadow-lg">
        <path d="M12 3L3 8L12 13L21 8L12 3Z" fill="currentColor" fillOpacity="0.5" stroke="none" />
        <path d="M3 8V17L12 22V13L3 8Z" fill="currentColor" fillOpacity="0.3" stroke="none" />
        <path d="M21 8V17L12 22V13L21 8Z" fill="currentColor" fillOpacity="0.7" stroke="none" />
        <path d="M12 3L21 8V17L12 22L3 17V8L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 13L3 8" strokeLinecap="round" />
        <path d="M12 13L21 8" strokeLinecap="round" />
        <path d="M12 13V22" strokeLinecap="round" />
    </svg>
);

const DirectorIcon = () => (
    <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'scale(2.8)', pointerEvents: 'none' }}>
            <Image
                src="/consolidacion-biblia.png"
                alt="Consolidación"
                width={150}
                height={150}
                className="object-contain"
                priority
            />
        </div>
    </div>
);

const AdminIcon = () => (
    <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'scale(5.2)', pointerEvents: 'none' }}>
            <Image
                src="/gestor-academico.png"
                alt="Gestor Académico"
                width={150}
                height={150}
                className="object-contain"
                priority
            />
        </div>
    </div>
);

export default function PortalClient({ nombre, asignaciones }: { nombre: string, asignaciones: Asignacion[] }) {
    const router = useRouter();
    const [loadingKey, setLoadingKey] = useState<string | null>(null);

    const handleSelect = async (a: Asignacion) => {
        if (loadingKey) return;
        setLoadingKey(a.key);

        try {
            const res = await fetch('/api/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // IMPORTANTE: Enviar cookies de sesión
                body: JSON.stringify(a)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al conectar');
            }

            const data = await res.json();
            if (data.redirect) {
                router.push(data.redirect);
            }
        } catch (error) {
            console.error(error);
            setLoadingKey(null); // Reset on error so user can retry
            // Opcional: mostrar toast de error
        }
    };

    const getGradient = (type: Asignacion['tipo']) => {
        switch (type) {
            case 'contacto': return 'linear-gradient(135deg, #60A5FA, #2563EB)'; // Blue
            case 'maestro': return 'linear-gradient(135deg, #BFDBFE, #60A5FA)'; // Light Diffused Blue
            case 'logistica': return 'linear-gradient(135deg, #94a3b8, #475569)'; // Steel
            case 'director': return 'linear-gradient(135deg, #fbbf24, #f59e0b)'; // Gold
            case 'administrador': return 'linear-gradient(135deg, #8b5cf6, #6366f1)'; // Purple
            default: return 'linear-gradient(135deg, #ddd, #999)';
        }
    };

    const getDayColor = (dia: string) => {
        const d = dia.toLowerCase();
        if (d.includes('domingo')) return 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 text-emerald-700 ring-1 ring-emerald-200/60';
        if (d.includes('martes')) return 'bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 text-blue-700 ring-1 ring-blue-200/60';
        if (d.includes('virtual')) return 'bg-gradient-to-br from-fuchsia-50 via-pink-50 to-rose-50 text-fuchsia-700 ring-1 ring-fuchsia-200/60';
        return 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 text-slate-700 ring-1 ring-slate-200/60';
    };

    const getTitle = (type: Asignacion['tipo']) => {
        switch (type) {
            case 'contacto': return 'Timoteo';
            case 'maestro': return 'Coordinador';
            case 'logistica': return 'Logística';
            case 'director': return 'Consolidación';
            case 'administrador': return 'Gestor Académico';
        }
    };

    return (
        <main className="min-h-screen relative flex flex-col items-center justify-center p-6 bg-[url('/portal-bg-new.jpg')] bg-cover bg-center bg-no-repeat overflow-hidden">
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />

            <div className="w-full max-w-4xl z-10">
                <header className="mb-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block"
                    >
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3 drop-shadow-lg">
                            Hola, {nombre.split(' ')[0]}
                        </h1>
                        <p className="text-lg text-blue-100/90 font-medium drop-shadow-md">
                            Selecciona tu perfil de acceso
                        </p>
                    </motion.div>
                </header>

                {/* Grid ajustado: hasta 4 columnas, pero flexible */}
                <div className={`grid gap-4 md:gap-5 justify-center ${asignaciones.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' :
                        asignaciones.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' :
                            asignaciones.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    }`}>
                    {asignaciones.map((a, i) => (
                        <motion.button
                            key={a.key}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            whileHover={!loadingKey ? { y: -8, scale: 1.02, transition: { duration: 0.2 } } : {}}
                            whileTap={!loadingKey ? { scale: 0.98 } : {}}
                            onClick={() => handleSelect(a)}
                            disabled={!!loadingKey}
                            className={`relative group flex flex-col items-center rounded-[28px] text-center w-full h-full transition-opacity duration-300 ${asignaciones.length <= 2 ? 'p-8' : 'p-5'
                                } ${loadingKey && loadingKey !== a.key ? 'opacity-50 blur-sm' : ''} ${loadingKey === a.key ? 'cursor-wait' : ''}`}
                            style={{
                                background: 'rgba(255, 255, 255, 0.65)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.8)',
                                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
                            }}
                        >
                            {loadingKey === a.key && (
                                <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/70 backdrop-blur-sm rounded-[32px] transition-all duration-300">
                                    <PremiumLoader text="Iniciando..." />
                                </div>
                            )}

                            {/* Card Content */}
                            <div
                                className={`rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${asignaciones.length <= 2 ? 'w-24 h-24 mb-6' : 'w-16 h-16 mb-4'
                                    }`}
                                style={{
                                    background: (a.tipo === 'administrador' || a.tipo === 'director') ? 'transparent' : getGradient(a.tipo),
                                    boxShadow: (a.tipo === 'administrador' || a.tipo === 'director') ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.15)'
                                }}
                            >
                                {a.tipo === 'contacto' && <ContactoIcon />}
                                {a.tipo === 'maestro' && <MaestroIcon />}
                                {a.tipo === 'logistica' && <LogisticaIcon />}
                                {a.tipo === 'director' && <DirectorIcon />}
                                {a.tipo === 'administrador' && <AdminIcon />}
                            </div>

                            <h3 className={`font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors ${asignaciones.length <= 2 ? 'text-2xl' : 'text-lg'
                                }`}>
                                {getTitle(a.tipo)}
                            </h3>

                            {!['director', 'administrador'].includes(a.tipo) && (
                                <p className={`text-slate-500 font-medium uppercase tracking-wide mb-3 ${asignaciones.length <= 2 ? 'text-sm' : 'text-xs'
                                    }`}>
                                    {a.etapa}
                                </p>
                            )}

                            <div className="mt-auto w-full pt-3 border-t border-slate-200/60">
                                {a.dia && (
                                    <div className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-full font-semibold shadow-sm ${asignaciones.length <= 2 ? 'text-sm' : 'text-xs'
                                        } ${getDayColor(a.dia)}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        {a.dia} {a.franja && `• ${a.franja}`}
                                    </div>
                                )}
                                {!a.dia && (
                                    <div className="text-center py-2 px-4 text-slate-500 text-xs font-medium">
                                        Acceso Administrativo
                                    </div>
                                )}
                            </div>
                        </motion.button>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-16 text-center"
                >
                    <a href="/login" className="inline-flex items-center gap-2 text-blue-100 hover:text-white transition-colors font-medium text-sm px-6 py-3 rounded-full hover:bg-white/10 checkbox-shadow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        Cerrar Sesión
                    </a>
                </motion.div>
            </div>
        </main>
    );
}
