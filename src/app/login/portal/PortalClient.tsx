'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import PremiumLoader from '../../components/PremiumLoader';
import { Student } from '@phosphor-icons/react';
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

type StageModalGeometry = RoleFocusGeometry & {
    left: number;
    top: number;
    width: number;
    height: number;
};

type RolePalette = {
    tone: string;
    surface: string;
    glow: string;
    badgeBackground: string;
    badgeBorder: string;
    badgeText: string;
};

type StageName = 'Semillas' | 'Devocionales' | 'Restauración';

type StagePalette = RolePalette & {
    modalSurface: string;
    modalFusion: string;
};

type StageGroup = {
    name: StageName;
    assignments: Asignacion[];
};

const STAGE_ORDER: StageName[] = ['Semillas', 'Devocionales', 'Restauración'];

const STAGE_PALETTES: Record<StageName, StagePalette> = {
    Semillas: {
        tone: '#4CC9A6',
        surface: 'linear-gradient(145deg,rgba(100,221,191,.94),rgba(45,172,150,.84) 58%,rgba(18,111,110,.88))',
        glow: 'rgba(76,201,166,.42)',
        badgeBackground: 'rgba(222,255,245,.17)', badgeBorder: 'rgba(222,255,245,.42)', badgeText: '#effff9',
        modalSurface: 'radial-gradient(72% 58% at 4% 0%,rgba(255,255,255,.98),transparent 66%),linear-gradient(145deg,#fbfcfe 0%,#eef2f7 100%)',
        modalFusion: 'linear-gradient(145deg,rgba(100,221,191,.96),rgba(45,172,150,.92) 58%,rgba(18,111,110,.94))',
    },
    Devocionales: {
        tone: '#294E86',
        surface: 'linear-gradient(145deg,rgba(79,119,179,.94),rgba(41,78,134,.87) 58%,rgba(20,47,91,.9))',
        glow: 'rgba(41,78,134,.46)',
        badgeBackground: 'rgba(222,235,255,.16)', badgeBorder: 'rgba(222,235,255,.4)', badgeText: '#f3f7ff',
        modalSurface: 'radial-gradient(72% 58% at 4% 0%,rgba(255,255,255,.98),transparent 66%),linear-gradient(145deg,#fbfcfe 0%,#eef2f7 100%)',
        modalFusion: 'linear-gradient(145deg,rgba(79,119,179,.96),rgba(41,78,134,.94) 58%,rgba(20,47,91,.96))',
    },
    'Restauración': {
        tone: '#E85D75',
        surface: 'linear-gradient(145deg,rgba(244,141,159,.94),rgba(232,93,117,.88) 58%,rgba(174,57,82,.9))',
        glow: 'rgba(232,93,117,.42)',
        badgeBackground: 'rgba(255,228,234,.16)', badgeBorder: 'rgba(255,228,234,.4)', badgeText: '#fff5f7',
        modalSurface: 'radial-gradient(72% 58% at 4% 0%,rgba(255,255,255,.98),transparent 66%),linear-gradient(145deg,#fbfcfe 0%,#eef2f7 100%)',
        modalFusion: 'linear-gradient(145deg,rgba(244,141,159,.96),rgba(232,93,117,.94) 58%,rgba(174,57,82,.96))',
    },
};

const getStageName = (etapa: string): StageName | null => {
    const normalized = etapa.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (normalized.startsWith('semilla')) return 'Semillas';
    if (normalized.startsWith('devocional')) return 'Devocionales';
    if (normalized.startsWith('restauracion')) return 'Restauración';
    return null;
};

const getStageLevels = (assignments: Asignacion[]) => Array.from(new Set(
    assignments.map((assignment) => assignment.etapa.match(/\d+/)?.[0]).filter((level): level is string => Boolean(level)),
)).sort((a, b) => Number(a) - Number(b));

const getRoleTitle = (type: Asignacion['tipo']) => {
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

const ROLE_PALETTES: Record<Asignacion['tipo'], RolePalette> = {
    director: {
        tone: '#70b7ff',
        surface: 'linear-gradient(145deg,rgba(91,166,244,.76),rgba(48,105,196,.67) 58%,rgba(24,65,137,.72))',
        glow: 'rgba(115,190,255,.42)',
        badgeBackground: 'rgba(208,235,255,.15)', badgeBorder: 'rgba(211,238,255,.38)', badgeText: '#e7f5ff',
    },
    administrador: {
        tone: '#ffab87',
        surface: 'linear-gradient(145deg,rgba(245,161,124,.78),rgba(219,100,104,.67) 58%,rgba(157,66,91,.72))',
        glow: 'rgba(255,173,132,.40)',
        badgeBackground: 'rgba(255,228,207,.14)', badgeBorder: 'rgba(255,225,204,.38)', badgeText: '#fff2e8',
    },
    kids_hub: {
        tone: '#63ddca',
        surface: 'linear-gradient(145deg,rgba(54,178,172,.76),rgba(25,131,146,.68) 58%,rgba(15,80,111,.74))',
        glow: 'rgba(90,224,208,.40)',
        badgeBackground: 'rgba(188,255,241,.13)', badgeBorder: 'rgba(186,255,239,.36)', badgeText: '#d9fff7',
    },
    contacto: {
        tone: '#ff9faf',
        surface: 'linear-gradient(145deg,rgba(240,137,158,.76),rgba(196,80,112,.68) 58%,rgba(128,48,83,.74))',
        glow: 'rgba(255,161,179,.39)',
        badgeBackground: 'rgba(255,220,228,.13)', badgeBorder: 'rgba(255,220,228,.36)', badgeText: '#fff0f4',
    },
    maestro: {
        tone: '#70d2ff',
        surface: 'linear-gradient(145deg,rgba(65,181,224,.77),rgba(40,119,180,.68) 58%,rgba(24,70,132,.74))',
        glow: 'rgba(105,213,255,.40)',
        badgeBackground: 'rgba(207,243,255,.13)', badgeBorder: 'rgba(207,243,255,.36)', badgeText: '#e5f9ff',
    },
    logistica: {
        tone: '#ffc866',
        surface: 'linear-gradient(145deg,rgba(231,171,75,.78),rgba(195,116,52,.68) 58%,rgba(126,70,42,.74))',
        glow: 'rgba(255,199,95,.40)',
        badgeBackground: 'rgba(255,239,198,.13)', badgeBorder: 'rgba(255,235,185,.37)', badgeText: '#fff4d5',
    },
    estudiante_ptm: {
        tone: '#78dfaa',
        surface: 'linear-gradient(145deg,rgba(75,188,132,.77),rgba(34,132,104,.68) 58%,rgba(20,81,76,.74))',
        glow: 'rgba(116,229,171,.40)',
        badgeBackground: 'rgba(207,255,229,.13)', badgeBorder: 'rgba(200,255,225,.36)', badgeText: '#e4fff0',
    },
};

// Custom SVG Icons matching the panel
const ContactoIcon = ({ variant }: { variant?: 'martes' | 'virtual' | 'default' }) => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className={`${variant === 'virtual' ? 'text-rose-200' :
        variant === 'martes' ? 'text-sky-400' : 'text-white'
        } drop-shadow-lg transition-colors duration-500`}>
        <circle cx="12" cy="12" r="6" fillOpacity="0.9" />
    </svg>
);

const MaestroIcon = ({ variant }: { variant?: 'martes' | 'virtual' | 'default' }) => (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className={`${variant === 'virtual' ? 'text-cyan-400' : 'text-sky-400'} transition-colors duration-500`}>
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

function RoleAccessCard({
    assignment,
    index,
    loadingKey,
    focusedRole,
    disabled,
    liquidGlass = false,
    stagePalette,
    onSelect,
}: {
    assignment: Asignacion;
    index: number;
    loadingKey: string | null;
    focusedRole: Asignacion | null;
    disabled: boolean;
    liquidGlass?: boolean;
    stagePalette?: StagePalette;
    onSelect: (assignment: Asignacion, source: HTMLElement) => void;
}) {
    const palette = stagePalette ?? ROLE_PALETTES[assignment.tipo];
    const diaLower = assignment.dia.toLowerCase();
    const variant = diaLower.includes('virtual') ? 'virtual' : diaLower.includes('martes') ? 'martes' : 'default';
    const scheduleTheme = variant === 'martes'
        ? 'border-violet-200/80 bg-violet-100/55 text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_5px_12px_rgba(139,92,246,.13)]'
        : variant === 'virtual'
            ? 'border-rose-200/80 bg-rose-100/55 text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_5px_12px_rgba(244,114,182,.13)]'
            : 'border-cyan-200/80 bg-cyan-100/55 text-cyan-700 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_5px_12px_rgba(34,211,238,.13)]';
    const roleIcon = (
        <>
            {assignment.tipo === 'contacto' && <ContactoIcon variant={variant} />}
            {assignment.tipo === 'maestro' && <MaestroIcon variant={variant} />}
            {assignment.tipo === 'logistica' && <LogisticaIcon />}
            {assignment.tipo === 'director' && <DirectorIcon />}
            {assignment.tipo === 'administrador' && <AdminIcon />}
            {assignment.tipo === 'estudiante_ptm' && <EstudianteIcon />}
            {assignment.tipo === 'kids_hub' && <KidsIcon />}
        </>
    );

    if (liquidGlass) {
        return (
            <motion.button
                key={assignment.key}
                initial={{ opacity: 0, y: -16, scale: .95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: .96 }}
                transition={{ delay: index * .055, duration: .42, ease: [0.22, 1, 0.36, 1] }}
                whileHover={!disabled ? { y: -5, scale: 1.015 } : {}}
                whileTap={!disabled ? { scale: .985 } : {}}
                onClick={(event) => onSelect(assignment, event.currentTarget)}
                disabled={disabled}
                data-role-key={assignment.key}
                className={`portal-level-card relative flex min-h-[224px] w-full items-center gap-6 overflow-hidden rounded-[32px] p-8 text-left text-[#10264b] ${loadingKey && loadingKey !== assignment.key ? 'opacity-45' : ''} ${focusedRole?.key === assignment.key ? 'opacity-0 pointer-events-none' : ''}`}
                style={{ '--stage-accent': palette.tone, '--role-surface': palette.surface } as React.CSSProperties}
            >
                <div className="portal-level-card__light absolute inset-0 pointer-events-none" />
                {loadingKey === assignment.key && (
                    <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/30 backdrop-blur-md">
                        <PremiumLoader text="Conectando..." />
                    </div>
                )}
                <div className="portal-level-card__icon relative z-10 grid h-[84px] w-[84px] shrink-0 place-items-center rounded-[23px] border border-white/85 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,.98)]">
                    <span className="scale-[.78]">{roleIcon}</span>
                </div>
                <div className="relative z-10 min-w-0 flex-1">
                    <p className="text-[13px] font-bold uppercase tracking-[.16em] text-[#5f7599]">{getRoleTitle(assignment.tipo)}</p>
                    <h3 className="mt-2 text-[30px] font-bold leading-none tracking-[-.045em] text-[#10264b]">{assignment.etapa}</h3>
                    <div className={`mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold leading-none ${scheduleTheme}`}>
                        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                        {assignment.dia || 'Acceso disponible'}
                    </div>
                </div>
                <svg className="relative z-10 shrink-0 text-[#4c668c]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15"><path d="m9 18 6-6-6-6" /></svg>
            </motion.button>
        );
    }

    return (
        <motion.button
            key={assignment.key}
            initial={{ opacity: 0, y: 30, scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: .96 }}
            transition={{ delay: index * 0.07, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
            whileHover={!disabled ? { y: -7, scale: 1.02 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={(event) => onSelect(assignment, event.currentTarget)}
            disabled={disabled}
            data-role-key={assignment.key}
            className={`portal-role-card lgx-content-card lgx-content-card--deep relative group flex min-h-[330px] w-full flex-col items-center overflow-hidden rounded-[32px] p-6 text-center transition-all duration-300 ${loadingKey && loadingKey !== assignment.key ? 'opacity-50 blur-sm' : ''} ${loadingKey === assignment.key ? 'cursor-wait' : ''} ${focusedRole?.key === assignment.key ? 'opacity-0 pointer-events-none' : ''}`}
            style={{
                '--lgx-card-tone': palette.tone,
                '--portal-card-glow': palette.glow,
                background: palette.surface,
            } as React.CSSProperties}
        >
            <div className="portal-role-card__shine absolute inset-0 rounded-[inherit] pointer-events-none" />

            {loadingKey === assignment.key && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-md rounded-[inherit]">
                    <PremiumLoader text="Conectando..." />
                </div>
            )}

            <div className="relative mb-4 p-2">
                <div className="absolute inset-0 blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-all duration-500"
                    style={{ background: palette.glow }} />
                <div className="relative z-10 transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-2 drop-shadow-2xl">
                    {roleIcon}
                </div>
            </div>

            <h3 className="mb-2 text-3xl font-bold tracking-tight text-white drop-shadow-lg">
                {getRoleTitle(assignment.tipo)}
            </h3>

            {!['director', 'administrador', 'kids_hub'].includes(assignment.tipo) && (
                <p className="text-white/85 font-medium tracking-wide mb-4 uppercase text-sm drop-shadow-sm">
                    {assignment.etapa}
                </p>
            )}

            {assignment.tipo === 'administrador' && assignment.cursos && assignment.cursos.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-4 max-w-[200px]">
                    {assignment.cursos.map((curso, idx) => (
                        <span key={idx} className="px-3 py-1 bg-white/10 border border-white/25 rounded-lg text-xs font-medium text-white/90 backdrop-blur-sm">
                            {curso}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-auto pt-4 border-t border-white/10 w-full">
                {assignment.tipo === 'kids_hub' ? (
                    <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: palette.badgeText }}>
                        Módulo Kids Ministry
                    </span>
                ) : !assignment.dia ? (
                    <span className="text-white/55 text-xs font-bold tracking-[0.2em] uppercase">Acceso Administrativo</span>
                ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md"
                        style={{ background: palette.badgeBackground, borderColor: palette.badgeBorder }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: palette.tone, boxShadow: `0 0 9px ${palette.tone}` }} />
                        <span className="text-xs font-semibold tracking-wide" style={{ color: palette.badgeText }}>
                            {assignment.dia} {assignment.franja && `• ${assignment.franja}`}
                        </span>
                    </div>
                )}
            </div>
        </motion.button>
    );
}

function StageProfiles({
    group,
    loadingKey,
    focusedRole,
    disabled,
    mobile = false,
    premiumWhite = false,
    onSelect,
    onClose,
}: {
    group: StageGroup;
    loadingKey: string | null;
    focusedRole: Asignacion | null;
    disabled: boolean;
    mobile?: boolean;
    premiumWhite?: boolean;
    onSelect: (assignment: Asignacion, source: HTMLElement) => void;
    onClose?: () => void;
}) {
    const palette = STAGE_PALETTES[group.name];

    return (
        <div className={`relative z-10 flex flex-col ${mobile ? 'h-auto' : 'h-full'}`}>
            {!mobile && (
                <header className="flex items-center justify-between gap-4 mb-12">
                    <div>
                        <p className={`text-sm font-bold uppercase tracking-[.24em] ${premiumWhite ? 'text-[#5f7599]' : 'text-white/58'}`}>Perfiles disponibles</p>
                        <h2 className={`mt-3 text-5xl font-bold tracking-[-.045em] ${premiumWhite ? 'text-[#10264b]' : 'text-white'}`}>{group.name}</h2>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className={`grid h-10 w-10 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.5)] backdrop-blur-xl transition hover:rotate-90 ${premiumWhite ? 'border border-slate-900/10 bg-white/75 text-slate-600 hover:bg-white hover:text-slate-900' : 'border border-white/25 bg-white/10 text-white/75 hover:bg-white/18 hover:text-white'}`} aria-label={`Cerrar perfiles de ${group.name}`}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m6 6 12 12M18 6 6 18" /></svg>
                        </button>
                    )}
                </header>
            )}
            <div className={`grid content-start ${mobile ? 'gap-5 overflow-visible pr-0' : 'flex-1 gap-7 overflow-y-auto pr-1'} ${mobile ? 'grid-cols-1 pt-2 pb-6' : group.assignments.length === 1 ? 'max-w-md grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {group.assignments.map((assignment, index) => (
                    <RoleAccessCard
                        key={assignment.key}
                        assignment={assignment}
                        index={index}
                        loadingKey={loadingKey}
                        focusedRole={focusedRole}
                        disabled={disabled}
                        liquidGlass
                        stagePalette={palette}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    );
}

export default function PortalClient({ nombre, asignaciones }: { nombre: string, asignaciones: Asignacion[] }) {
    const router = useRouter();
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [focusedRole, setFocusedRole] = useState<Asignacion | null>(null);
    const [focusPhase, setFocusPhase] = useState<RoleFocusPhase>('idle');
    const [focusGeometry, setFocusGeometry] = useState<RoleFocusGeometry | null>(null);
    const [expandedStage, setExpandedStage] = useState<StageName | null>(null);
    const [mobileStageToReveal, setMobileStageToReveal] = useState<StageName | null>(null);
    // Evita taps dobles durante la transición secuencial A→B en móvil
    const [mobileTransitioning, setMobileTransitioning] = useState(false);
    const mobileTransitionTimer = useRef<number>(0);
    const [focusedStage, setFocusedStage] = useState<StageName | null>(null);
    const [stageFocusPhase, setStageFocusPhase] = useState<RoleFocusPhase>('idle');
    const [stageGeometry, setStageGeometry] = useState<StageModalGeometry | null>(null);

    const stageGroups: StageGroup[] = STAGE_ORDER.map((name) => ({
        name,
        assignments: asignaciones.filter((assignment) =>
            ['maestro', 'contacto'].includes(assignment.tipo) && getStageName(assignment.etapa) === name,
        ),
    })).filter((group) => group.assignments.length > 0);

    const groupedKeys = new Set(stageGroups.flatMap((group) => group.assignments.map((assignment) => assignment.key)));
    const standaloneAssignments = asignaciones.filter((assignment) => !groupedKeys.has(assignment.key));
    const overviewCardCount = stageGroups.length + standaloneAssignments.length;

    const buildStageGeometry = (sourceRect: DOMRect, profileCount: number): StageModalGeometry => {
        const viewportPadding = 32;
        const width = Math.min(1640, window.innerWidth - viewportPadding * 2);
        const columns = width >= 840 ? 3 : 2;
        const rows = Math.ceil(profileCount / columns);
        const contentHeight = 244 + rows * 252;
        const height = Math.min(Math.max(520, contentHeight), window.innerHeight - viewportPadding * 2);
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        return {
            left,
            top,
            width,
            height,
            fromX: sourceRect.left - left,
            fromY: sourceRect.top - top,
            scaleX: sourceRect.width / width,
            scaleY: sourceRect.height / height,
        };
    };

    useEffect(() => {
        document.documentElement.classList.add('portal-access-page');
        document.body.classList.add('portal-access-page');

        return () => {
            document.documentElement.classList.remove('portal-access-page');
            document.body.classList.remove('portal-access-page');
        };
    }, []);

    useEffect(() => {
        if (!mobileStageToReveal || window.innerWidth >= 768) return;

        // Con mode="wait" la animación de SALIDA dura 280ms.
        // Disparamos el scroll a los 310ms, cuando el panel anterior ya salió
        // del DOM y el layout es estable (posición exacta de la nueva tarjeta).
        const revealTimer = window.setTimeout(() => {
            window.requestAnimationFrame(() => {
                const stageCard = Array.from(document.querySelectorAll<HTMLElement>('[data-stage-card]'))
                    .find((element) => element.dataset.stageCard === mobileStageToReveal);
                if (!stageCard) { setMobileStageToReveal(null); return; }

                const targetTop = window.scrollY + stageCard.getBoundingClientRect().top - 12;
                window.scrollTo({
                    top: Math.max(0, targetTop),
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                });
                setMobileStageToReveal(null);
            });
        }, 310);

        return () => window.clearTimeout(revealTimer);
    }, [mobileStageToReveal]);

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

        const returningStage = getStageName(returningRole.etapa);
        if (returningStage && ['maestro', 'contacto'].includes(returningRole.tipo)) {
            if (window.innerWidth < 768) {
                setExpandedStage(returningStage);
            } else {
                setFocusedStage(returningStage);
                setStageFocusPhase('open');
            }
        }

        const frame = window.requestAnimationFrame(() => {
            if (returningStage && window.innerWidth >= 768) {
                const stageSource = document.querySelector<HTMLElement>(`[data-stage-card="${returningStage}"]`);
                const profileCount = stageGroups.find((group) => group.name === returningStage)?.assignments.length ?? 1;
                if (stageSource) setStageGeometry(buildStageGeometry(stageSource.getBoundingClientRect(), profileCount));
            }
            window.requestAnimationFrame(() => {
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

    const openStageProfiles = (group: StageGroup, source: HTMLElement) => {
        if (loadingKey || focusPhase !== 'idle' || stageFocusPhase !== 'idle' || mobileTransitioning) return;

        if (window.innerWidth < 768) {
            // ── Caso: toggle de la misma tarjeta (cerrar) ──────────────────────────
            if (expandedStage === group.name) {
                setExpandedStage(null);
                setMobileStageToReveal(null);
                const stageCard = Array.from(document.querySelectorAll<HTMLElement>('[data-stage-card]'))
                    .find((element) => element.dataset.stageCard === group.name);
                if (stageCard) {
                    const targetTop = window.scrollY + stageCard.getBoundingClientRect().top - 12;
                    window.scrollTo({
                        top: Math.max(0, targetTop),
                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    });
                }
                return;
            }

            // ── Caso: cambio A→B (ya hay una tarjeta abierta) ─────────────────────
            // Cada AnimatePresence es independiente, así que mode="wait" no impide
            // que ambos paneles coexistan en el DOM. Secuenciamos manualmente:
            // 1) Cerrar A (exit 280ms), 2) Abrir B una vez el DOM esté limpio.
            if (expandedStage !== null) {
                window.clearTimeout(mobileTransitionTimer.current);
                setMobileTransitioning(true);
                setExpandedStage(null); // Dispara la animación de salida de A
                mobileTransitionTimer.current = window.setTimeout(() => {
                    setMobileTransitioning(false);
                    setExpandedStage(group.name); // DOM ya limpio → abre B
                    setMobileStageToReveal(group.name); // Dispara scroll
                }, 310); // 280ms exit + 30ms buffer React
                return;
            }

            // ── Caso: abrir con nada abierto ───────────────────────────────────────
            setExpandedStage(group.name);
            setMobileStageToReveal(group.name);
            return;
        }

        setStageGeometry(buildStageGeometry(source.getBoundingClientRect(), group.assignments.length));
        setFocusedStage(group.name);
        setStageFocusPhase('expanding');
        window.setTimeout(() => setStageFocusPhase('open'), 720);
    };

    const closeStageProfiles = () => {
        if (!focusedStage || stageFocusPhase === 'returning') return;
        setStageFocusPhase('returning');
        window.setTimeout(() => {
            setFocusedStage(null);
            setStageGeometry(null);
            setStageFocusPhase('idle');
        }, 620);
    };

    return (
        <motion.main
            className="portal-access-shell relative flex min-h-screen flex-col items-center justify-center p-4 py-8 sm:p-6"
            style={{
                background: [
                    'radial-gradient(ellipse 66% 52% at 18% -8%, rgba(158,218,255,.62) 0%,rgba(83,156,216,.24) 44%,transparent 74%)',
                    'radial-gradient(ellipse 56% 48% at 94% 12%,rgba(255,190,154,.34) 0%,rgba(224,119,102,.13) 46%,transparent 75%)',
                    'radial-gradient(ellipse 55% 44% at 54% 106%,rgba(91,222,198,.24) 0%,transparent 72%)',
                    'linear-gradient(145deg,#17334b 0%,#0b2132 48%,#06131f 100%)',
                ].join(', '),
            }}
        >
            {/* Luces ambientales suaves, inspiradas en el acabado de vidrio de Apple. */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-16%] left-[8%] h-[520px] w-[520px] rounded-full bg-sky-100/30 blur-[130px]" />
                <div className="absolute top-[-8%] right-[-10%] h-[500px] w-[500px] rounded-full bg-orange-100/15 blur-[145px]" />
                <div className="absolute bottom-[-25%] left-[28%] h-[460px] w-[700px] rounded-full bg-teal-200/15 blur-[150px]" />
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.16),transparent_34%)]" />
            </div>

            <div className="w-full max-w-4xl z-10 relative">
                <header className="mb-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3 drop-shadow-[0_10px_32px_rgba(4,19,31,.35)]">
                            Hola, {nombre.split(' ')[0]}
                        </h1>
                        <p className="text-lg text-slate-100/80 font-medium tracking-wide drop-shadow-md">
                            Selecciona tu perfil de acceso
                        </p>
                    </motion.div>
                </header>

                <LayoutGroup id="portal-responsive-stages">
                    <div className={`grid gap-6 md:gap-8 justify-center ${overviewCardCount === 1 ? 'grid-cols-1 max-w-sm mx-auto' :
                        overviewCardCount === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' :
                            overviewCardCount === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}>
                    {stageGroups.map((group, index) => {
                        const palette = STAGE_PALETTES[group.name];
                        const isExpanded = expandedStage === group.name;
                        const isStageOpen = isExpanded || focusedStage === group.name;
                        const levels = getStageLevels(group.assignments);
                        return (
                            <motion.div
                                key={group.name}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: index * .09,
                                    duration: .52,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                whileHover={!loadingKey && !mobileTransitioning && !isExpanded ? { y: -7, scale: 1.018 } : {}}
                                whileTap={!loadingKey && !mobileTransitioning && !isExpanded ? { scale: .985 } : {}}
                                className={`portal-stage-shell portal-role-card relative flex w-full flex-col overflow-hidden rounded-[32px] transition-[border-radius,box-shadow,opacity] duration-500 ${isExpanded ? 'portal-stage-shell--mobile-open' : ''}`}
                                style={{
                                    '--lgx-card-tone': palette.tone,
                                    '--portal-card-glow': palette.glow,
                                    background: palette.surface,
                                } as React.CSSProperties}
                            >
                                <div className="portal-role-card__shine absolute inset-0 rounded-[inherit] pointer-events-none" />

                                <motion.button
                                    onClick={(event) => openStageProfiles(group, event.currentTarget)}
                                    disabled={!!loadingKey || focusPhase !== 'idle' || stageFocusPhase !== 'idle' || mobileTransitioning}
                                    data-stage-card={group.name}
                                    aria-expanded={isStageOpen}
                                    aria-controls={`stage-mobile-${group.name}`}
                                    className={`portal-stage-card relative z-10 flex min-h-[330px] w-full flex-col items-center p-6 text-center outline-none bg-transparent group ${isExpanded ? 'portal-stage-card--mobile-open' : ''}`}
                                >
                                    <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl border border-white/28 bg-white/[.12] shadow-[inset_0_1px_0_rgba(255,255,255,.34),0_12px_28px_rgba(30,20,10,.13)] backdrop-blur-xl transition-transform duration-500 group-hover:-translate-y-1">
                                        <svg width="25" height="25" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                                            <path d="M24 37V21" stroke="white" strokeWidth="3.4" strokeLinecap="round" opacity=".92" />
                                            <path d="M24 26C16 25 11 20 10 12c8 0 13 4 14 12" fill="rgba(255,255,255,.42)" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
                                            <path d="M24 21c2-8 7-12 15-11-1 8-6 13-15 14" fill="rgba(255,255,255,.65)" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
                                            <path d="M16 38h16" stroke="white" strokeWidth="3.4" strokeLinecap="round" opacity=".76" />
                                        </svg>
                                    </div>
                                    <h2 className={`relative z-10 mt-8 font-bold tracking-[-.035em] text-white drop-shadow-lg ${group.name.length > 10 ? 'text-[24px]' : 'text-3xl'}`}>{group.name}</h2>
                                    <p className="relative z-10 mt-3 text-[11px] font-bold uppercase tracking-[.22em] text-white/62">Etapas asignadas</p>
                                    <div className="relative z-10 mt-3 flex min-h-8 flex-wrap justify-center gap-2">
                                        {levels.map((level) => (
                                            <span key={level} className="grid h-8 min-w-8 place-items-center rounded-full border border-white/28 bg-white/[.11] px-2 text-xs font-bold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.23)] backdrop-blur-md">{level}</span>
                                        ))}
                                    </div>
                                    <div className="relative z-10 mt-auto flex w-full items-center justify-center gap-2 border-t border-white/15 pt-4 text-xs font-bold text-white/88">
                                        <span>{isExpanded ? 'Ocultar perfiles' : 'Ver perfiles'}</span>
                                        <svg className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </motion.button>

                                {/* mode="wait" garantiza que solo UN panel esté en el DOM a la vez,
                                    evitando que la altura inflada cause un scroll incorrecto al cambiar de etapa. */}
                                <AnimatePresence initial={false} mode="wait">
                                    {isExpanded && (
                                        <motion.section
                                            key={`${group.name}-mobile`}
                                            id={`stage-mobile-${group.name}`}
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{
                                                opacity: { duration: .18, ease: 'easeOut' },
                                                height: { duration: .28, ease: [0.22, 1, 0.36, 1] },
                                            }}
                                            className="portal-stage-mobile-panel relative z-10 overflow-hidden"
                                        >
                                            <div className="px-4 pb-4">
                                                <StageProfiles
                                                    group={group}
                                                    loadingKey={loadingKey}
                                                    focusedRole={focusedRole}
                                                    disabled={!!loadingKey || focusPhase !== 'idle'}
                                                    mobile
                                                    onSelect={openRolePreview}
                                                />
                                            </div>
                                        </motion.section>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}

                    {standaloneAssignments.map((assignment, index) => (
                        <RoleAccessCard
                            key={assignment.key}
                            assignment={assignment}
                            index={stageGroups.length + index}
                            loadingKey={loadingKey}
                            focusedRole={focusedRole}
                            disabled={!!loadingKey || focusPhase !== 'idle'}
                            onSelect={openRolePreview}
                        />
                    ))}
                    </div>
                </LayoutGroup>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-8 text-center"
                >
                    <a
                        href="/login"
                        className="lgx-content-card lgx-content-card--deep relative group inline-flex items-center gap-3 px-8 py-3 rounded-full overflow-hidden transition-all"
                        style={{ '--lgx-card-tone': '#78c9d4' } as React.CSSProperties}
                    >
                        {/* Button Glow */}
                        <div className="absolute inset-0 bg-white/5 border border-white/20 rounded-full group-hover:bg-white/10 group-hover:border-white/40 transition-all duration-300" />
                        <div className="absolute inset-0 bg-cyan-300/15 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-100 group-hover:text-white transition-colors relative z-10"><path d="M15 18l-6-6 6-6" /></svg>
                        <span className="text-slate-100 font-semibold tracking-wide group-hover:text-white transition-colors relative z-10 text-sm">Cerrar Sesión</span>
                    </a>
                </motion.div>
            </div>

            {focusedStage && (() => {
                const group = stageGroups.find((candidate) => candidate.name === focusedStage);
                if (!group) return null;
                const palette = STAGE_PALETTES[group.name];
                const modalGeometry = stageGeometry ?? {
                    left: 32,
                    top: 32,
                    width: Math.max(320, window.innerWidth - 64),
                    height: Math.max(420, window.innerHeight - 64),
                    fromX: 0,
                    fromY: 0,
                    scaleX: 1,
                    scaleY: 1,
                };
                return (
                    <>
                        {stageFocusPhase !== 'returning' && <div className="fixed inset-0 z-40 bg-slate-950/48 backdrop-blur-xl" />}
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-label={`Perfiles de ${group.name}`}
                            className={`portal-stage-modal fixed z-50 hidden overflow-hidden rounded-[36px] border border-white/65 p-8 text-white md:block lg:p-16 ${
                                stageFocusPhase === 'expanding'
                                    ? 'portal-role-focus--expanding'
                                    : stageFocusPhase === 'returning'
                                        ? 'portal-role-focus--returning pointer-events-none'
                                        : 'portal-role-focus--open'
                            }`}
                            style={{
                                left: modalGeometry.left,
                                top: modalGeometry.top,
                                width: modalGeometry.width,
                                height: modalGeometry.height,
                                '--lgx-card-tone': palette.tone,
                                '--stage-accent': palette.tone,
                                '--portal-card-glow': palette.glow,
                                '--portal-from-x': `${modalGeometry.fromX}px`,
                                '--portal-from-y': `${modalGeometry.fromY}px`,
                                '--portal-scale-x': modalGeometry.scaleX,
                                '--portal-scale-y': modalGeometry.scaleY,
                                background: palette.modalSurface,
                            } as React.CSSProperties}
                        >
                            <div className="portal-stage-modal__light absolute inset-0 pointer-events-none" />
                            <div
                                className={`portal-stage-modal__color-wash absolute inset-0 pointer-events-none ${
                                    stageFocusPhase === 'expanding'
                                        ? 'portal-stage-modal__color-wash--expanding'
                                        : stageFocusPhase === 'returning'
                                            ? 'portal-stage-modal__color-wash--returning'
                                            : ''
                                }`}
                                style={{ background: palette.modalFusion }}
                            />
                            <div className={`h-full transition-all duration-500 ${stageFocusPhase === 'open' ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
                                <StageProfiles
                                    group={group}
                                    loadingKey={loadingKey}
                                    focusedRole={focusedRole}
                                    disabled={!!loadingKey || focusPhase !== 'idle'}
                                    premiumWhite
                                    onSelect={openRolePreview}
                                    onClose={closeStageProfiles}
                                />
                            </div>
                        </section>
                    </>
                );
            })()}

            {focusedRole && focusGeometry && (
                <>
                    {focusPhase !== 'returning' && (
                        <div className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-sm" />
                    )}
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Vista previa de ${getRoleTitle(focusedRole.tipo)}`}
                        className={`lgx-content-card lgx-content-card--deep fixed z-[80] flex flex-col items-center justify-center overflow-hidden rounded-[32px] px-8 text-center text-white ${
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
                            '--lgx-card-tone': ROLE_PALETTES[focusedRole.tipo].tone,
                            background: ROLE_PALETTES[focusedRole.tipo].surface,
                            '--portal-from-x': `${focusGeometry.fromX}px`,
                            '--portal-from-y': `${focusGeometry.fromY}px`,
                            '--portal-scale-x': focusGeometry.scaleX,
                            '--portal-scale-y': focusGeometry.scaleY,
                        } as React.CSSProperties}
                    >
                        <div className={`max-w-md transition-all duration-300 ${focusPhase === 'open' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <p className="text-xs font-bold uppercase tracking-[.24em] text-sky-100/80">Perfil de acceso</p>
                            <h2 className="mt-3 text-4xl font-bold tracking-tight">{getRoleTitle(focusedRole.tipo)}</h2>
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
                .portal-role-card {
                    border: 1px solid rgba(255,255,255,.52) !important;
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,.72),
                        inset 0 -1px 0 rgba(255,255,255,.12),
                        0 24px 58px rgba(2,13,23,.28),
                        0 8px 28px var(--portal-card-glow);
                    backdrop-filter: blur(30px) saturate(150%);
                    -webkit-backdrop-filter: blur(30px) saturate(150%);
                    isolation: isolate;
                }
                .portal-role-card__shine {
                    z-index: 0;
                    opacity: .72;
                    background: linear-gradient(108deg,rgba(255,255,255,.18),transparent 31%,rgba(255,255,255,.05) 64%,rgba(255,255,255,.18));
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
                    transition: opacity .5s ease, transform .6s cubic-bezier(.22,1,.36,1);
                }
                .portal-role-card:hover .portal-role-card__shine { opacity: .96; transform: translateY(-2px); }
                .portal-stage-card--mobile-open {
                    border-color: rgba(255,255,255,.72) !important;
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,.82),
                        0 0 0 2px color-mix(in srgb, var(--lgx-card-tone) 28%, transparent),
                        0 25px 65px rgba(2,13,23,.3),
                        0 10px 34px var(--portal-card-glow);
                }
                .portal-stage-modal {
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,.98),
                        inset 0 -1px 0 rgba(166,182,209,.18),
                        0 42px 110px rgba(2,10,18,.52),
                        0 12px 34px rgba(44,66,102,.1);
                    backdrop-filter: blur(34px) saturate(125%);
                    -webkit-backdrop-filter: blur(34px) saturate(125%);
                    isolation: isolate;
                }
                .portal-stage-modal__light {
                    z-index: 0;
                    background:
                        radial-gradient(ellipse 58% 38% at 5% 0%,rgba(255,255,255,.9),transparent 70%),
                        radial-gradient(ellipse 48% 40% at 100% 100%,rgba(212,222,240,.26),transparent 74%);
                }
                @keyframes stageColorFusion {
                    from { opacity: 1; filter: saturate(1.06); }
                    62% { opacity: .74; filter: saturate(1); }
                    to { opacity: 0; filter: saturate(.96); }
                }
                @keyframes stageColorUnfusion {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .portal-stage-modal__color-wash {
                    z-index: 1;
                    opacity: 0;
                    transform: translateZ(0);
                }
                .portal-stage-modal__color-wash--expanding {
                    animation: stageColorFusion .72s cubic-bezier(.22,.72,.18,1) both;
                }
                .portal-stage-modal__color-wash--returning {
                    animation: stageColorUnfusion .5s cubic-bezier(.4,0,.24,1) both;
                }
                .portal-level-card {
                    border: 1px solid rgba(255,255,255,.75);
                    background:
                        radial-gradient(ellipse 70% 78% at 0% 0%,rgba(255,255,255,.96),transparent 68%),
                        radial-gradient(ellipse 80% 86% at 100% 100%,color-mix(in srgb, var(--stage-accent) 22%, rgba(255,255,255,.45)),transparent 72%),
                        linear-gradient(135deg,rgba(255,255,255,.88),color-mix(in srgb, var(--stage-accent) 12%, rgba(255,255,255,.75)));
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,1),
                        inset 0 -1px 0 rgba(172,190,220,.14),
                        0 18px 28px rgba(49,70,108,.13),
                        0 4px 12px rgba(49,70,108,.08);
                    backdrop-filter: blur(24px) saturate(128%);
                    -webkit-backdrop-filter: blur(24px) saturate(128%);
                    transition: border-color .35s ease, box-shadow .35s ease, background .35s ease, transform .2s ease;
                    isolation: isolate;
                }
                .portal-level-card:hover {
                    border-color: rgba(255,255,255,1);
                    background:
                        radial-gradient(ellipse 70% 78% at 0% 0%,rgba(255,255,255,1),transparent 68%),
                        radial-gradient(ellipse 80% 86% at 100% 100%,color-mix(in srgb, var(--stage-accent) 30%, rgba(255,255,255,.6)),transparent 72%),
                        linear-gradient(135deg,rgba(255,255,255,.96),color-mix(in srgb, var(--stage-accent) 16%, rgba(255,255,255,.85)));
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,1),
                        0 24px 36px rgba(49,70,108,.17),
                        0 8px 18px rgba(49,70,108,.1);
                }
                .portal-level-card__light {
                    z-index: 0;
                    opacity: .6;
                    background: linear-gradient(114deg,rgba(255,255,255,.44),transparent 40%,rgba(255,255,255,.08) 74%);
                }
                .portal-level-card__icon svg {
                    color: var(--stage-accent) !important;
                }
                .portal-role-focus--expanding { animation: portalRoleExpand .72s cubic-bezier(.22,.72,.18,1) both; transform-origin: top left; }
                .portal-role-focus--open { transform: translate3d(0, 0, 0) scale(1); transform-origin: top left; }
                .portal-role-focus--returning { animation: portalRoleCollapse .62s cubic-bezier(.4,0,.24,1) both; transform-origin: top left; }
                @media (max-width: 767px) {
                    html.portal-access-page,
                    body.portal-access-page {
                        background: #06131f;
                    }
                    .portal-access-shell {
                        min-height: auto !important;
                        justify-content: flex-start;
                        padding-bottom: calc(1rem + env(safe-area-inset-bottom)) !important;
                    }
                    .portal-stage-mobile-panel { display: block !important; }
                    .portal-stage-card {
                        min-height: 304px;
                        padding: 24px;
                    }
                    .portal-stage-card > h2 { margin-top: 24px; }
                    .portal-stage-mobile-panel {
                        margin-top: 0;
                    }
                    .portal-stage-mobile-panel .portal-level-card {
                        min-height: 150px;
                        gap: 16px;
                        border-radius: 28px;
                        padding: 20px;
                        backdrop-filter: blur(10px) saturate(112%);
                        -webkit-backdrop-filter: blur(10px) saturate(112%);
                    }
                    .portal-stage-mobile-panel .portal-level-card__icon {
                        width: 64px;
                        height: 64px;
                        border-radius: 19px;
                    }
                    .portal-stage-mobile-panel .portal-level-card__icon > span {
                        transform: scale(.6);
                    }
                    .portal-stage-mobile-panel .portal-level-card p {
                        font-size: 11px;
                        letter-spacing: .14em;
                    }
                    .portal-stage-mobile-panel .portal-level-card h3 {
                        margin-top: 6px;
                        font-size: 25px;
                        line-height: 1.08;
                        letter-spacing: -.035em;
                        white-space: nowrap;
                    }
                    .portal-stage-mobile-panel .portal-level-card h3 + div {
                        margin-top: 12px;
                        padding: 7px 12px;
                        font-size: 13px;
                    }
                    .portal-stage-mobile-panel .portal-level-card > svg {
                        width: 18px;
                        height: 18px;
                    }
                }
                @media (max-width: 639px) {
                    .portal-role-focus--expanding, .portal-role-focus--open, .portal-role-focus--returning { left: 12px !important; top: 12px !important; width: calc(100vw - 24px) !important; height: calc(100vh - 24px) !important; }
                }
                @media (max-width: 390px) {
                    .portal-stage-mobile-panel { padding: 16px; }
                    .portal-stage-mobile-panel .portal-level-card { padding: 16px; gap: 12px; }
                    .portal-stage-mobile-panel .portal-level-card__icon { width: 58px; height: 58px; }
                    .portal-stage-mobile-panel .portal-level-card h3 { font-size: 23px; }
                }
            `}</style>
        </motion.main>
    );
}
