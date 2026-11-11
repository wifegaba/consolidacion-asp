"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { DashboardMetric } from './DashboardMetric';

export function ContactosKPI({ label, initialValue }: { label: string; initialValue: number }) {
    const [count, setCount] = useState<number>(initialValue);
    const [burst, setBurst] = useState(false);
    const cardRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        let mounted = true;
        const channel = supabase.channel('rt-contactos-kpi');

        async function fetchCount(withPulse = false) {
            const { count: newCount, error } = await supabase
                .from('persona')
                .select('id', { count: 'exact', head: true });

            if (!error && typeof newCount === 'number' && mounted) {
                if (newCount !== count) {
                    setBurst(false);
                    setTimeout(() => setBurst(true), 10);
                }
                setCount(newCount);

                if (withPulse && cardRef.current) {
                    cardRef.current.classList.remove('pulse-realtime');
                    // Forzar reflow para reiniciar la animación
                    void cardRef.current.offsetWidth;
                    cardRef.current.classList.add('pulse-realtime');
                }
            }
        }

        fetchCount();

        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'persona' }, () => fetchCount(true))
          .subscribe();
        
        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [count]); // La dependencia `supabase` se omite si se importa directamente y no es un prop.

    return <DashboardMetric ref={cardRef} tone="contactos" label={label} value={count.toLocaleString('es-CO')} burst={burst} />;
}
