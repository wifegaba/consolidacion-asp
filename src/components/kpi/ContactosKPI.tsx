"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Definimos las props que el componente aceptará
type ContactosKPIProps = {
  label: string;
  initialValue: number;
  delta?: string;
  className?: string;
  [key: string]: any; // Permite pasar cualquier otra prop, como `data-key`
};

export function ContactosKPI({ label, initialValue, delta, className, ...props }: ContactosKPIProps) {
    const [count, setCount] = useState<number>(initialValue);
    const [burst, setBurst] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null); // Cambiado a HTMLDivElement para el <article>

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

    return (
        <article
            ref={cardRef}
            className={`kpi-card ${className || ''}`}
            aria-label={label}
            {...props} // Aquí se aplican `data-key` y otras props
        >
            <div className="kpi-top">
                <span className="kpi-label">{label}</span>
                {delta && <span className="kpi-delta">{delta}</span>}
            </div>
            <div className={`kpi-value ${burst ? 'burst' : ''}`}>
                {count.toLocaleString('es-CO')}
            </div>
        </article>
    );
}