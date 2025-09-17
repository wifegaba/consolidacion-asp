'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Watcher de Realtime para el Dashboard:
 * - Escucha tablas que impactan las tarjetas/KPIs.
 * - Aplica debounce y ejecuta router.refresh() para recalcular metricas en el server.
 * - Activa logs pasando ?rtlog=1 o ?debug=1 en la URL.
 */
export default function RtDashboardWatch() {
  const router = useRouter();
  const params = useSearchParams();
  const rtDebug = params?.get('rtlog') === '1' || params?.get('debug') === '1';

  const [, startTransition] = useTransition();
  const tRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const log = useCallback((...args: unknown[]) => {
    if (rtDebug) console.log('[RT dashboard]', ...args);
  }, [rtDebug]);

  const scheduleRefresh = useCallback(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    // pequeno debounce para coalescer multiples eventos cercanos
    tRef.current = window.setTimeout(() => {
      startTransition(() => router.refresh());
    }, 200);
  }, [router, startTransition]);

  useEffect(() => {
    const currentChannel = channelRef.current;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
      channelRef.current = null;
    }

    const channel = supabase.channel('rt-dashboard');
    channelRef.current = channel;

    const tables = [
  "persona",              // Contactos
  "servidores",           // Servidores
  "asistencia",           // Asistencias
  "progreso",             // Agendados
  "llamada_intento",      // Cambios de estado
  "transition_log",       // Avances de módulo/semana
  "asignaciones_contacto",
  "asignaciones_maestro",
] as const;

    const getRefId = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const next = payload.new;
      if (next && typeof next === 'object' && 'id' in next) {
        return (next as { id?: unknown }).id ?? null;
      }
      const prev = payload.old;
      if (prev && typeof prev === 'object' && 'id' in prev) {
        return (prev as { id?: unknown }).id ?? null;
      }
      return null;
    };

    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          log('ev', table, payload.eventType, getRefId(payload));
          scheduleRefresh();
        }
      );
    });

    channel.subscribe((status, err) => {
      log('channel:status', status, err ?? '');
      if (status === 'SUBSCRIBED') scheduleRefresh();
      if (status === 'CHANNEL_ERROR' && err) console.error('[RT dashboard] channel error', err);
    });

    return () => {
      if (tRef.current) {
        window.clearTimeout(tRef.current);
        tRef.current = null;
      }
      const activeChannel = channelRef.current;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        channelRef.current = null;
      }
    };
  }, [log, scheduleRefresh]);

  return null;
}