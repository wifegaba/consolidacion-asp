// src/hooks/useGlobalPresence.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePresence, type PresenceUser } from './usePresence';
import type { Toast } from '../app/admin/components/PresenceToast';

/**
 * Hook global que combina la lógica de presencia con el manejo de toasts.
 * Puede ser reutilizado en cualquier página del sistema.
 */
export function useGlobalPresence(userName: string, userId: string) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const handleUserJoin = useCallback((user: PresenceUser) => {
        const newToast: Toast = {
            id: `${user.user_id}-${Date.now()}`,
            userName: user.name
        };
        setToasts(prev => [...prev, newToast].slice(-3)); // Máximo 3 toasts
    }, []);

    const handleDismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Hook de presencia
    usePresence(userName, userId, handleUserJoin);

    return { toasts, handleDismissToast };
}
