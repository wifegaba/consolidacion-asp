'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Profile = {
  nombre: string
  apellido: string
  foto_url: string | null
  grupo_asignado: string | null
  roles: string[]
}

const ROLE_LABELS: Record<string, string> = {
  'COORDINADOR DE ALBORADA': 'Coordinador de Alboradas',
  'COORDINADOR DE VISITACION': 'Coordinador de Visitación',
  'COORDINADOR DE FONDOS Y EVENTOS': 'Coordinador de Fondos y Eventos',
  'COORDINADOR DE TIMOTEOS': 'Coordinador de Timoteos',
  'COORDINADOR DE MAESTRA AUXILIAR': 'Coordinador de Maestras Auxiliares',
  INTERSESORES: 'Intercesores',
  TIMOTEOS: 'Timoteos',
}

export default function KidsRolePanelPage() {
  const router = useRouter()
  const params = useParams<{ role: string }>()
  const requestedRole = decodeURIComponent(params?.role ?? '').toUpperCase()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    fetch('/api/kids/equipo/me', { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error('Sesión inválida')
        return response.json()
      })
      .then(json => {
        const nextProfile = json.servidor as Profile
        if (!nextProfile.roles.includes(requestedRole)) {
          setDenied(true)
          return
        }
        setProfile(nextProfile)
      })
      .catch(() => router.replace('/login'))
  }, [requestedRole, router])

  if (denied) {
    return (
      <main className="kids-role-shell">
        <section className="kids-role-card">
          <span>Acceso restringido</span>
          <h1>Este rol no está asignado a tu perfil.</h1>
          <button type="button" onClick={() => router.replace('/kids/equipo')}>Volver a Kids</button>
        </section>
        <style>{styles}</style>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="kids-role-shell">
        <div className="kids-role-loader" />
        <style>{styles}</style>
      </main>
    )
  }

  const label = ROLE_LABELS[requestedRole] ?? requestedRole

  return (
    <main className="kids-role-shell">
      <section className="kids-role-card">
        <header>
          <button type="button" onClick={() => router.push('/kids/equipo')} aria-label="Volver">←</button>
          <img src="/asp-kids-logo.png" alt="ASP Kids" />
        </header>
        <div className="kids-role-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="m16 11 2 2 5-5" />
          </svg>
        </div>
        <span>Panel exclusivo Kids</span>
        <h1>{label}</h1>
        <p>
          Acceso activo para {profile.nombre} {profile.apellido}.
          {profile.grupo_asignado ? ` Grupo asignado: ${profile.grupo_asignado}.` : ''}
        </p>
        <div className="kids-role-status">
          <i />
          Rol verificado y habilitado
        </div>
        <button type="button" className="kids-role-home" onClick={() => router.push('/kids/equipo')}>
          Ver todos mis paneles
        </button>
      </section>
      <style>{styles}</style>
    </main>
  )
}

const styles = `
  * { box-sizing: border-box; }
  .kids-role-shell {
    min-height: 100dvh; display: grid; place-items: center; padding: 16px;
    background:
      radial-gradient(circle at 8% 4%, rgba(45,212,191,.36), transparent 34%),
      radial-gradient(circle at 92% 90%, rgba(124,58,237,.3), transparent 36%),
      linear-gradient(145deg,#dffaf3,#f0ecff 55%,#e4f5ff);
    color: #172033; font-family: Inter,ui-sans-serif,system-ui,sans-serif;
  }
  .kids-role-card {
    width: min(100%, 560px); padding: clamp(20px,5vw,42px); border: 1px solid rgba(255,255,255,.95);
    border-radius: 32px; background: linear-gradient(145deg,rgba(255,255,255,.86),rgba(237,245,252,.64));
    box-shadow: 0 35px 90px rgba(43,56,91,.18), inset 0 1px #fff; text-align: center; backdrop-filter: blur(24px);
  }
  .kids-role-card header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .kids-role-card header button {
    width: 42px; height: 42px; border: 1px solid rgba(72,86,115,.1); border-radius: 14px;
    background: rgba(255,255,255,.78); color: #59677f; font-size: 20px; cursor: pointer;
  }
  .kids-role-card header img { width: 58px; height: 58px; object-fit: contain; }
  .kids-role-icon {
    width: 88px; height: 88px; display: grid; place-items: center; margin: 0 auto 20px; border-radius: 28px;
    background: linear-gradient(145deg,#0f9b8e,#6952d9); box-shadow: 0 18px 42px rgba(44,89,128,.28); color: white;
  }
  .kids-role-icon svg { width: 45px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .kids-role-card > span { color: #0f9b8e; font-size: 10px; font-weight: 900; letter-spacing: .17em; text-transform: uppercase; }
  .kids-role-card h1 { margin: 7px 0 11px; font-size: clamp(28px,7vw,45px); line-height: 1.05; letter-spacing: -.05em; }
  .kids-role-card p { max-width: 430px; margin: 0 auto; color: #68758d; font-size: 13px; line-height: 1.6; }
  .kids-role-status {
    width: fit-content; display: flex; align-items: center; gap: 8px; margin: 24px auto; padding: 9px 13px;
    border: 1px solid rgba(15,155,142,.18); border-radius: 999px; background: rgba(223,250,243,.7);
    color: #08796e; font-size: 11px; font-weight: 800;
  }
  .kids-role-status i { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.13); }
  .kids-role-home, .kids-role-card > button {
    min-height: 46px; padding: 0 22px; border: 0; border-radius: 15px; background: linear-gradient(135deg,#0f9b8e,#6952d9);
    box-shadow: 0 12px 28px rgba(70,73,155,.22); color: white; font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;
  }
  .kids-role-loader { width: 42px; height: 42px; border: 3px solid rgba(15,155,142,.18); border-top-color: #0f9b8e; border-radius: 50%; animation: roleSpin .8s linear infinite; }
  @keyframes roleSpin { to { transform: rotate(360deg); } }
`
