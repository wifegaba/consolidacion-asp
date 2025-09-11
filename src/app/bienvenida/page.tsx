import { cookies } from 'next/headers';
import BienvenidaClient from './BienvenidaClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function Page() {
  const cedula = cookies().get('ced')?.value || '';
  return <BienvenidaClient cedula={cedula} />;
}
