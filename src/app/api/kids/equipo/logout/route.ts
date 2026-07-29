import { NextResponse } from 'next/server'
import { kidsHubCookieName, kidsStaffCookieName } from '@/lib/kidsStaffAuth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(kidsStaffCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  response.cookies.set(kidsHubCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
