import Image from 'next/image';
import PanelNavigation from './PanelNavigation';

import './panel.css'; // ← único CSS para todo el panel (sidebar + content)
import './contactos/contactos.css';
import './servidores/servidores.css';
import './consolidation.css';

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
        <main className="app-frame consolidation-frame">
            <div className="shell">
                <aside className="sidebar" aria-label="Menú de Consolidación">
                    <div className="sidebar-logo">
                        <Image src="/asp-logo.png" alt="ASP" width={36} height={36} className="logo-circular" />
                        <div className="consolidation-brand nav-text">
                            <span>ASP</span>
                            <strong>Consolidación</strong>
                        </div>
                    </div>
                    <nav className="nav" aria-label="Secciones">
                        <p className="consolidation-nav-caption nav-text">MENÚ PRINCIPAL</p>
                        <PanelNavigation />
                        <div className="consolidation-profile">
                            <LogoutButton isMultiRole={roleCount > 1} />
                        </div>
                    </nav>
                    <div className="sidebar-footer">
                        <div className="consolidation-credit">
                            <Image src="/wf-logo.png" alt="" width={34} height={34} />
                            <div className="consolidation-credit-meta nav-text">
                                <span>© 2025 Designed by</span>
                                <strong>WF SYSTEM</strong>
                            </div>
                        </div>
                    </div>
                </aside>
                <section className="surface">{children}</section>
            </div>
        </main>
    );
}
