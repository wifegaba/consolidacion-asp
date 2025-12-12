'use client';

import { motion } from 'framer-motion';

export default function PremiumLoader({ text = 'Cargando', fullscreen = false }: { text?: string, fullscreen?: boolean }) {
    return (
        <div className={`flex flex-col items-center justify-center gap-4 ${fullscreen ? 'min-h-[100dvh] w-full bg-[#f5f5f7]' : 'w-full h-full'}`}>
            <div className="relative">
                {/* Outer Ring */}
                <motion.div
                    className="w-12 h-12 rounded-full border-[3px] border-slate-200"
                    style={{ borderTopColor: 'transparent' }} // Static track
                />

                {/* Spinning Gradient Ring */}
                <motion.div
                    className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent"
                    style={{
                        borderTopColor: '#3b82f6', // blue-500
                        borderRightColor: '#60a5fa', // blue-400
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />

                {/* Inner Glow */}
                <motion.div
                    className="absolute inset-0 bg-blue-100/50 rounded-full blur-xl"
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </div>

            <motion.p
                initial={{ opacity: 0.6 }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-sm font-medium text-slate-500 tracking-wide uppercase"
            >
                {text}
            </motion.p>
        </div>
    );
}
