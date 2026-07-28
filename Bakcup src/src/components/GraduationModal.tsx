'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Sparkles, Award } from 'lucide-react';
import { ConfettiButton } from './ConfettiButton';

interface GraduationModalProps {
    isOpen: boolean;
    studentName: string;
    nextCourseName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function GraduationModal({
    isOpen,
    studentName,
    nextCourseName,
    onConfirm,
    onCancel
}: GraduationModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/40 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.3)] ring-1 ring-white/60 backdrop-blur-xl"
                    >
                        {/* Decorative Background Elements */}
                        <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-400/20 to-purple-500/20 blur-3xl" />

                        {/* Graduation Cap Icon */}
                        <div className="relative flex justify-center pt-8 pb-4">
                            <motion.div
                                initial={{ rotate: -15, scale: 0 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                className="relative"
                            >
                                <div className="absolute inset-0 animate-ping rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 opacity-20" />
                                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-[0_8px_30px_rgba(251,191,36,0.4)]">
                                    <GraduationCap className="h-10 w-10 text-white drop-shadow-lg" strokeWidth={2.5} />
                                </div>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                    className="absolute -top-1 -right-1"
                                >
                                    <Sparkles className="h-6 w-6 text-yellow-400" fill="currentColor" />
                                </motion.div>
                            </motion.div>
                        </div>

                        {/* Content */}
                        <div className="relative px-6 pb-6 pt-2 text-center">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <div className="mb-2 flex items-center justify-center gap-1">
                                    <Award className="h-5 w-5 text-amber-600" />
                                    <h2 className="text-2xl font-black tracking-tight text-gray-900">
                                        ¡Promoción de Estudiante!
                                    </h2>
                                    <Award className="h-5 w-5 text-amber-600" />
                                </div>

                                <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
                                    ¿Estás seguro de promover a
                                </p>

                                <div className="my-3 rounded-xl bg-gradient-to-r from-indigo-100/80 via-purple-100/80 to-pink-100/80 px-4 py-3 ring-1 ring-indigo-200/50">
                                    <p className="text-lg font-bold text-indigo-900">
                                        {studentName}
                                    </p>
                                </div>

                                <p className="text-[15px] text-gray-700">
                                    al siguiente nivel:
                                </p>

                                <div className="mt-3 mb-6 rounded-xl bg-gradient-to-r from-emerald-100/80 via-teal-100/80 to-cyan-100/80 px-4 py-3 ring-1 ring-emerald-200/50">
                                    <p className="text-lg font-bold text-emerald-900">
                                        {nextCourseName}
                                    </p>
                                </div>

                                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span>Esta acción quedará registrada</span>
                                    <Sparkles className="h-3.5 w-3.5" />
                                </div>
                            </motion.div>

                            {/* Action Buttons */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="mt-6 flex gap-3"
                            >
                                <button
                                    onClick={onCancel}
                                    className="flex-1 rounded-xl bg-white/80 px-4 py-3 font-semibold text-gray-700 ring-1 ring-gray-300/50 backdrop-blur-sm transition-all hover:bg-gray-50 hover:ring-gray-400/50 active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <ConfettiButton
                                    onClick={onConfirm}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-4 py-3 font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400/20 transition-all hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 hover:shadow-[0_6px_30px_rgba(16,185,129,0.5)] active:scale-95"
                                    confettiOptions={{
                                        particleCount: 200,
                                        spread: 150,
                                        startVelocity: 45,
                                        colors: ['#10b981', '#14b8a6', '#22c55e', '#fbbf24', '#f59e0b', '#fcd34d'],
                                        shapes: ['circle', 'square'],
                                        scalar: 1.5,
                                        zIndex: 99999,
                                    }}
                                >
                                    Promover 🎓
                                </ConfettiButton>
                            </motion.div>
                        </div>

                        {/* Bottom Decorative Line */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
