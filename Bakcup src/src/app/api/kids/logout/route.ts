// src/app/api/kids/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const isProd     = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-kids-session' : 'kids_session';

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, '', {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });

  return res;
}
