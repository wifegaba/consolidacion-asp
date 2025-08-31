import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Users, Leaf, BookOpen, Heart, User } from 'lucide-react'; // 🔹 nuevos íconos

import './panel.css'; // ← único CSS para todo el panel (sidebar + content)
import './contactos/contactos.css';
import './servidores/servidores.css';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
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

                        <Link href="/panel/login" className="nav-item">
                            <Heart size={18} className="nav-icon" />
                            <span className="nav-text">Login Servidores</span>
                        </Link>


                    </nav>



                    <div className="sidebar-footer">
                        <div className="user">
                            <div className="avatar" />
                            <div className="user-meta">
                                <span className="user-name">WF System</span>
                                <span className="user-email">admin@wf.system</span>
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
