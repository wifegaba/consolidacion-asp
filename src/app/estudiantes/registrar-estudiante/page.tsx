'use client';

import { useState } from 'react';
import MenuPrincipal from '@/components/MenuPrincipal';
import RegistroEstudiante from '@/components/RegistroEstudiante';

export default function Home() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const handleMostrarFormulario = () => {
    setMostrarFormulario(true);
  };

  return (
    <>
      {!mostrarFormulario && <MenuPrincipal onRegistrarEstudiante={handleMostrarFormulario} />}
      {mostrarFormulario && <RegistroEstudiante />}
    </>
  );
}
