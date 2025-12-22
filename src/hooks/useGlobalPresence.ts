// src/hooks/useGlobalPresence.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePresence, type PresenceUser } from './usePresence';
import type { Toast } from '../app/admin/components/PresenceToast';

// Variables globales para deduplicación entre componentes
const globalRecentJoins = new Map<string, number>();
const COOLDOWN_MS = 3600000; // 1 hora de cooldown compartido

/**
 * Hook global que combina la lógica de presencia con el manejo de toasts.
 * Puede ser reutilizado en cualquier página del sistema.
 * Incluye lógica de deduplicación global para evitar notificaciones repetidas.
 */
export function useGlobalPresence(userName: string, userId: string) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const handleUserJoin = useCallback((user: PresenceUser) => {
        const now = Date.now();
        const lastJoinTime = globalRecentJoins.get(user.user_id);

        // Si este usuario ya se conectó hace menos de 5 segundos, ignorar
        if (lastJoinTime && (now - lastJoinTime) < COOLDOWN_MS) {
            // console.log(`⏭️ Skipping duplicate join notification for: ${user.name}`);
            return;
        }

        // Actualizar el timestamp global
        globalRecentJoins.set(user.user_id, now);

        // Crear y mostrar el toast
        const newToast: Toast = {
            id: `${user.user_id}-${now}`,
            userName: user.name
        };
        setToasts(prev => [...prev, newToast].slice(-3)); // Máximo 3 toasts

        // Limpiar el registro global después del cooldown
        setTimeout(() => {
            globalRecentJoins.delete(user.user_id);
        }, COOLDOWN_MS);
    }, []);

    const handleDismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Hook de presencia
    usePresence(userName, userId, handleUserJoin);

    return { toasts, handleDismissToast };
}
