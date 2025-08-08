'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Pencil } from 'lucide-react';
import './MenuPrincipal.css';

// ✅ Declarar los props que recibe este componente
interface MenuPrincipalProps {
  onRegistrarEstudiante: () => void;
}



// ✅ Tipar correctamente el componente para que reconozca la prop
const MenuPrincipal: React.FC<MenuPrincipalProps> = ({ onRegistrarEstudiante }) => {
  const router = useRouter();

  return (
    <>


      <div className="pantalla">
        {/* Logo arriba */}
        <section className="panel-logo">
          <img src="/images/logo-n2ncu.png" alt="Logo N2NCU" className="logo-n2ncu" />
        </section>

        {/* Tarjetas */}
        <section className="panel-tarjetas">
          {/* 👉 Este botón ejecuta la función recibida por props */}
          <div className="tarjeta" onClick={onRegistrarEstudiante}>
            <UserPlus size={60} />
            <h2>Registrar Estudiante</h2>
          </div>

          {/* 👉 Este botón sí navega a otra página */}
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
