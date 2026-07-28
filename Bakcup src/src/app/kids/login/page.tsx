// El login de Kids está unificado con el login principal del sistema.
// Esta ruta redirige automáticamente para evitar confusión.
import { redirect } from 'next/navigation';

export default function KidsLoginPage() {
  redirect('/login');
}
