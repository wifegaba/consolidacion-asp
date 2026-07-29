import { NextResponse, type NextRequest } from 'next/server'
import { getKidsHubSession } from '@/lib/kidsStaffAuth'

export async function GET(req: NextRequest) {
  const session = await getKidsHubSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    servidor: {
      id: session.id,
      cedula: session.cedula,
      nombre: session.nombre,
      apellido: session.apellido,
      foto_url: session.foto_url,
      grupo_asignado: session.grupo,
      roles: session.roles,
    },
  })
}
