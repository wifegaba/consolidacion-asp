// app/api/logout/route.ts
import { NextResponse } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = isProd ? '__Host-session' : 'session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
