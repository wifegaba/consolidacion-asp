// Archivo: app/panel/contactos/page.tsx
// ¡Este es el Componente de Servidor que carga la ruta!
import { Suspense } from "react";
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// 1. Importa el formulario
import FormularioPersonaNueva from './FormularioPersonaNueva';

// 2. Importa los CSS necesarios
import "../servidores/servidores.css";
import "./contactos.css";

// Importa el cliente de Supabase para CLIENTE (lo usaremos si falla el de servidor)
import { supabase } from "@/lib/supabaseClient"; 
import { getServerSupabase } from '@/lib/supabaseClient';

export const dynamic = "force-dynamic";

/**
 * Obtiene la cédula del JWT en la cookie y busca el servidorId.
 * Esto se ejecuta de forma segura en el servidor.
 */
async function getServidorIdFromCookie(): Promise<string | null> {
  // --- INICIO DE CORRECCIÓN: Lógica de cookies igual a la de Maestros ---
  const cookieStore = await cookies(); // No se usa 'await' aquí
  const token = cookieStore.get('__Host-session')?.value ?? cookieStore.get('session')?.value;
  // --- FIN DE CORRECCIÓN ---

  let cedula: string | undefined = undefined;
  if (token && process.env.JWT_SECRET) {
      try {
          const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
          cedula = String(payload?.cedula || '');
      } catch (err) {
          console.error("Error al verificar JWT:", err);
          return null;
      }
  }

  if (!cedula) {
    console.error("No se encontró cédula en el token JWT.");
    return null;
  }

  // ...
try {
  // 1. Obtenemos una instancia del cliente de SERVIDOR
  const supabaseServer = getServerSupabase(); 

  // 2. Usamos esa instancia para la consulta
  const { data: servidor, error } = await supabaseServer
    .from('servidores')
    .select('id')
    .eq('cedula', cedula)
    .single();

    
    if (error || !servidor) {
      console.error("Error: No se encontró servidor con cédula:", cedula, error);
      return null;
    }

    return servidor.id; // ¡Éxito!

  } catch (e: any) {
    console.error("Error fatal obteniendo servidorId:", e.message);
    return null;
  }
}


// Este es el componente de PÁGINA (Componente de Servidor)
export default async function ContactosPage() {
  
  // 1. Obtenemos el ID del servidor en el servidor
  const servidorId = await getServidorIdFromCookie();

  // 2. Renderiza el formulario (que es 'use client'), 
  //    pasándole el ID como prop.
  //    Suspense es buena práctica por si 'FormularioPersonaNueva'
  //    tiene lógica de carga propia (aunque la quitaremos).
  return (
    <Suspense fallback={<Fallback />}>
      <FormularioPersonaNueva servidorId={servidorId} />
    </Suspense>
  );
}

function Fallback() {
    return (
        <div className="pn-root">
            <div className="formulario-box" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', fontSize: '1.2rem', color: '#444' }}>
                Cargando formulario...
            </div>
        </div>
    );
}