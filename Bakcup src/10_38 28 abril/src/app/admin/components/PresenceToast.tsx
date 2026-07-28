// src/app/admin/components/PresenceToast.tsx
'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck2 } from 'lucide-react';

export interface Toast {
    id: string;
    userName: string;
}

interface PresenceToastProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

export function PresenceToast({ toasts, onDismiss }: PresenceToastProps) {
    useEffect(() => {
        // Auto-dismiss después de 4 segundos
        toasts.forEach((toast) => {
            const timer = setTimeout(() => {
                onDismiss(toast.id);
            }, 4000);

            return () => clearTimeout(timer);
        });
    }, [toasts, onDismiss]);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast, index) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.8 }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 30,
                        }}
                        className="pointer-events-auto"
                        style={{ zIndex: 100 - index }}
                    >
                        <div className="bg-gradient-to-r from-emerald-500/90 to-green-500/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-emerald-500/30 px-5 py-3.5 flex items-center gap-3 min-w-[280px]">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <UserCheck2 size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold text-sm leading-tight">
                                    {toast.userName}
                                </p>
                                <p className="text-white/80 text-xs mt-0.5">
                                    acaba de iniciar sesión
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
