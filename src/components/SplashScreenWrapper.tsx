'use client';

import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';

export default function SplashScreenWrapper({ children }: { children: React.ReactNode }) {
    const [showSplash, setShowSplash] = useState(true);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    useEffect(() => {
        // Verificar si es la primera carga de la sesión
        const hasShownSplash = sessionStorage.getItem('splashShown');

        if (hasShownSplash) {
            setShowSplash(false);
            setIsFirstLoad(false);
        } else {
            // Marcar que ya se mostró el splash en esta sesión
            sessionStorage.setItem('splashShown', 'true');

            // Ocultar el splash después de 4 segundos
            const timer = setTimeout(() => {
                setShowSplash(false);
            }, 4000);

            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <>
            {isFirstLoad && showSplash && <SplashScreen />}
            {children}
        </>
    );
}
