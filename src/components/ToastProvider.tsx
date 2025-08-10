'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import './toast.css';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: string; message: string; kind: ToastKind };

type ToastCtx = {
    toast: {
        success: (msg: string) => void;
        error: (msg: string) => void;
        info: (msg: string) => void;
    };
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<Toast[]>([]);

    const push = useCallback((message: string, kind: ToastKind) => {
        const id = Math.random().toString(36).slice(2);
        setItems((prev) => [...prev, { id, message, kind }]);
        // Autocerrar en 3.2s
        setTimeout(() => {
            setItems((prev) => prev.filter((t) => t.id !== id));
        }, 3200);
    }, []);

    const api = {
        success: (m: string) => push(m, 'success'),
        error: (m: string) => push(m, 'error'),
        info: (m: string) => push(m, 'info'),
    };

    return (
        <Ctx.Provider value={{ toast: api }}>
            {children}
            <div className="toast-stack">
                {items.map((t) => (
                    <div key={t.id} className={`toast-item toast-${t.kind}`}>
                        <span className="toast-dot" />
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

export function useToast() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
    return ctx.toast;
}
