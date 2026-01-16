import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();

  // Eliminar cookies de sesión
  cookieStore.delete('__Host-session');
  cookieStore.delete('session');

  return NextResponse.json({ success: true });
}
