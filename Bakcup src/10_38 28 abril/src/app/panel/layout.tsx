import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Users, Leaf, BookOpen, Heart, User } from 'lucide-react'; // 🔹 nuevos íconos

import './panel.css'; // ← único CSS para todo el panel (sidebar + content)
import './contactos/contactos.css';
import './servidores/servidores.css';

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { LogoutButton } from '@/components/ui/LogoutButton'; // Asegúrate de que el path sea correcto

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
    // --- LÓGICA DE Detección de Roles ---
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === 'production';
    const tokenName = isProd ? '__Host-session' : 'session';
    const token = cookieStore.get(tokenName)?.value;

    let roleCount = 1; // Por defecto asumimos 1 para evitar bloqueo

    if (token && process.env.JWT_SECRET) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
            // Si el token tiene asignaciones (nueva lógica), las contamos
            if (payload.asignaciones && Array.isArray(payload.asignaciones)) {
                roleCount = payload.asignaciones.length;
            } else {
                // FALLBACK: Si es un token antiguo o no tiene asignaciones, 
                // podríamos asumir 1 o intentar una lógica más compleja.
                // Para mantenerlo rápido, asumimos 1 (Logout directo) a menos que sepamos lo contrario.
                // Opcional: Podrías hacer una consulta rápida a BD aquí si es crítico, 
                // pero por rendimiento mejor confiar en el token.
            }
        } catch (e) {
            // Token inválido, no hacemos nada (el middleware o page manejarán la auth)
        }
    }
    // ------------------------------------

    return (
        <main className="app-frame">
            <div className="shell">
                {/* Sidebar fijo */}
                <aside className="sidebar" aria-label="Menú">

                    {/* 🔹 Logo ASP circular estampado */}
                    <div className="sidebar-logo">
                        <Image
                            src="/asp-logo.png"   // Ruta pública desde /public
                            alt="Logo ASP"
                            width={140}   // 🔹 lo agrandamos un poco
                            height={140}
                            className="logo-circular"
                            priority
                        />
                    </div>

                    {/* 🔹 Menú con íconos */}
                    <nav className="nav">
                        <Link href="/panel" className="nav-item">
                            <Home size={18} className="nav-icon" />
                            <span className="nav-text">Dashboard</span>
                        </Link>

                        <Link href="/panel/contactos" className="nav-item">
                            <User size={18} className="nav-icon" />
                            <span className="nav-text">Nueva Alma</span>
                        </Link>

                        <Link href="/panel/servidores" className="nav-item">
                            <Users size={18} className="nav-icon" />
                            <span className="nav-text">Servidores</span>
                        </Link>

                        <Link href="/panel/semillas" className="nav-item">
                            <Leaf size={18} className="nav-icon" />
                            <span className="nav-text">Semillas</span>
                        </Link>

                        <Link href="/panel/devocionales" className="nav-item">
                            <BookOpen size={18} className="nav-icon" />
                            <span className="nav-text">Devocionales</span>
                        </Link>

                        <Link href="/panel/restauracion" className="nav-item">
                            <Heart size={18} className="nav-icon" />
                            <span className="nav-text">Restauración</span>
                        </Link>





                        {/* --- INICIO CAMBIO: Botón Inteligente --- */}
                        {/* Pasamos el flag calculado desde el Server Component */}
                        <LogoutButton isMultiRole={roleCount > 1} />
                        {/* --- FIN CAMBIO --- */}

                    </nav>



                    <div className="sidebar-footer">
                        <div className="user">
                            <Image
                                src="/wf-logo.png"   // 🔹 asegúrate que el archivo exista en /public
                                alt="WF SYSTEM Logo"
                                width={42}
                                height={42}
                                className="avatar-logo"
                            />
                            <div className="user-meta">
                                <span className="user-email">
                                    © 2025 Designed by <br />
                                    <strong>WF SYSTEM</strong>
                                </span>
                            </div>


                        </div>
                    </div>



                </aside>

                {/* Content (renderiza las páginas hijas) */}
                <section className="surface">
                    {children}
                </section>
            </div>
        </main>
    );
}
