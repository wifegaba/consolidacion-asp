import { cookies } from 'next/headers';
import BienvenidaClient from './BienvenidaClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function Page() {
  const cookieStore = await cookies();
  const cedula = cookieStore.get('ced')?.value || '';
  return <BienvenidaClient cedula={cedula} />;
}
