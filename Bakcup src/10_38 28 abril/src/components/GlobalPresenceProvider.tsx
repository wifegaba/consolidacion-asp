// src/components/GlobalPresenceProvider.tsx
'use client';

import React from 'react';
import { useGlobalPresence } from '../hooks/useGlobalPresence';
import { PresenceToast } from '../app/admin/components/PresenceToast';

interface GlobalPresenceProviderProps {
    userName: string;
    userId: string;
    children: React.ReactNode;
}

/**
 * Componente wrapper que agrega notificaciones de presencia a cualquier página.
 * 
 * Uso:
 * ```tsx
 * <GlobalPresenceProvider userName="Juan" userId="123">
 *   {contenido de la página}
 * </GlobalPresenceProvider>
 * ```
 */
export function GlobalPresenceProvider({
    userName,
    userId,
    children
}: GlobalPresenceProviderProps) {
    const { toasts, handleDismissToast } = useGlobalPresence(userName, userId);

    return (
        <>
            {children}
            <PresenceToast toasts={toasts} onDismiss={handleDismissToast} />
        </>
    );
}
