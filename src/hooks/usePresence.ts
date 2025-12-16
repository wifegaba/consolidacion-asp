// src/hooks/usePresence.ts
'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface PresenceUser {
    user_id: string;
    name: string;
    online_at: string;
}

export function usePresence(
    currentUserName: string,
    currentUserId: string,
    onUserJoin?: (user: PresenceUser) => void
) {
    // Use ref to avoid recreating subscription on callback change
    const onUserJoinRef = useRef(onUserJoin);
    const initialSyncComplete = useRef(false);

    useEffect(() => {
        onUserJoinRef.current = onUserJoin;
    }, [onUserJoin]);

    useEffect(() => {
        // Skip if no user ID
        if (!currentUserId || !currentUserName) {
            // console.log('⏭️ Skipping presence - no user info');
            return;
        }

        // Reset sync flag on new connection
        initialSyncComplete.current = false;

        const channel = supabase.channel('admin-presence', {
            config: {
                presence: {
                    key: currentUserId,
                },
            },
        });

        channel
            // Event 'sync' se dispara cuando se completa la sincronización inicial
            .on('presence', { event: 'sync' }, () => {
                // console.log('🔄 Initial presence sync complete');
                initialSyncComplete.current = true;
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                // Ignorar eventos JOIN hasta que se complete el sync inicial
                if (!initialSyncComplete.current) {
                    // console.log('⏭️ Skipping initial presence users');
                    return;
                }

                // console.log('🟢 Presence JOIN detected:', newPresences);
                // Solo notificar si no es el usuario actual
                newPresences.forEach((presence: any) => {
                    // console.log('Checking user:', presence.user_id, 'vs current:', currentUserId);
                    if (presence.user_id !== currentUserId && onUserJoinRef.current) {
                        // console.log('✅ Showing toast for:', presence.name);
                        onUserJoinRef.current({
                            user_id: presence.user_id,
                            name: presence.name,
                            online_at: presence.online_at,
                        });
                    }
                });
            })
            .subscribe(async (status) => {
                // console.log('📡 Presence channel status:', status);
                if (status === 'SUBSCRIBED') {
                    // console.log('✅ Tracking presence for:', currentUserName, 'ID:', currentUserId);
                    // Registrar presencia del usuario actual
                    await channel.track({
                        user_id: currentUserId,
                        name: currentUserName,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            // console.log('🔌 Unsubscribing from presence channel');
            initialSyncComplete.current = false;
            channel.unsubscribe();
        };
    }, [currentUserId, currentUserName]); // Removed onUserJoin from deps
}
