'use client';

import { LogOut, ArrowLeftCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface LogoutButtonProps {
    isMultiRole: boolean;
    className?: string; // Para personalización adicional si es necesario
    iconClassName?: string;
    textClassName?: string;
}

export function LogoutButton({ isMultiRole, className = '', iconClassName = '', textClassName = 'nav-text' }: LogoutButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleAction = async () => {
        if (loading) return;
        setLoading(true);

        if (isMultiRole) {
            // Si tiene múltiples roles, redirigimos al portal para cambiar
            router.push('/login/portal');
        } else {
            // Si es un solo rol, cerramos sesión completamente
            try {
                await fetch('/api/logout', { method: 'POST' }); // Asumiendo que existe o lo crearemos
                router.refresh();
                router.push('/login');
            } catch (error) {
                console.error('Error al salir:', error);
                // Fallback
                window.location.href = '/login';
            }
        }
    };

    return (
        <button
            onClick={handleAction}
            disabled={loading}
            className={`nav-item w-full text-left bg-transparent border-0 cursor-pointer ${className} ${loading ? 'opacity-50' : ''}`}
            aria-label={isMultiRole ? "Cambiar Perfil" : "Cerrar Sesión"}
        >
            {isMultiRole ? (
                <ArrowLeftCircle size={18} className={`nav-icon ${iconClassName || 'text-blue-300'}`} />
            ) : (
                <LogOut size={18} className={`nav-icon ${iconClassName || 'text-red-300'}`} />
            )}
            <span className={textClassName}>
                {loading ? 'Procesando...' : (isMultiRole ? 'Cambiar Perfil' : 'Salir')}
            </span>
        </button>
    );
}
