
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface PremiumActionButtonProps {
    onClick: () => void;
    Icon: LucideIcon;
    color: 'violet' | 'amber' | 'sky' | 'rose' | 'emerald';
    label?: string; // Tooltip text
    badgeCount?: number;
    className?: string; // Extra classes
}

const colorMap = {
    violet: {
        text: 'text-violet-600',
        shadow: 'shadow-violet-200/50',
        hoverShadow: 'hover:shadow-violet-300/60',
        border: 'border-violet-100',
        fill: 'fill-violet-50 group-hover:fill-violet-100',
        badge: 'bg-rose-500',
        tooltip: 'text-violet-200'
    },
    amber: {
        text: 'text-amber-600',
        shadow: 'shadow-amber-200/50',
        hoverShadow: 'hover:shadow-amber-300/60',
        border: 'border-amber-100',
        fill: 'fill-amber-50 group-hover:fill-amber-100',
        badge: 'bg-amber-500',
        tooltip: 'text-amber-200'
    },
    sky: {
        text: 'text-sky-600',
        shadow: 'shadow-sky-200/50',
        hoverShadow: 'hover:shadow-sky-300/60',
        border: 'border-sky-100',
        fill: 'fill-sky-50 group-hover:fill-sky-100',
        badge: 'bg-sky-500',
        tooltip: 'text-sky-200'
    },
    rose: {
        text: 'text-rose-600',
        shadow: 'shadow-rose-200/50',
        hoverShadow: 'hover:shadow-rose-300/60',
        border: 'border-rose-100',
        fill: 'fill-rose-50 group-hover:fill-rose-100',
        badge: 'bg-rose-500',
        tooltip: 'text-rose-200'
    },
    emerald: {
        text: 'text-emerald-600', // Usually text-white for main button but keeping consistent logic if used as icon-only
        shadow: 'shadow-emerald-200/50',
        hoverShadow: 'hover:shadow-emerald-300/60',
        border: 'border-emerald-100',
        fill: 'fill-emerald-50 group-hover:fill-emerald-100',
        badge: 'bg-emerald-500',
        tooltip: 'text-emerald-200'
    }
};

export function PremiumActionButton({ onClick, Icon, color, label, badgeCount, className = '' }: PremiumActionButtonProps) {
    const [isHovered, setIsHovered] = useState(false);
    const theme = colorMap[color];

    // Special case for 'emerald' which is often a filled button with text, but if used as Icon Only:
    // For this specific 'innovative' tooltip task, let's assume standard icon button usage.
    // We will style the button itself.

    return (
        <div className="relative flex flex-col items-center">
            <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`h-11 w-11 rounded-2xl bg-white flex items-center justify-center 
          ${theme.text} shadow-lg ${theme.shadow} 
          hover:scale-110 hover:shadow-xl ${theme.hoverShadow} 
          transition-all duration-300 border ${theme.border} relative group ${className}`}
            >
                <Icon size={20} className={`${theme.fill} transition-colors`} strokeWidth={1.5} />
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className={`absolute -top-1 -right-1 h-3 w-3 ${theme.badge} rounded-full border-2 border-white`} />
                )}
            </button>

            {/* Innovative Spirit Tooltip */}
            <AnimatePresence>
                {isHovered && label && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: -8, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="absolute bottom-full mb-1 z-50 pointer-events-none"
                    >
                        <div className="relative px-3 py-1.5 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-xl flex items-center justify-center border border-white/10">
                            <span className={`text-[10px] font-bold tracking-wide uppercase ${theme.tooltip} whitespace-nowrap`}>
                                {label}
                            </span>
                            {/* Tiny arrow pointing down */}
                            <div className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/95 rotate-45 border-r border-b border-white/10"></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
