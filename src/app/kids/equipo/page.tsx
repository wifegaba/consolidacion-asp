'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type StaffProfile = {
  id: string
  nombre: string
  apellido: string
  foto_url: string | null
  grupo_asignado: string | null
  roles: string[]
}

const PANEL_META: Record<string, { label: string; description: string; color: string }> = {
  ADMINISTRADOR: {
    label: 'Administración Kids',
    description: 'Gestión completa del ministerio, servidores, niños y agenda.',
    color: '#6941d7',
  },
  'COORDINADOR DE ALBORADA': {
    label: 'Coordinador de Alboradas',
    description: 'Acceso exclusivo a la coordinación de alboradas.',
    color: '#f28c28',
  },
  'COORDINADOR DE VISITACION': {
    label: 'Coordinador de Visitación',
    description: 'Acceso exclusivo a la coordinación de visitación.',
    color: '#1688d4',
  },
  'COORDINADOR DE FONDOS Y EVENTOS': {
    label: 'Coordinador de Fondos y Eventos',
    description: 'Organización de fondos, actividades y eventos Kids.',
    color: '#c33d8e',
  },
  'COORDINADOR DE TIMOTEOS': {
    label: 'Coordinador de Timoteos',
    description: 'Coordinación y seguimiento de los equipos de Timoteos.',
    color: '#0f9b8e',
  },
  'COORDINADOR DE MAESTRA AUXILIAR': {
    label: 'Coordinador de Maestras Auxiliares',
    description: 'Acompañamiento al equipo de maestras auxiliares.',
    color: '#8b5cf6',
  },
  INTERSESORES: {
    label: 'Intercesores',
    description: 'Acceso al equipo de intercesión del ministerio Kids.',
    color: '#d45f85',
  },
  TIMOTEOS: {
    label: 'Timoteos',
    description: 'Acceso al equipo y asignaciones de Timoteos.',
    color: '#1688d4',
  },
}

const TEACHING_ROLES = new Set(['COORDINADOR DE CLASE', 'MAESTRO', 'MAESTRO AUXILIAR'])

export default function KidsEquipoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/kids/equipo/me', { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error('Sesión no válida')
        return response.json()
      })
      .then(json => setProfile(json.servidor))
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function logout() {
    await Promise.allSettled([
      fetch('/api/kids/equipo/logout', { method: 'POST' }),
      fetch('/api/logout', { method: 'POST' }),
    ])
    router.replace('/login')
  }

  if (loading || !profile) {
    return (
      <main className="kids-staff-loading">
        <div className="kids-staff-spinner" />
        <p>Preparando tu panel Kids…</p>
        <style>{styles}</style>
      </main>
    )
  }

  const firstName = profile.nombre.split(' ')[0]
  const panels: Array<{
    key: string
    label: string
    description: string
    color: string
    eyebrow: string
    href: string
  }> = []

  if (profile.roles.some(role => TEACHING_ROLES.has(role))) {
    panels.push({
      key: 'panel-kids',
      label: 'Panel Kids',
      description: 'Tarjetas de niños y registro de asistencia del día.',
      color: '#0f9b8e',
      eyebrow: profile.roles.filter(role => TEACHING_ROLES.has(role)).join(' · '),
      href: '/kids/ninos',
    })
  }

  profile.roles.forEach(role => {
    if (TEACHING_ROLES.has(role)) return
    const meta = PANEL_META[role]
    if (!meta) return
    panels.push({
      key: role,
      ...meta,
      eyebrow: role === 'ADMINISTRADOR' ? 'Panel administrativo' : 'Rol asignado',
      href: role === 'ADMINISTRADOR'
        ? '/kids/admin'
        : `/kids/equipo/rol/${encodeURIComponent(role)}`,
    })
  })

  return (
    <main className="kids-staff-shell">
      <div className="kids-staff-orb kids-staff-orb-a" />
      <div className="kids-staff-orb kids-staff-orb-b" />

      <section className="kids-staff-panel">
        <header className="kids-staff-header">
          <div className="kids-staff-brand">
            <div className="kids-staff-logo">
              <img src="/asp-kids-logo.png" alt="ASP Kids" />
            </div>
            <div>
              <span>ASP Kids</span>
              <strong>Equipo de clase</strong>
            </div>
          </div>
          <button type="button" className="kids-staff-logout" onClick={logout}>
            Salir
          </button>
        </header>

        <div className="kids-staff-welcome">
          <div className="kids-staff-avatar">
            {profile.foto_url ? (
              <img src={profile.foto_url} alt={`${profile.nombre} ${profile.apellido}`} />
            ) : (
              <span>{profile.nombre[0]}{profile.apellido[0]}</span>
            )}
          </div>
          <div>
            <p>Bienvenido al equipo</p>
            <h1>Hola, {firstName}</h1>
            <span>{profile.grupo_asignado || 'Ministerio Kids'}</span>
          </div>
        </div>

        <section className="kids-staff-access" aria-labelledby="access-title">
          <div className="kids-staff-section-title">
            <div>
              <span>Centro de acceso Kids</span>
              <h2 id="access-title">
                {panels.length > 1 ? 'Selecciona uno de tus paneles' : 'Tu panel disponible'}
              </h2>
            </div>
            <b>{panels.length}</b>
          </div>

          <div className="kids-staff-access-grid">
            {panels.map(panel => (
              <button
                type="button"
                key={panel.key}
                className="kids-staff-access-card"
                style={{ '--panel-color': panel.color } as React.CSSProperties}
                onClick={() => router.push(panel.href)}
              >
                <div className="kids-staff-access-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="8" r="4" />
                    <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
                    <path d="M16 11a4 4 0 0 1 5 4v2" />
                  </svg>
                </div>
                <div>
                  <span>{panel.eyebrow}</span>
                  <strong>{panel.label}</strong>
                  <p>{panel.description}</p>
                </div>
                <div className="kids-staff-arrow">→</div>
              </button>
            ))}
          </div>
        </section>
      </section>
      <style>{styles}</style>
    </main>
  )
}

const styles = `
  * { box-sizing: border-box; }
  .kids-staff-shell, .kids-staff-loading {
    min-height: 100dvh;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #172033;
  }
  .kids-staff-shell {
    position: relative;
    overflow: hidden;
    padding: clamp(14px, 3vw, 34px);
    background: linear-gradient(145deg, #d9fbf2 0%, #eef0ff 52%, #e2f3ff 100%);
  }
  .kids-staff-orb { position: fixed; border-radius: 50%; filter: blur(38px); pointer-events: none; }
  .kids-staff-orb-a { width: 320px; height: 320px; top: -130px; left: -100px; background: rgba(20,184,166,.32); }
  .kids-staff-orb-b { width: 360px; height: 360px; right: -170px; bottom: -120px; background: rgba(124,58,237,.22); }
  .kids-staff-panel { position: relative; z-index: 1; width: min(100%, 1040px); margin: 0 auto; }
  .kids-staff-header {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    margin-bottom: 24px;
  }
  .kids-staff-brand { display: flex; align-items: center; gap: 11px; }
  .kids-staff-brand div:last-child { display: flex; flex-direction: column; }
  .kids-staff-brand span { color: #718096; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
  .kids-staff-brand strong { font-size: 17px; letter-spacing: -.02em; }
  .kids-staff-logo {
    width: 51px; height: 51px; display: grid; place-items: center; border-radius: 17px;
    background: rgba(255,255,255,.82); border: 1px solid rgba(255,255,255,.9);
    box-shadow: 0 10px 28px rgba(33,59,95,.12), inset 0 1px #fff;
  }
  .kids-staff-logo img { width: 43px; height: 43px; object-fit: contain; }
  .kids-staff-logout {
    min-height: 42px; padding: 0 18px; border: 1px solid rgba(220,38,38,.13); border-radius: 999px;
    background: rgba(255,255,255,.64); color: #dc2626; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
  }
  .kids-staff-welcome {
    display: flex; align-items: center; gap: 17px; padding: clamp(20px, 4vw, 34px);
    border: 1px solid rgba(255,255,255,.92); border-radius: 30px;
    background: linear-gradient(120deg, rgba(255,255,255,.82), rgba(245,249,255,.57));
    box-shadow: 0 26px 70px rgba(47,61,99,.13), inset 0 1px #fff;
    backdrop-filter: blur(24px);
  }
  .kids-staff-avatar {
    width: 76px; height: 76px; display: grid; flex: 0 0 76px; place-items: center; overflow: hidden;
    border: 4px solid white; border-radius: 24px; background: linear-gradient(145deg,#0f9b8e,#7c3aed);
    box-shadow: 0 12px 25px rgba(77,70,151,.2); color: white; font-size: 22px; font-weight: 900;
  }
  .kids-staff-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .kids-staff-welcome p { margin: 0 0 3px; color: #0f9b8e; font-size: 12px; font-weight: 800; }
  .kids-staff-welcome h1 { margin: 0; font-size: clamp(27px, 5vw, 42px); line-height: 1; letter-spacing: -.05em; }
  .kids-staff-welcome div:last-child > span { display: inline-block; margin-top: 9px; color: #68758d; font-size: 13px; font-weight: 650; }
  .kids-staff-roles, .kids-staff-access { margin-top: 28px; }
  .kids-staff-section-title { display: flex; align-items: end; justify-content: space-between; margin: 0 3px 12px; }
  .kids-staff-section-title span { color: #718096; font-size: 10px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; }
  .kids-staff-section-title h2 { margin: 2px 0 0; font-size: 21px; letter-spacing: -.035em; }
  .kids-staff-section-title b {
    min-width: 32px; height: 32px; display: grid; place-items: center; border-radius: 11px;
    background: rgba(255,255,255,.7); color: #7c3aed; box-shadow: inset 0 1px #fff;
  }
  .kids-staff-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .kids-staff-role-card {
    position: relative; display: grid; grid-template-columns: 48px minmax(0,1fr); align-items: center; gap: 12px;
    min-height: 112px; padding: 17px; overflow: hidden; border: 1px solid rgba(255,255,255,.88); border-radius: 23px;
    background: rgba(255,255,255,.64); box-shadow: 0 13px 35px rgba(45,60,91,.09), inset 0 1px #fff;
  }
  .kids-staff-role-card::before { position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--role-color); content: ""; }
  .kids-staff-role-icon {
    width: 48px; height: 48px; display: grid; place-items: center; border-radius: 16px;
    background: color-mix(in srgb, var(--role-color) 12%, white); color: var(--role-color);
  }
  .kids-staff-role-icon svg { width: 25px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .kids-staff-role-card h3 { margin: 0 0 4px; font-size: 15px; }
  .kids-staff-role-card p { margin: 0; padding-right: 44px; color: #718096; font-size: 11px; line-height: 1.4; }
  .kids-staff-active { position: absolute; top: 14px; right: 14px; color: #16866f; font-size: 9px; font-weight: 850; text-transform: uppercase; }
  .kids-staff-access-card {
    width: 100%; display: grid; grid-template-columns: 64px minmax(0,1fr) 40px; align-items: center; gap: 15px;
    min-height: 130px; padding: 20px; border: 1px solid rgba(255,255,255,.92); border-radius: 27px;
    background:
      radial-gradient(circle at 96% 0, color-mix(in srgb, var(--panel-color) 14%, transparent), transparent 42%),
      linear-gradient(125deg, rgba(255,255,255,.88), rgba(239,245,252,.68));
    box-shadow: 0 18px 50px color-mix(in srgb, var(--panel-color) 13%, transparent), inset 0 1px #fff;
    color: inherit; text-align: left; cursor: pointer; transition: transform .28s ease, box-shadow .28s ease;
  }
  .kids-staff-access-card:hover { transform: translateY(-3px); box-shadow: 0 24px 58px color-mix(in srgb, var(--panel-color) 19%, transparent), inset 0 1px #fff; }
  .kids-staff-access-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 13px; }
  .kids-staff-access-icon {
    width: 64px; height: 64px; display: grid; place-items: center; border-radius: 21px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--panel-color) 88%, white), var(--panel-color));
    box-shadow: 0 12px 28px color-mix(in srgb, var(--panel-color) 30%, transparent); color: white;
  }
  .kids-staff-access-icon svg { width: 34px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
  .kids-staff-access-card div:nth-child(2) { display: flex; flex-direction: column; }
  .kids-staff-access-card div:nth-child(2) > span { color: var(--panel-color); overflow: hidden; font-size: 9px; font-weight: 850; letter-spacing: .1em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .kids-staff-access-card strong { margin-top: 3px; font-size: 21px; letter-spacing: -.03em; }
  .kids-staff-access-card p { margin: 5px 0 0; color: #68758d; font-size: 12px; }
  .kids-staff-arrow { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: white; color: var(--panel-color); font-size: 20px; }
  .kids-staff-loading { display: grid; place-content: center; justify-items: center; gap: 13px; background: #e6f7f4; color: #536176; font-size: 13px; font-weight: 700; }
  .kids-staff-spinner { width: 38px; height: 38px; border: 3px solid rgba(15,155,142,.16); border-top-color: #0f9b8e; border-radius: 50%; animation: kidsStaffSpin .8s linear infinite; }
  @keyframes kidsStaffSpin { to { transform: rotate(360deg); } }
  @media (max-width: 600px) {
    .kids-staff-shell { padding: 14px 12px 30px; overflow-y: auto; }
    .kids-staff-header { margin-bottom: 15px; }
    .kids-staff-welcome { padding: 19px 16px; border-radius: 24px; }
    .kids-staff-avatar { width: 64px; height: 64px; flex-basis: 64px; border-radius: 20px; }
    .kids-staff-roles, .kids-staff-access { margin-top: 23px; }
    .kids-staff-role-grid { grid-template-columns: 1fr; }
    .kids-staff-access-grid { grid-template-columns: 1fr; }
    .kids-staff-access-card { grid-template-columns: 54px minmax(0,1fr) 34px; gap: 11px; min-height: 122px; padding: 16px 13px; border-radius: 23px; }
    .kids-staff-access-icon { width: 54px; height: 54px; border-radius: 18px; }
    .kids-staff-access-card strong { font-size: 18px; }
    .kids-staff-access-card p { font-size: 11px; line-height: 1.4; }
  }
`
