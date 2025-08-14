'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Pencil, Cog } from 'lucide-react';
import './MenuPrincipal.css';

export default function MenuPrincipal() {
  const router = useRouter();
  const [showDev, setShowDev] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // DOCENTES → abre la pantalla que sí tiene sidebar + contenido
  const handleDocentes = () => {
    router.push('/estudiantes');
  };

  // Accesible con Enter/Espacio
  const keyActivate =
      (fn: () => void) =>
          (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fn();
            }
          };

  // Overlay: Escape para cerrar y foco al botón
  useEffect(() => {
    if (!showDev) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDev(false);
    };
    window.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [showDev]);

  return (
      <>
        <div className="pantalla">
          {/* Logo */}
          <section className="panel-logo">
            <img src="/images/logo-n2ncu.png" alt="N2NCU" className="logo-n2ncu" />
          </section>

          {/* Tarjetas */}
          <section className="panel-tarjetas">
            {/* DOCENTES → /estudiantes */}
            <div
                className="tarjeta"
                role="button"
                tabIndex={0}
                onClick={handleDocentes}
                onKeyDown={keyActivate(handleDocentes)}
                aria-label="Abrir módulo Docentes"
            >
              <UserPlus size={56} aria-hidden />
              <h2>Docentes</h2>
            </div>

            {/* ESTUDIANTES → overlay “En desarrollo” */}
            <div
                className="tarjeta"
                role="button"
                tabIndex={0}
                onClick={() => setShowDev(true)}
                onKeyDown={keyActivate(() => setShowDev(true))}
                aria-label="Sección Estudiantes en desarrollo"
            >
              <Pencil size={56} aria-hidden />
              <h2>Estudiantes</h2>
            </div>
          </section>

          {/* Footer */}
          <footer className="creditos">
            <p>Designed <strong>WFSYSTEM S.I</strong></p>
          </footer>
        </div>

        {/* Overlay En desarrollo */}
        {showDev && (
            <div
                className="dev-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dev-title"
                aria-describedby="dev-desc"
                onClick={() => setShowDev(false)}



            >
              <div className="dev-card" onClick={(e) => e.stopPropagation()}>
                <Cog className="dev-gear spin" size={72} aria-hidden />
                <div id="dev-title" className="dev-title">En desarrollo</div>
                <p id="dev-desc" className="dev-desc">Esta sección estará disponible pronto.</p>
                <button
                    ref={closeBtnRef}
                    className="dev-btn"
                    onClick={() => setShowDev(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
        )}
      </>
  );
}




