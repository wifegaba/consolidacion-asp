import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import jwt from 'jsonwebtoken'
import { getServerSupabase } from '@/lib/supabaseClient'
import {
  allowedKidsHubRoles,
  allowedKidsStaffRoles,
  kidsHubCookieName,
  kidsStaffCookieName,
  type KidsHubRole,
} from '@/lib/kidsStaffAuth'

export async function POST(req: NextRequest) {
  const secret = process.env.JWT_SECRET
  const isProd = process.env.NODE_ENV === 'production'
  const mainCookie = isProd ? '__Host-session' : 'session'
  const adminCookie = isProd ? '__Host-kids-session' : 'kids_session'

  if (!secret) {
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 })
  }

  const mainToken = req.cookies.get(mainCookie)?.value
  if (!mainToken) {
    return NextResponse.json({ error: 'Sesión principal no encontrada.' }, { status: 401 })
  }

  let cedula = ''
  try {
    const { payload } = await jwtVerify(mainToken, new TextEncoder().encode(secret))
    cedula = typeof payload.cedula === 'string' ? payload.cedula : ''
  } catch {
    return NextResponse.json({ error: 'Sesión principal inválida.' }, { status: 401 })
  }
  if (!cedula) {
    return NextResponse.json({ error: 'La sesión no contiene una cédula válida.' }, { status: 401 })
  }

  const cleanCedula = cedula.replace(/\D/g, '')
  const cedulaFilter = `cedula.eq.${cedula}${cleanCedula ? `,cedula.eq.${cleanCedula}` : ''}`
  const supabase = getServerSupabase()
  const [servidorResult, adminResult, coordinadorResult] = await Promise.all([
    supabase
      .from('kids_servidores')
      .select('id, cedula, nombre, apellido, foto_url, grupo_asignado, activo, roles')
      .or(cedulaFilter)
      .maybeSingle(),
    supabase
      .from('kids_administradores')
      .select('id, cedula, nombre, apellido, foto_url, activo')
      .or(cedulaFilter)
      .maybeSingle(),
    supabase
      .from('kids_coordinadores')
      .select('id, cedula, nombre, apellido, foto_url, grupo_asignado, activo')
      .or(cedulaFilter)
      .maybeSingle(),
  ])

  if (servidorResult.error || adminResult.error || coordinadorResult.error) {
    return NextResponse.json({ error: 'No fue posible validar el perfil Kids.' }, { status: 500 })
  }

  const servidor = servidorResult.data
  const admin = adminResult.data
  const coordinador = coordinadorResult.data
  const activeServidor = servidor?.activo === false ? null : servidor
  const activeAdmin = admin?.activo === false ? null : admin
  const activeCoordinador = coordinador?.activo === false ? null : coordinador
  const profile = activeServidor ?? activeAdmin ?? activeCoordinador
  if (!profile) {
    return NextResponse.json({ error: 'No tienes un perfil Kids activo.' }, { status: 403 })
  }

  const roles = allowedKidsHubRoles([
    ...(activeServidor?.roles ?? []),
    ...(activeAdmin ? ['ADMINISTRADOR'] : []),
    ...(activeCoordinador ? ['COORDINADOR DE CLASE'] : []),
  ])
  if (roles.length === 0) {
    return NextResponse.json({ error: 'No tienes roles Kids asignados.' }, { status: 403 })
  }

  const identity = {
    id: activeServidor?.id ?? activeAdmin?.id ?? activeCoordinador!.id,
    cedula: activeServidor?.cedula ?? activeAdmin?.cedula ?? activeCoordinador!.cedula,
    nombre: activeServidor?.nombre ?? activeAdmin?.nombre ?? activeCoordinador!.nombre,
    apellido: activeServidor?.apellido ?? activeAdmin?.apellido ?? activeCoordinador!.apellido,
    foto_url: activeServidor?.foto_url ?? activeAdmin?.foto_url ?? activeCoordinador?.foto_url ?? null,
    grupo: activeServidor?.grupo_asignado ?? activeCoordinador?.grupo_asignado ?? null,
  }

  const hubToken = jwt.sign(
    {
      tipo: 'kids_hub',
      rol: 'equipo_kids',
      ...identity,
      roles,
    },
    secret,
    { expiresIn: '8h' },
  )

  const response = NextResponse.json({ ok: true, redirect: '/kids/equipo' })
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 8,
    path: '/',
  }
  response.cookies.set(kidsHubCookieName(), hubToken, cookieOptions)

  const staffRoles = allowedKidsStaffRoles(roles)
  if (staffRoles.length > 0) {
    const staffToken = jwt.sign(
      {
        tipo: 'kids_staff',
        rol: 'equipo',
        ...identity,
        roles: staffRoles,
      },
      secret,
      { expiresIn: '8h' },
    )
    response.cookies.set(kidsStaffCookieName(), staffToken, cookieOptions)
  }

  if (roles.includes('ADMINISTRADOR' as KidsHubRole)) {
    const adminToken = jwt.sign(
      {
        tipo: 'kids',
        rol: 'administrador',
        id: identity.id,
        cedula: identity.cedula,
        nombre: identity.nombre,
        apellido: identity.apellido,
        foto_url: identity.foto_url,
      },
      secret,
      { expiresIn: '8h' },
    )
    response.cookies.set(adminCookie, adminToken, cookieOptions)
  }

  return response
}
