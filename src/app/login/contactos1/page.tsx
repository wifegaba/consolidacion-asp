import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ContactosClient from './Contactos1Client';

// evita cachear la lectura de cookies (si no, puede no ver la sesión)
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';



export default async function Page() {
  const cookieStore = await cookies();
  const ced = cookieStore.get('ced')?.value || '';
  if (!ced) redirect('/login');
  return <ContactosClient cedula={ced} />;
}
