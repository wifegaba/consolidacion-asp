import { jwtVerify, type JWTPayload } from 'jose'
import type { NextRequest } from 'next/server'

export const KIDS_STAFF_ROLES = [
  'COORDINADOR DE CLASE',
  'MAESTRO',
  'MAESTRO AUXILIAR',
] as const

export type KidsStaffRole = (typeof KIDS_STAFF_ROLES)[number]

export const KIDS_HUB_ROLES = [
  'ADMINISTRADOR',
  'COORDINADOR DE CLASE',
  'COORDINADOR DE ALBORADA',
  'COORDINADOR DE VISITACION',
  'COORDINADOR DE FONDOS Y EVENTOS',
  'COORDINADOR DE TIMOTEOS',
  'COORDINADOR DE MAESTRA AUXILIAR',
  'MAESTRO',
  'MAESTRO AUXILIAR',
  'INTERSESORES',
  'TIMOTEOS',
] as const

export type KidsHubRole = (typeof KIDS_HUB_ROLES)[number]

export type KidsStaffPayload = JWTPayload & {
  tipo: 'kids_staff'
  rol: 'equipo'
  id: string
  cedula: string
  nombre: string
  apellido: string
  foto_url: string | null
  grupo: string | null
  roles: KidsStaffRole[]
}

export type KidsHubPayload = JWTPayload & {
  tipo: 'kids_hub'
  rol: 'equipo_kids'
  id: string
  cedula: string
  nombre: string
  apellido: string
  foto_url: string | null
  grupo: string | null
  roles: KidsHubRole[]
}

export function kidsStaffCookieName() {
  return process.env.NODE_ENV === 'production'
    ? '__Host-kids-staff-session'
    : 'kids_staff_session'
}

export function kidsHubCookieName() {
  return process.env.NODE_ENV === 'production'
    ? '__Host-kids-hub-session'
    : 'kids_hub_session'
}

export function normalizeKidsRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
}

export function allowedKidsStaffRoles(roles: unknown): KidsStaffRole[] {
  if (!Array.isArray(roles)) return []
  const allowed = new Set<string>(KIDS_STAFF_ROLES)
  return Array.from(
    new Set(
      roles
        .filter((role): role is string => typeof role === 'string')
        .map(normalizeKidsRole)
        .filter((role): role is KidsStaffRole => allowed.has(role)),
    ),
  )
}

export function allowedKidsHubRoles(roles: unknown): KidsHubRole[] {
  if (!Array.isArray(roles)) return []
  const allowed = new Set<string>(KIDS_HUB_ROLES)
  return Array.from(
    new Set(
      roles
        .filter((role): role is string => typeof role === 'string')
        .map(normalizeKidsRole)
        .filter((role): role is KidsHubRole => allowed.has(role)),
    ),
  )
}

export async function getKidsStaffSession(req: NextRequest) {
  const secret = process.env.JWT_SECRET
  const token = req.cookies.get(kidsStaffCookieName())?.value
  if (!secret || !token) return null

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    )
    if (
      payload.tipo !== 'kids_staff'
      || payload.rol !== 'equipo'
      || typeof payload.id !== 'string'
    ) {
      return null
    }

    const roles = allowedKidsStaffRoles(payload.roles)
    if (roles.length === 0) return null

    return {
      ...payload,
      roles,
    } as KidsStaffPayload
  } catch {
    return null
  }
}

export async function getKidsHubSession(req: NextRequest) {
  const secret = process.env.JWT_SECRET
  const token = req.cookies.get(kidsHubCookieName())?.value
  if (!secret || !token) return null

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    if (
      payload.tipo !== 'kids_hub'
      || payload.rol !== 'equipo_kids'
      || typeof payload.id !== 'string'
    ) {
      return null
    }

    const roles = allowedKidsHubRoles(payload.roles)
    if (roles.length === 0) return null
    return { ...payload, roles } as KidsHubPayload
  } catch {
    return null
  }
}
