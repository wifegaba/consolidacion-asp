// app/panel/layout.tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import './panel.css'; // ← único CSS para todo el panel (sidebar + content)
import './contactos/contactos.css';
import './servidores/servidores.css';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="app-frame">
            <div className="shell">
                {/* Sidebar fijo */}
                <aside className="sidebar" aria-label="Menú">
                    <div className="brand">
                        <span className="brand-mark" />
                    </div>

                    <nav className="nav">
                        <Link href="/panel" className="nav-item">
                            <span className="nav-dot" />
                            <span className="nav-text">Dashboard</span>
                        </Link>

                        <Link href="/panel/contactos" className="nav-item">
                            <span className="nav-dot" />
                            <span className="nav-text">Nueva Alma</span>
                        </Link>

                        <Link href="/panel/servidores" className="nav-item">
                            <span className="nav-dot" />
                            <span className="nav-text">Servidores</span>
                        </Link>

                        <Link href="/panel/semillas" className="nav-item">
                            <span className="nav-dot" />
                            <span className="nav-text">Semillas</span>
                        </Link>


                            <Link href="/panel/devocionales" className="nav-item">
                                <span className="nav-dot" />
                                <span className="nav-text">Devocionales</span>
                            </Link>

                        <Link href="/panel/restauracion" className="nav-item">
                            <span className="nav-dot" />
                            <span className="nav-text">Restauracion</span>
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
