'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PremiumLoader from '../../components/PremiumLoader';
import { Fire, Student } from '@phosphor-icons/react';
import Image from 'next/image';

type Asignacion = {
    tipo: 'maestro' | 'contacto' | 'logistica' | 'director' | 'administrador' | 'estudiante_ptm';
    etapa: string;
    dia: string;
    semana?: number;
    franja?: string;
    cursos?: string[];
    key: string;
};

// Custom SVG Icons matching the panel
const ContactoIcon = ({ variant }: { variant?: 'martes' | 'virtual' | 'default' }) => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className={`${variant === 'virtual' ? 'text-fuchsia-400' :
        variant === 'martes' ? 'text-sky-400' : 'text-white'
        } drop-shadow-lg transition-colors duration-500`}>
        <circle cx="12" cy="12" r="6" fillOpacity="0.9" />
    </svg>
);

const MaestroIcon = ({ variant }: { variant?: 'martes' | 'virtual' | 'default' }) => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className={`${variant === 'virtual' ? 'text-fuchsia-400' :
        variant === 'martes' ? 'text-sky-400' : 'text-indigo-600'
        } drop-shadow-md transition-colors duration-500`}>
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
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'scale(6.2)', pointerEvents: 'none' }}>
            <Image
                src="/gestor-academico.png"
                alt="Gestor Académico"
                width={800}
                height={800}
                className="object-contain"
                priority
            />
        </div>
    </div>
);



const EstudianteIcon = () => (
    <div className="relative w-24 h-24 flex items-center justify-center">
        <Student size={64} weight="duotone" className="text-emerald-400 drop-shadow-md" />
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
                credentials: 'include',
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
            setLoadingKey(null);
        }
    };

    const getTitle = (type: Asignacion['tipo']) => {
        switch (type) {
            case 'contacto': return 'Timoteo';
            case 'maestro': return 'Coordinador';
            case 'logistica': return 'Logística';
            case 'director': return 'Consolidación';

            case 'administrador': return 'Gestor Académico';
            case 'estudiante_ptm': return 'Maestro';
        }
    };

    return (
        <main
            className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden"
            style={{
                background: 'radial-gradient(circle at 50% 0%, #1e40af 0%, #0f172a 50%, #020617 100%)', // Cleaner Cosmic Blue -> Dark
                backgroundColor: '#020617'
            }}
        >
            {/* Top Light Source - Stronger Glow */}
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

            <div className="w-full max-w-4xl z-10 relative">
                <header className="mb-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3 drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]">
                            Hola, {nombre.split(' ')[0]}
                        </h1>
                        <p className="text-lg text-blue-100/80 font-medium tracking-wide drop-shadow-md">
                            Selecciona tu perfil de acceso
                        </p>
                    </motion.div>
                </header>

                <div className={`grid gap-8 justify-center ${asignaciones.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' :
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
                            whileHover={!loadingKey ? { y: -8, scale: 1.02 } : {}}
                            whileTap={!loadingKey ? { scale: 0.98 } : {}}
                            onClick={() => handleSelect(a)}
                            disabled={!!loadingKey}
                            className={`relative group flex flex-col items-center rounded-[32px] text-center w-full h-full transition-all duration-300 ${asignaciones.length <= 2 ? 'px-8 py-8' : 'p-5'
                                } ${loadingKey && loadingKey !== a.key ? 'opacity-50 blur-sm' : ''} ${loadingKey === a.key ? 'cursor-wait' : ''}`}
                            style={{
                                // Ultra Glass Effect - Cleaner with Glowing Edges
                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.0) 100%)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                borderTop: '1px solid rgba(255, 255, 255, 0.5)', // Brighter top
                                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                // Outer Blue Glow + Inner White highlight
                                boxShadow: '0 0 15px rgba(59, 130, 246, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 0 20px rgba(59, 130, 246, 0.2)',
                            }}
                        >
                            {/* Card Inner Glow Hover Effect */}
                            <div className="absolute inset-0 rounded-[40px] bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                            {loadingKey === a.key && (
                                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-md rounded-[40px]">
                                    <PremiumLoader text="Conectando..." />
                                </div>
                            )}

                            {/* Floating Icon Container */}
                            <div className="relative mb-4 p-2">
                                {/* Glow behind icon */}
                                {(() => {
                                    const diaLower = a.dia.toLowerCase();
                                    const variant = diaLower.includes('virtual') ? 'virtual' : diaLower.includes('martes') ? 'martes' : 'default';
                                    const isCoordOrTim = ['contacto', 'maestro'].includes(a.tipo);

                                    return (
                                        <>
                                            <div className={`absolute inset-0 blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-all duration-500 ${isCoordOrTim && variant === 'virtual' ? 'bg-fuchsia-500/40' :
                                                isCoordOrTim && variant === 'martes' ? 'bg-sky-500/40' :
                                                    'bg-blue-500/30'
                                                }`} />

                                            <div className="relative z-10 transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-2 drop-shadow-2xl">
                                                {a.tipo === 'contacto' && <ContactoIcon variant={variant} />}
                                                {a.tipo === 'maestro' && <MaestroIcon variant={variant} />}
                                                {a.tipo === 'logistica' && <LogisticaIcon />}
                                                {a.tipo === 'director' && <DirectorIcon />}

                                                {a.tipo === 'administrador' && <AdminIcon />}
                                                {a.tipo === 'estudiante_ptm' && <EstudianteIcon />}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <h3 className="font-bold text-white text-3xl mb-2 tracking-tight drop-shadow-lg group-hover:text-blue-100 transition-colors">
                                {getTitle(a.tipo)}
                            </h3>

                            {!['director', 'administrador'].includes(a.tipo) && (
                                <p className="text-blue-100/90 font-medium tracking-wide mb-4 uppercase text-sm drop-shadow-sm">
                                    {a.etapa}
                                </p>
                            )}

                            {a.tipo === 'administrador' && a.cursos && a.cursos.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-2 mb-4 max-w-[200px]">
                                    {a.cursos.map((curso, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-lg text-xs font-medium text-blue-100 backdrop-blur-sm">
                                            {curso}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="mt-auto pt-4 border-t border-white/10 w-full">
                                {!a.dia ? (
                                    <span className="text-blue-100/50 text-xs font-bold tracking-[0.2em] uppercase">
                                        Acceso Administrativo
                                    </span>
                                ) : (
                                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md ${a.tipo === 'estudiante_ptm'
                                        ? 'bg-emerald-500/10 border-emerald-500/20'
                                        : a.dia.toLowerCase().includes('todos')
                                            ? 'bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border-amber-400/40'
                                            : a.dia.toLowerCase().includes('domingo')
                                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                                : a.dia.toLowerCase().includes('martes')
                                                    ? 'bg-sky-500/10 border-sky-500/20'
                                                    : a.dia.toLowerCase().includes('virtual')
                                                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30'
                                                        : 'bg-white/5 border-white/10'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentcolor] ${a.tipo === 'estudiante_ptm'
                                            ? 'bg-emerald-400 text-emerald-400'
                                            : a.dia.toLowerCase().includes('todos')
                                                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-400'
                                                : a.dia.toLowerCase().includes('domingo')
                                                    ? 'bg-emerald-400 text-emerald-400'
                                                    : a.dia.toLowerCase().includes('martes')
                                                        ? 'bg-sky-400 text-sky-400'
                                                        : a.dia.toLowerCase().includes('virtual')
                                                            ? 'bg-fuchsia-400 text-fuchsia-400'
                                                            : 'bg-slate-400 text-slate-400'
                                            }`} />
                                        <span className={`text-xs font-semibold tracking-wide ${a.tipo === 'estudiante_ptm'
                                            ? 'text-emerald-100'
                                            : a.dia.toLowerCase().includes('todos')
                                                ? 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                                                : 'text-white'
                                            }`}>
                                            {a.dia} {a.franja && `• ${a.franja}`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </motion.button>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-8 text-center"
                >
                    <a href="/login" className="relative group inline-flex items-center gap-3 px-8 py-3 rounded-full overflow-hidden transition-all">
                        {/* Button Glow */}
                        <div className="absolute inset-0 bg-white/5 border border-white/20 rounded-full group-hover:bg-white/10 group-hover:border-white/40 transition-all duration-300" />
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-200 group-hover:text-white transition-colors relative z-10"><path d="M15 18l-6-6 6-6" /></svg>
                        <span className="text-blue-100 font-semibold tracking-wide group-hover:text-white transition-colors relative z-10 text-sm">Cerrar Sesión</span>
                    </a>
                </motion.div>
            </div>
        </main>
    );
}
