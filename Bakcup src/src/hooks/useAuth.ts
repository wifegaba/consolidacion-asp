// src/hooks/useAuth.ts
'use client';

import { useState, useEffect } from 'react';

// Esta interfaz debe coincidir con la respuesta de /api/me
interface AuthUser {
  isLoggedIn: true;
  servidorId: string;
  cedula: string;
  rol: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): AuthState {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/me');
        if (!response.ok) {
          throw new Error('No autenticado');
        }
        const data = await response.json();
        
        // Almacenamos los datos del usuario en el estado
        setAuth({ user: data, loading: false, error: null });

      } catch (err) {
        // Si falla (401 o error de red), lo marcamos
        setAuth({ user: null, loading: false, error: (err as Error).message });
      }
    }

    fetchUser();
  }, []); // Se ejecuta solo una vez al cargar el componente

  return auth;
}