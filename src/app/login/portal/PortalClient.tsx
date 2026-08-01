'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumLoader from '../../components/PremiumLoader';
import { Fire, Student } from '@phosphor-icons/react';
import Image from 'next/image';

type Asignacion = {
    tipo: 'maestro' | 'contacto' | 'logistica' | 'director' | 'administrador' | 'estudiante_ptm' | 'kids_hub';
    etapa: string;
    dia: string;
    semana?: number;
    franja?: string;
    cursos?: string[];
    key: string;
};

type RoleFocusPhase = 'idle' | 'expanding' | 'open' | 'returning';

type RoleFocusGeometry = {
    fromX: number;
    fromY: number;
    scaleX: number;
    scaleY: number;
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
        variant === 'martes' ? 'text-sky-300' : 'text-sky-100'
        } drop-shadow-[0_0_14px_rgba(191,219,254,.72)] transition-colors duration-500`}>
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
        <div className="absolute inset-2 rounded-full bg-white/15 blur-xl" />
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'scale(6.2)', pointerEvents: 'none' }}>
            <Image
                src="/gestor-academico.png"
                alt="Gestor Académico"
                width={800}
                height={800}
                className="object-contain brightness-0 invert drop-shadow-[0_0_12px_rgba(255,255,255,.82)]"
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

const KidsIcon = () => (
    <div className="relative w-24 h-24 flex items-center justify-center">
        <svg width="68" height="68" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 14px rgba(13,148,136,0.7))' }}>
            {/* Star shape */}
            <path d="M12 2L14.4 8.26L21 9.27L16.5 13.64L17.76 20.29L12 17.27L6.24 20.29L7.5 13.64L3 9.27L9.6 8.26L12 2Z" fill="url(#kids-grad)" fillOpacity="0.95" />
            {/* Inner glow circle */}
            <circle cx="12" cy="12" r="3.5" fill="white" fillOpacity="0.25" />
            <defs>
                <linearGradient id="kids-grad" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0d9488" />
                    <stop offset="1" stopColor="#0891b2" />
                </linearGradient>
            </defs>
        </svg>
        {/* "Kids." text badge */}
        <div style={{
            position: 'absolute', bottom: 6, right: 2,
            background: 'rgba(13,148,136,0.25)',
            border: '1px solid rgba(13,148,136,0.5)',
            borderRadius: 8, padding: '1px 7px',
            fontSize: 10, fontWeight: 800, color: '#5eead4',
            letterSpacing: 1, backdropFilter: 'blur(6px)',
        }}>
            Kids.
        </div>
    </div>
);

const KidsCoordinadorIcon = ({ etapa }: { etapa: string }) => (
    <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Outer ring glow */}
        <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(192,132,252,0.35) 0%, transparent 70%)',
            filter: 'blur(8px)',
        }} />
        {/* Icon */}
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
            style={{ filter: 'drop-shadow(0 0 12px rgba(192,132,252,0.8))' }}>
            <defs>
                <linearGradient id="coord-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f9a8d4" />
                    <stop offset="0.5" stopColor="#c084fc" />
                    <stop offset="1" stopColor="#818cf8" />
                </linearGradient>
            </defs>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                stroke="url(#coord-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="9" cy="7" r="4"
                stroke="url(#coord-grad)" strokeWidth="2" fill="none"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"
                stroke="url(#coord-grad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"
                stroke="url(#coord-grad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
        {/* Group badge */}
        <div style={{
            position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(192,132,252,0.25)',
            border: '1px solid rgba(192,132,252,0.55)',
            borderRadius: 8, padding: '1px 8px',
            fontSize: 9, fontWeight: 800, color: '#e9d5ff',
            letterSpacing: 0.8, backdropFilter: 'blur(6px)',
            whiteSpace: 'nowrap',
        }}>
            {etapa}
        </div>
    </div>
);

export default function PortalClient({ nombre, asignaciones }: { nombre: string, asignaciones: Asignacion[] }) {
    const router = useRouter();
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [focusedRole, setFocusedRole] = useState<Asignacion | null>(null);
    const [focusPhase, setFocusPhase] = useState<RoleFocusPhase>('idle');
    const [focusGeometry, setFocusGeometry] = useState<RoleFocusGeometry | null>(null);

    useEffect(() => {
        const ensurePortalFullscreen = () => {
            if (document.hidden || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
            void document.documentElement.requestFullscreen().catch(() => {
                // Algunos navegadores requieren un gesto del usuario; el
                // listener pointerdown lo reintentará en el siguiente clic.
            });
        };

        const onVisibilityChange = () => {
            if (!document.hidden) ensurePortalFullscreen();
        };

        ensurePortalFullscreen();
        document.addEventListener('fullscreenchange', ensurePortalFullscreen);
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pageshow', ensurePortalFullscreen);
        window.addEventListener('pointerdown', ensurePortalFullscreen, { passive: true });

        return () => {
            document.removeEventListener('fullscreenchange', ensurePortalFullscreen);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('pageshow', ensurePortalFullscreen);
            window.removeEventListener('pointerdown', ensurePortalFullscreen);
        };
    }, []);

    useEffect(() => {
        const returningKey = window.sessionStorage.getItem('portal-return-key')
            ?? new URLSearchParams(window.location.search).get('return');
        if (!returningKey) return;
        window.sessionStorage.removeItem('portal-return-key');

        const returningRole = asignaciones.find((role) =>
            role.key === returningKey || (returningKey.endsWith('-') && role.key.startsWith(returningKey)),
        );
        if (!returningRole) return;

        const frame = window.requestAnimationFrame(() => {
            const source = document.querySelector<HTMLElement>(`[data-role-key="${returningRole.key}"]`);
            if (!source) return;
            const sourceRect = source.getBoundingClientRect();
            const inset = window.innerWidth < 640 ? 12 : 24;
            const targetWidth = window.innerWidth - inset * 2;
            const targetHeight = window.innerHeight - inset * 2;

            setFocusedRole(returningRole);
            setFocusGeometry({
                fromX: sourceRect.left - inset,
                fromY: sourceRect.top - inset,
                scaleX: sourceRect.width / targetWidth,
                scaleY: sourceRect.height / targetHeight,
            });
            setFocusPhase('returning');
            window.setTimeout(() => {
                setFocusPhase('idle');
                setFocusedRole(null);
                setFocusGeometry(null);
            }, 620);
        });

        return () => window.cancelAnimationFrame(frame);
    }, [asignaciones]);

    const handleSelect = async (a: Asignacion) => {
        if (loadingKey) return;
        setLoadingKey(a.key);

        try {
            // ── Entrada principal Kids: crea el centro de roles interno ──────────────
            if (a.tipo === 'kids_hub') {
                const res = await fetch('/api/kids/equipo/portal-login', {
                    method: 'POST',
                    credentials: 'include',
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al acceder al equipo Kids');
                if (data.redirect) router.push(data.redirect);
                return;
            }

            // ── Resto de roles — flujo normal ─────────────────────────────────────────
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
            setFocusPhase('idle');
            setFocusedRole(null);
            setFocusGeometry(null);
        }
    };

    const getTitle = (type: Asignacion['tipo']) => {
        switch (type) {
            case 'contacto':          return 'Timoteo';
            case 'maestro':           return 'Coordinador';
            case 'logistica':         return 'Logística';
            case 'director':          return 'Consolidación';
            case 'administrador':     return 'Gestor Académico';
            case 'estudiante_ptm':    return 'Maestro';
            case 'kids_hub':          return 'Kids';
        }
    };

    const openRolePreview = (role: Asignacion, source: HTMLElement) => {
        if (focusPhase !== 'idle' || loadingKey) return;
        const sourceRect = source.getBoundingClientRect();
        const inset = window.innerWidth < 640 ? 12 : 24;
        const targetWidth = window.innerWidth - inset * 2;
        const targetHeight = window.innerHeight - inset * 2;

        setFocusedRole(role);
        setFocusGeometry({
            fromX: sourceRect.left - inset,
            fromY: sourceRect.top - inset,
            scaleX: sourceRect.width / targetWidth,
            scaleY: sourceRect.height / targetHeight,
        });
        setFocusPhase('expanding');
        window.setTimeout(() => {
            setFocusPhase('open');
            void handleSelect(role);
        }, 720);
    };

    return (
        <main
            className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden"
            style={{
                background: [
                    'radial-gradient(ellipse 64% 52% at 20% -10%, rgba(190, 224, 255, 0.70) 0%, rgba(118, 184, 255, 0.29) 42%, transparent 74%)',
                    'radial-gradient(ellipse 58% 48% at 92% 16%, rgba(223, 211, 255, 0.58) 0%, rgba(161, 130, 255, 0.20) 45%, transparent 74%)',
                    'radial-gradient(ellipse 50% 42% at 50% 104%, rgba(66, 183, 204, 0.20) 0%, transparent 72%)',
                    'linear-gradient(145deg, #18346f 0%, #0d1e4b 45%, #050b1d 100%)',
                ].join(', '),
            }}
        >
            {/* Luces ambientales suaves, inspiradas en el acabado de vidrio de Apple. */}
            <div className="absolute top-[-16%] left-[8%] h-[520px] w-[520px] rounded-full bg-sky-100/30 blur-[130px] pointer-events-none" />
            <div className="absolute top-[-8%] right-[-10%] h-[500px] w-[500px] rounded-full bg-violet-100/25 blur-[145px] pointer-events-none" />
            <div className="absolute bottom-[-25%] left-[28%] h-[460px] w-[700px] rounded-full bg-cyan-300/10 blur-[150px] pointer-events-none" />
            <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.16),transparent_34%)]" />

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
                            onClick={(event) => openRolePreview(a, event.currentTarget)}
                            disabled={!!loadingKey || focusPhase !== 'idle'}
                            data-role-key={a.key}
                            className={`lgx-content-card lgx-content-card--deep relative group flex flex-col items-center overflow-hidden rounded-[32px] text-center w-full h-full transition-all duration-300 ${asignaciones.length <= 2 ? 'px-8 py-8' : 'p-5'
                                } ${loadingKey && loadingKey !== a.key ? 'opacity-50 blur-sm' : ''} ${loadingKey === a.key ? 'cursor-wait' : ''} ${focusedRole?.key === a.key ? 'opacity-0 pointer-events-none' : ''}`}
                            style={{
                                '--lgx-card-tone': a.tipo === 'administrador' ? '#8b5cf6' : '#2563eb',
                            } as React.CSSProperties}
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
                                                {a.tipo === 'kids_hub' && <KidsIcon />}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <h3 className="font-bold text-white text-3xl mb-2 tracking-tight drop-shadow-lg group-hover:text-blue-100 transition-colors">
                                {getTitle(a.tipo)}
                            </h3>

                            {!['director', 'administrador', 'kids_hub'].includes(a.tipo) && (
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
                                {a.tipo === 'kids_hub' ? (
                                    <span className="text-xs font-bold tracking-[0.2em] uppercase"
                                        style={{ color: '#5eead4' }}>
                                        Módulo Kids Ministry
                                    </span>
                                ) : !a.dia ? (
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
                    <a
                        href="/login"
                        className="lgx-content-card lgx-content-card--deep relative group inline-flex items-center gap-3 px-8 py-3 rounded-full overflow-hidden transition-all"
                        style={{ '--lgx-card-tone': '#2563eb' } as React.CSSProperties}
                    >
                        {/* Button Glow */}
                        <div className="absolute inset-0 bg-white/5 border border-white/20 rounded-full group-hover:bg-white/10 group-hover:border-white/40 transition-all duration-300" />
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-200 group-hover:text-white transition-colors relative z-10"><path d="M15 18l-6-6 6-6" /></svg>
                        <span className="text-blue-100 font-semibold tracking-wide group-hover:text-white transition-colors relative z-10 text-sm">Cerrar Sesión</span>
                    </a>
                </motion.div>
            </div>

            {focusedRole && focusGeometry && (
                <>
                    {focusPhase !== 'returning' && (
                        <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm" />
                    )}
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Vista previa de ${getTitle(focusedRole.tipo)}`}
                        className={`lgx-content-card lgx-content-card--deep fixed z-50 flex flex-col items-center justify-center overflow-hidden rounded-[32px] px-8 text-center text-white ${
                            focusPhase === 'expanding'
                                ? 'portal-role-focus--expanding'
                                : focusPhase === 'returning'
                                    ? 'portal-role-focus--returning pointer-events-none'
                                    : 'portal-role-focus--open'
                        }`}
                        style={{
                            left: 24,
                            top: 24,
                            width: 'calc(100vw - 48px)',
                            height: 'calc(100vh - 48px)',
                            '--lgx-card-tone': focusedRole.tipo === 'administrador' ? '#8b5cf6' : '#2563eb',
                            '--portal-from-x': `${focusGeometry.fromX}px`,
                            '--portal-from-y': `${focusGeometry.fromY}px`,
                            '--portal-scale-x': focusGeometry.scaleX,
                            '--portal-scale-y': focusGeometry.scaleY,
                        } as React.CSSProperties}
                    >
                        <div className={`max-w-md transition-all duration-300 ${focusPhase === 'open' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <p className="text-xs font-bold uppercase tracking-[.24em] text-sky-100/80">Perfil de acceso</p>
                            <h2 className="mt-3 text-4xl font-bold tracking-tight">{getTitle(focusedRole.tipo)}</h2>
                            <p className="mt-3 text-base text-white/80">
                                {focusedRole.etapa} · {focusedRole.dia}
                            </p>
                            <p className="mt-8 text-sm font-semibold text-white/80">Abriendo panel…</p>
                        </div>
                    </section>
                </>
            )}
            <style>{`
                @keyframes portalRoleExpand {
                    from { transform: translate3d(var(--portal-from-x), var(--portal-from-y), 0) scale(var(--portal-scale-x), var(--portal-scale-y)); }
                    to { transform: translate3d(0, 0, 0) scale(1); }
                }
                @keyframes portalRoleCollapse {
                    from { transform: translate3d(0, 0, 0) scale(1); }
                    to { transform: translate3d(var(--portal-from-x), var(--portal-from-y), 0) scale(var(--portal-scale-x), var(--portal-scale-y)); }
                }
                .portal-role-focus--expanding { animation: portalRoleExpand .72s cubic-bezier(.22,.72,.18,1) both; transform-origin: top left; }
                .portal-role-focus--open { transform: translate3d(0, 0, 0) scale(1); transform-origin: top left; }
                .portal-role-focus--returning { animation: portalRoleCollapse .62s cubic-bezier(.4,0,.24,1) both; transform-origin: top left; }
                @media (max-width: 639px) {
                    .portal-role-focus--expanding, .portal-role-focus--open, .portal-role-focus--returning { left: 12px !important; top: 12px !important; width: calc(100vw - 24px) !important; height: calc(100vh - 24px) !important; }
                }
            `}</style>
        </main>
    );
}
