import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { getKidsHubSession } from './kidsStaffAuth'

export type KidsNinosActor = 'administrator' | 'coordinator' | 'teaching'

const TEACHING_ROLES = new Set([
  'COORDINADOR DE CLASE',
  'MAESTRO',
  'MAESTRO AUXILIAR',
])

async function hasSignedSession(
  req: NextRequest,
  cookieName: string,
  expected: { tipo: string; rol: string },
): Promise<boolean> {
  const token = req.cookies.get(cookieName)?.value
  const secret = process.env.JWT_SECRET
  if (!token || !secret) return false

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return payload.tipo === expected.tipo && payload.rol === expected.rol
  } catch {
    return false
  }
}

/** Identidad mínima para proteger niños, fotos y operaciones destructivas. */
export async function getKidsNinosActor(req: NextRequest): Promise<KidsNinosActor | null> {
  const isProd = process.env.NODE_ENV === 'production'
  const adminCookie = isProd ? '__Host-kids-session' : 'kids_session'
  const coordCookie = isProd ? '__Host-kids-coord-session' : 'kids_coord_session'

  if (await hasSignedSession(req, adminCookie, { tipo: 'kids', rol: 'administrador' })) {
    return 'administrator'
  }
  if (await hasSignedSession(req, coordCookie, { tipo: 'kids_coord', rol: 'coordinador' })) {
    return 'coordinator'
  }

  const hub = await getKidsHubSession(req)
  if (hub?.roles.some(role => TEACHING_ROLES.has(role))) return 'teaching'
  return null
}

export function canCreateKids(actor: KidsNinosActor | null) {
  return actor !== null
}

export function canTakeKidsAttendance(actor: KidsNinosActor | null) {
  return actor !== null
}

export function canDeleteKids(actor: KidsNinosActor | null) {
  return actor === 'administrator' || actor === 'coordinator'
}
