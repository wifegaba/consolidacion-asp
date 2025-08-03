'use client';

import { useRouter } from 'next/navigation';
import { UserPlus, Pencil } from 'lucide-react';
import './MenuPrincipal.css';

const MenuPrincipal = () => {
  const router = useRouter();

  return (
    <>
      <div className="fondo" />

      <div className="pantalla">
        {/* Logo arriba */}
        <section className="panel-logo">
          <img src="/images/logo-n2ncu.png" alt="Logo N2NCU" className="logo-n2ncu" />
        </section>

        {/* Tarjetas */}
        <section className="panel-tarjetas">
          <div className="tarjeta" onClick={() => router.push('/registrar-estudiante')}>
            <UserPlus size={60} />
            <h2>Registrar Estudiante</h2>
          </div>

          <div className="tarjeta" onClick={() => router.push('/asignar-notas')}>
            <Pencil size={60} />
            <h2>Asignar Notas</h2>
          </div>
        </section>

        {/* Footer */}
        <footer className="creditos">
          <p>Designed <strong>WFSYSTEM S.I</strong></p>
        </footer>
      </div>
    </>
  );
};

export default MenuPrincipal;
