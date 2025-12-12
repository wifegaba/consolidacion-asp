'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Ocultar el splash después de 4 segundos
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 4000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
                    }}
                >
                    {/* Efectos de fondo animados */}
                    <div className="absolute inset-0 overflow-hidden">
                        {/* Círculos animados de fondo */}
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.1, 0.2, 0.1],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl"
                        />
                        <motion.div
                            animate={{
                                scale: [1.2, 1, 1.2],
                                opacity: [0.1, 0.2, 0.1],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 1.5
                            }}
                            className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
                        />
                    </div>

                    {/* Logo con animaciones */}
                    <div className="relative z-10">
                        {/* Anillo exterior giratorio - desaparece después de 2 vueltas */}
                        <motion.div
                            animate={{ rotate: 720 }} // 2 vueltas completas
                            transition={{
                                duration: 6, // 3 segundos por vuelta × 2
                                ease: "linear"
                            }}
                            initial={{ opacity: 1 }}
                            className="absolute inset-0 -m-16"
                        >
                            <motion.div
                                animate={{ opacity: [1, 1, 0] }}
                                transition={{ duration: 6 }}
                                className="w-full h-full rounded-full border-2 border-t-blue-400 border-r-transparent border-b-purple-400 border-l-transparent"
                            />
                        </motion.div>

                        {/* Contenedor del logo */}
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                duration: 1
                            }}
                            className="relative"
                        >
                            {/* Resplandor blanco para contraste con letras oscuras */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{
                                    opacity: [0.7, 1, 0.7],
                                    scale: [1, 1.05, 1]
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: 0.5
                                }}
                                className="absolute inset-0 -m-12 rounded-full bg-white/60 blur-3xl"
                            />

                            {/* Glow effect detrás del logo */}
                            <motion.div
                                animate={{
                                    opacity: [0.4, 0.7, 0.4],
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="absolute inset-0 -m-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 blur-3xl opacity-50"
                            />

                            {/* Logo */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                                className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 drop-shadow-2xl flex items-center justify-center"
                            >
                                <Image
                                    src="/asp-logo.png"
                                    alt="ASP Logo"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </motion.div>
                        </motion.div>

                        {/* Texto animado */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.6 }}
                            className="mt-8 text-center"
                        >
                            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg">
                                CRM MINISTERIAL
                            </h1>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ delay: 1.2, duration: 0.6 }}
                                className="h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 rounded-full mx-auto"
                            />
                        </motion.div>

                        {/* Puntos de carga animados */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5 }}
                            className="flex gap-2 justify-center mt-8"
                        >
                            {[0, 1, 2].map((index) => (
                                <motion.div
                                    key={index}
                                    animate={{
                                        scale: [1, 1.5, 1],
                                        opacity: [0.5, 1, 0.5],
                                    }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: index * 0.2,
                                    }}
                                    className="w-2 h-2 rounded-full bg-white/80"
                                />
                            ))}
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
