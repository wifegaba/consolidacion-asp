'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { type KidsMaestro }     from '../admin/components/MaestroModal'
import { type KidsCoordinador } from '../admin/components/CoordinadorModal'
import ObservacionesModal       from '../admin/components/ObservacionesModal'

/* ── Gradients for avatar fallbacks ────────────────────────────────────── */
const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#f43f5e,#ec4899)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#f97316)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
]

/* ════════════════════════════════════════════════════════════════════════════
   Panel Coordinador
════════════════════════════════════════════════════════════════════════════ */
export default function CoordinadorPage() {
  const router = useRouter()

  const [coord,        setCoord]      = useState<KidsCoordinador | null>(null)
  const [maestros,     setMaestros]   = useState<KidsMaestro[]>([])
  const [obsCounts,    setObsCounts]  = useState<Record<string, number>>({})
  const [obsModal,     setObsModal]   = useState<KidsMaestro | null>(null)
  const [loading,      setLoading]    = useState(true)
  const [isMobile,     setIsMobile]   = useState(false)
  const [logoNavOpen,  setLogoNavOpen] = useState(false)
  const [logoPressed,  setLogoPressed] = useState(false)

  /* ── Responsive ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── Cargar identidad + maestros ── */
  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/kids/coordinador/me')
        if (meRes.status === 401 || meRes.status === 403) {
          router.replace('/login')
          return
        }
        const meJson = await meRes.json()
        if (!meJson.ok) { router.replace('/login'); return }

        const coordData: KidsCoordinador = meJson.coordinador
        setCoord(coordData)

        if (coordData.grupo_asignado) {
          const [mRes, oRes] = await Promise.all([
            fetch(`/api/kids/maestros?grupo=${encodeURIComponent(coordData.grupo_asignado)}`),
            fetch(`/api/kids/observaciones?grupo=${encodeURIComponent(coordData.grupo_asignado)}`),
          ])
          const mJson = await mRes.json()
          if (mJson.ok) setMaestros(mJson.data)

          const oJson = await oRes.json()
          if (oJson.ok) buildCounts(oJson.data)
        }
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  function buildCounts(data: { maestro_id: string }[]) {
    const counts: Record<string, number> = {}
    data.forEach(o => { counts[o.maestro_id] = (counts[o.maestro_id] ?? 0) + 1 })
    setObsCounts(counts)
  }

  /* ── Recargar conteo al cerrar modal ── */
  const refreshCounts = useCallback(async () => {
    if (!coord?.grupo_asignado) return
    const res  = await fetch(`/api/kids/observaciones?grupo=${encodeURIComponent(coord.grupo_asignado)}`)
    const json = await res.json()
    if (json.ok) buildCounts(json.data)
  }, [coord?.grupo_asignado])

  /* ── Logout ── */
  async function handleLogout() {
    await fetch('/api/kids/coordinador/logout', { method: 'POST' })
    router.replace('/login')
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <main style={{
        minHeight:'100vh', display:'grid', placeItems:'center',
        background:'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
        fontFamily:"'Segoe UI',system-ui,sans-serif",
      }}>
        <div style={{
          background:'rgba(255,255,255,.28)', backdropFilter:'blur(24px)',
          borderRadius:20, padding:'28px 48px',
          border:'1px solid rgba(255,255,255,.5)',
          fontSize:14, color:'#4c1d95', fontWeight:600,
          boxShadow:'0 8px 32px rgba(139,92,246,.15)',
        }}>
          Cargando panel…
        </div>
      </main>
    )
  }

  if (!coord) return null

  const activeMaestros  = maestros.filter(m => m.activo)
  const inactivoCount   = maestros.length - activeMaestros.length

  return (
    <>
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes coordFadeIn {
          from { opacity:0; transform:translateY(22px) scale(.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);   }
        }
      `}</style>

      <main style={{
        fontFamily:    "'Segoe UI',system-ui,sans-serif",
        minHeight:     '100vh',
        background:    'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
        padding:       isMobile ? 0 : '16px',
        position:      'relative',
        overflow:      'hidden',
      }}>

        {/* ── Decorative orbs ── */}
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'-10%', left:'-4%',  width:340, height:340, borderRadius:'50%', background:'radial-gradient(circle,rgba(13,148,136,.5) 0%,transparent 68%)', filter:'blur(32px)' }}/>
          <div style={{ position:'absolute', bottom:'8%', right:'2%', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,.4) 0%,transparent 68%)', filter:'blur(30px)' }}/>
          <div style={{ position:'absolute', top:'40%', right:'6%',   width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(236,72,153,.28) 0%,transparent 68%)', filter:'blur(24px)' }}/>
          <div style={{ position:'absolute', top:'15%', left:'30%',   width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,.22) 0%,transparent 68%)', filter:'blur(20px)' }}/>
        </div>

        {/* ══════════════════════════════════════════
            LOGO NAV — centrado, items a los lados
        ══════════════════════════════════════════ */}
        <div style={{
          position:  'relative',
          width:     '100%',
          maxWidth:  640,
          height:    110,
          flexShrink: 0,
          zIndex:    10,
        }}>
          {/* Items izquierda: Mi Panel + Salir */}
          {([
            { key: 'coord', label: 'Mi Panel', active: true,  onClick: () => setLogoNavOpen(false) },
            { key: 'salir', label: 'Salir',    active: false, onClick: () => { setLogoNavOpen(false); handleLogout() } },
          ]).map((item, i) => {
            const leftPx = 96 + i * 52
            return (
              <div
                key={item.key}
                onClick={item.onClick}
                style={{
                  position:     'absolute',
                  left:         `calc(50% - ${leftPx}px)`,
                  top:          42,
                  display:      'flex',
                  flexDirection:'column',
                  alignItems:   'center',
                  gap:          4,
                  cursor:       'pointer',
                  pointerEvents: logoNavOpen ? 'auto' : 'none',
                  opacity:      logoNavOpen ? 1 : 0,
                  transform:    logoNavOpen
                    ? 'scale(1) translateX(0)'
                    : `scale(0.4) translateX(${leftPx - 22}px)`,
                  transition: `opacity .26s ${i * 65}ms, transform .30s cubic-bezier(.34,1.56,.64,1) ${i * 65}ms`,
                  zIndex: 1,
                }}
              >
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  background: item.active
                    ? ['linear-gradient(rgba(255,255,255,.96),rgba(255,255,255,.96)) padding-box',
                       'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box'].join(',')
                    : 'rgba(255,255,255,0.92)',
                  border: item.active ? '2px solid transparent' : '2px solid rgba(0,0,0,0.09)',
                  boxShadow: item.active
                    ? '-3px 0 14px rgba(96,165,250,.42), 3px 0 14px rgba(244,114,182,.36), 0 6px 18px rgba(167,139,250,.30), inset 0 1.5px 0 rgba(255,255,255,1)'
                    : '0 3px 12px rgba(0,0,0,0.13)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  backdropFilter:'blur(8px)',
                }}>
                  <CoordNavIcon type="coord" active={item.active} />
                </div>
                <span style={{ fontSize:9, fontWeight:700, color: item.active ? '#7c3aed' : item.key === 'salir' ? '#ef4444' : '#6b7280', whiteSpace:'nowrap' }}>
                  {item.label}
                </span>
              </div>
            )
          })}

          {/* ── Logo central ── */}
          <div
            onPointerDown={() => setLogoPressed(true)}
            onPointerUp={() => { setLogoPressed(false); setLogoNavOpen(v => !v) }}
            onPointerLeave={() => setLogoPressed(false)}
            onPointerCancel={() => setLogoPressed(false)}
            style={{
              position:  'absolute',
              left:      '50%',
              top:       8,
              transform: `translateX(-50%) ${
                logoPressed ? 'scale(0.86)' : logoNavOpen ? 'scale(0.93)' : 'scale(1)'
              }`,
              transition: logoPressed
                ? 'transform .08s ease'
                : 'transform .38s cubic-bezier(.34,1.56,.64,1)',
              cursor: 'pointer',
              zIndex:  2,
              filter:  logoNavOpen
                ? 'drop-shadow(0 0 16px rgba(96,165,250,0.65)) drop-shadow(0 0 14px rgba(244,114,182,0.55)) drop-shadow(0 4px 10px rgba(167,139,250,0.55))'
                : logoPressed
                  ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))'
                  : 'drop-shadow(0 4px 14px rgba(0,0,0,0.18))',
            } as React.CSSProperties}
          >
            <CoordLogoCircle size={96} />
          </div>

          {/* Items derecha: Niños + Asistencias */}
          {([
            { key: 'ninos',        label: 'Niños',   active: false, onClick: () => { setLogoNavOpen(false); router.push('/kids/ninos') } },
            { key: 'asistencias',  label: 'Asist.',  active: false, onClick: () => { setLogoNavOpen(false); router.push('/kids/asistencias') } },
          ]).map((item, i) => {
            const leftPx = 52 + i * 52
            return (
              <div
                key={item.key}
                onClick={item.onClick}
                style={{
                  position:     'absolute',
                  left:         `calc(50% + ${leftPx}px)`,
                  top:          42,
                  display:      'flex',
                  flexDirection:'column',
                  alignItems:   'center',
                  gap:          4,
                  cursor:       'pointer',
                  pointerEvents: logoNavOpen ? 'auto' : 'none',
                  opacity:      logoNavOpen ? 1 : 0,
                  transform:    logoNavOpen
                    ? 'scale(1) translateX(0)'
                    : `scale(0.4) translateX(-${leftPx + 22}px)`,
                  transition: `opacity .26s ${i * 65}ms, transform .30s cubic-bezier(.34,1.56,.64,1) ${i * 65}ms`,
                  zIndex: 1,
                }}
              >
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  background: item.active
                    ? ['linear-gradient(rgba(255,255,255,.96),rgba(255,255,255,.96)) padding-box',
                       'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box'].join(',')
                    : 'rgba(255,255,255,0.92)',
                  border: item.active ? '2px solid transparent' : '2px solid rgba(0,0,0,0.09)',
                  boxShadow: item.active
                    ? '-3px 0 14px rgba(96,165,250,.42), 3px 0 14px rgba(244,114,182,.36), 0 6px 18px rgba(167,139,250,.30), inset 0 1.5px 0 rgba(255,255,255,1)'
                    : '0 3px 12px rgba(0,0,0,0.13)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  backdropFilter:'blur(8px)',
                }}>
                  <CoordNavIcon type={item.key as 'coord' | 'ninos' | 'asistencias' | 'salir'} active={item.active} />
                </div>
                <span style={{ fontSize:9, fontWeight:700, color: item.active ? '#7c3aed' : '#6b7280', whiteSpace:'nowrap' }}>
                  {item.label}
                </span>
              </div>
            )
          })}

          {/* ── Ring indicador activo ── */}
          {logoNavOpen && (
            <div style={{
              position:    'absolute',
              left:        '50%',
              top:         8,
              width:       96,
              height:      96,
              borderRadius:'50%',
              transform:   'translateX(-50%)',
              background: ['linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)) padding-box',
                           'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box'].join(','),
              border:      '2px solid transparent',
              boxShadow:   '-4px 0 18px rgba(96,165,250,.38), 4px 0 18px rgba(244,114,182,.34), 0 0 0 5px rgba(167,139,250,.12)',
              pointerEvents:'none',
              zIndex:       1,
            }}/>
          )}
        </div>

        {/* ── Card container ── */}
        <div style={{
          position:     'relative', zIndex:1,
          width:        '100%',
          maxWidth:     640,
          flex:         isMobile ? 1 : 'none',
          minHeight:    isMobile ? 'auto' : 'calc(100vh - 140px)',
          maxHeight:    isMobile ? 'none' : 'calc(100vh - 140px)',
          display:      'flex',
          flexDirection:'column',
          borderRadius: isMobile ? '20px 20px 0 0' : 28,
          overflow:     'hidden',
          boxShadow:    '0 32px 72px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.55)',
          animation:    'coordFadeIn .42s cubic-bezier(0.25,0.46,0.45,0.94) both',
        }}>

          {/* ══════════════════════════════════════════
              HEADER — gradiente rosa-violeta-índigo
          ══════════════════════════════════════════ */}
          <div style={{
            background:  'linear-gradient(145deg,#f9a8d4 0%,#c084fc 52%,#818cf8 100%)',
            padding:     isMobile ? '22px 20px 18px' : '26px 28px 20px',
            flexShrink:  0,
            borderBottom:'1px solid rgba(255,255,255,.22)',
            boxShadow:   'inset 0 -1px 0 rgba(255,255,255,.15)',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>

              {/* Foto + Datos */}
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <CoordAvatar coord={coord} size={62} />
                <div>
                  <div style={{
                    fontSize:9, fontWeight:700,
                    color:'rgba(255,255,255,.65)', letterSpacing:'2px',
                    textTransform:'uppercase', marginBottom:4,
                  }}>
                    Coordinadora Kids
                  </div>
                  <div style={{
                    fontSize: isMobile ? 16 : 19, fontWeight:800, color:'#fff',
                    lineHeight:1.15, textShadow:'0 1px 6px rgba(0,0,0,.2)',
                  }}>
                    {coord.nombre} {coord.apellido}
                  </div>
                  {coord.grupo_asignado && (
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:6, marginTop:7,
                      background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.42)',
                      padding:'3px 12px', borderRadius:50,
                      fontSize:10, fontWeight:800, color:'#fff',
                      boxShadow:'inset 0 1px 0 rgba(255,255,255,.3)',
                    }}>
                      {/* group icon */}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      {coord.grupo_asignado}
                    </div>
                  )}
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                style={{
                  width:38, height:38, borderRadius:12, flexShrink:0,
                  background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.38)',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all .18s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>

            {/* ── Stats row ── */}
            <div style={{
              display:'flex', gap:8, marginTop:16,
            }}>
              {[
                { label:'Total', val: maestros.length,       color:'rgba(255,255,255,.9)' },
                { label:'Activos', val: activeMaestros.length, color:'#86efac' },
                { label:'Con obs.', val: Object.keys(obsCounts).length, color:'#fde68a' },
              ].map(s => (
                <div key={s.label} style={{
                  flex:1, textAlign:'center',
                  background:'rgba(255,255,255,.15)',
                  border:'1px solid rgba(255,255,255,.28)',
                  borderRadius:12, padding:'8px 4px',
                  backdropFilter:'blur(8px)',
                  boxShadow:'inset 0 1px 0 rgba(255,255,255,.25)',
                }}>
                  <div style={{ fontSize:18, fontWeight:900, color:s.color, lineHeight:1, textShadow:'0 1px 4px rgba(0,0,0,.15)' }}>
                    {s.val}
                  </div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', fontWeight:600, textTransform:'uppercase', letterSpacing:'1.2px', marginTop:3 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════
              BODY — Liquid Glass
          ══════════════════════════════════════════ */}
          <div style={{
            flex:1, minHeight:0,
            background:          'rgba(235,228,255,.72)',
            backdropFilter:      'blur(48px) saturate(210%)',
            WebkitBackdropFilter:'blur(48px) saturate(210%)',
            display:      'flex',
            flexDirection:'column',
            overflow:     'hidden',
          }}>

            {/* Section title bar */}
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding: isMobile ? '16px 18px 12px' : '18px 24px 12px',
              flexShrink:0,
              borderBottom:'1px solid rgba(139,92,246,.15)',
              background:'rgba(255,255,255,.18)',
            }}>
              {/* graduation cap icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <path d="M20 10v4a8 8 0 0 1-16 0v-4"/>
              </svg>
              <span style={{ fontSize:13, fontWeight:700, color:'#4c1d95' }}>
                Maestros asignados
              </span>
              {/* Count badge */}
              <div style={{
                marginLeft:4,
                background:'linear-gradient(135deg,#7c3aed,#c084fc)',
                padding:'2px 10px', borderRadius:50,
                fontSize:10, fontWeight:800, color:'#fff',
                boxShadow:'0 2px 8px rgba(124,58,237,.35)',
              }}>
                {activeMaestros.length}
              </div>
              {inactivoCount > 0 && (
                <div style={{
                  padding:'2px 8px', borderRadius:50,
                  fontSize:9, fontWeight:700,
                  background:'rgba(244,63,94,.1)', border:'1px solid rgba(244,63,94,.22)',
                  color:'#be185d',
                }}>
                  {inactivoCount} inactivo{inactivoCount > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* ── Scrollable maestros list ── */}
            <div style={{
              flex:1, minHeight:0, overflowY:'auto',
              padding: isMobile ? '12px 14px 28px' : '14px 20px 28px',
              display:'flex', flexDirection:'column', gap:9,
            }}>

              {maestros.length === 0 ? (
                <div style={{ textAlign:'center', padding:'52px 0' }}>
                  <div style={{ fontSize:44, marginBottom:12 }}>📚</div>
                  <div style={{ fontSize:14, color:'#6d28d9', fontWeight:700 }}>Sin maestros asignados</div>
                  <div style={{ fontSize:12, color:'#9ca3af', marginTop:6, lineHeight:1.5 }}>
                    Contacta al administrador para asignar maestros a tu grupo
                  </div>
                </div>
              ) : (
                maestros.map((m, idx) => (
                  <MaestroCard
                    key={m.id}
                    m={m}
                    idx={idx}
                    obsCount={obsCounts[m.id] ?? 0}
                    onClick={() => setObsModal(m)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── ObservacionesModal ── */}
        {obsModal && coord && (
          <ObservacionesModal
            maestro={obsModal}
            coordinador={coord}
            onClose={() => {
              setObsModal(null)
              refreshCounts()
            }}
          />
        )}
      </main>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   CoordAvatar
══════════════════════════════════════════════════════════════════════════ */
function CoordAvatar({ coord, size }: { coord: KidsCoordinador; size: number }) {
  const [broken, setBroken] = useState(false)
  const ini     = `${coord.nombre.charAt(0)}${coord.apellido.charAt(0)}`.toUpperCase()
  const showImg = coord.foto_url && !broken

  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      border:'3px solid rgba(255,255,255,.85)',
      boxShadow:'0 0 0 2.5px rgba(251,191,36,.5), 0 4px 16px rgba(0,0,0,.22)',
      overflow:'hidden', flexShrink:0,
      background: showImg ? 'transparent' : 'linear-gradient(135deg,#f472b6,#c084fc)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: Math.round(size * 0.32), fontWeight:800, color:'#fff',
    }}>
      {showImg
        ? <img src={coord.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
            onError={() => setBroken(true)} />
        : ini
      }
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MaestroCard — fila clickeable de maestro (panel coordinador)
══════════════════════════════════════════════════════════════════════════ */
function MaestroCard({
  m, idx, obsCount, onClick,
}: {
  m:        KidsMaestro
  idx:      number
  obsCount: number
  onClick:  () => void
}) {
  const [broken, setBroken] = useState(false)
  const [hov,    setHov]    = useState(false)
  const [hovWa,  setHovWa]  = useState(false)
  const [hovTel, setHovTel] = useState(false)
  const showImg = m.foto_url && !broken
  const ini     = `${m.nombre.charAt(0)}${m.apellido.charAt(0)}`.toUpperCase()
  const hasObs  = obsCount > 0
  const phone   = m.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? ''

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'12px 14px',
        borderRadius:16,
        background:   hov ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.52)',
        border:       `1.5px solid ${hov ? 'rgba(139,92,246,.38)' : 'rgba(139,92,246,.18)'}`,
        backdropFilter:'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
        cursor:'pointer',
        transition:'all .2s cubic-bezier(.4,0,.2,1)',
        boxShadow: hov
          ? '0 6px 20px rgba(124,58,237,.18), inset 0 1px 0 rgba(255,255,255,.8)'
          : '0 2px 8px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.6)',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
        animation: `coordFadeIn .38s ${0.05 + idx * 0.06}s cubic-bezier(0.25,0.46,0.45,0.94) both`,
        opacity: m.activo ? 1 : 0.58,
      }}
    >
      {/* ── Avatar ── */}
      <div style={{
        width:46, height:46, borderRadius:'50%',
        overflow:'hidden', flexShrink:0,
        background: GRADIENTS[idx % GRADIENTS.length],
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14, fontWeight:800, color:'#fff',
        border:'2.5px solid rgba(255,255,255,.85)',
        boxShadow:'0 2px 10px rgba(0,0,0,.15)',
      }}>
        {showImg
          ? <img src={m.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={() => setBroken(true)} />
          : ini
        }
      </div>

      {/* ── Info: nombre + horario + badges ── */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Nombre */}
        <div style={{
          fontSize:13, fontWeight:700, color:'#1e1b4b',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>
          {m.nombre} {m.apellido}
        </div>

        {/* Horario */}
        <div style={{ fontSize:10, color:'#7c3aed', marginTop:2, fontWeight:600 }}>
          {m.horario_servicio ?? 'Sin horario asignado'}
        </div>

        {/* Badges row — debajo del horario */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>

          {/* Contador de observaciones */}
          <div style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'3px 8px', borderRadius:50,
            background: hasObs ? 'rgba(124,58,237,.14)' : 'rgba(156,163,175,.1)',
            border: `1px solid ${hasObs ? 'rgba(124,58,237,.35)' : 'rgba(156,163,175,.22)'}`,
            boxShadow: hasObs ? '0 0 8px rgba(124,58,237,.12)' : 'none',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke={hasObs ? '#7c3aed' : '#9ca3af'} strokeWidth="2.2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span style={{
              fontSize:10, fontWeight:800, lineHeight:1, minWidth:6, textAlign:'center',
              color: hasObs ? '#7c3aed' : '#9ca3af',
            }}>
              {obsCount}
            </span>
          </div>

          {/* Estado activo/inactivo */}
          <div style={{
            padding:'3px 8px', borderRadius:50,
            fontSize:9, fontWeight:700,
            background: m.activo ? 'rgba(16,185,129,.12)' : 'rgba(244,63,94,.1)',
            color:      m.activo ? '#059669'               : '#dc2626',
            border:     `1px solid ${m.activo ? 'rgba(16,185,129,.28)' : 'rgba(244,63,94,.25)'}`,
          }}>
            {m.activo ? 'Activo' : 'Inactivo'}
          </div>
        </div>
      </div>

      {/* ── Acciones: WhatsApp + Llamar ── */}
      {m.telefono && (
        <div style={{ display:'flex', flexDirection:'row', gap:6, flexShrink:0 }}>
          {/* WhatsApp */}
          <a
            href={`https://wa.me/57${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            onMouseEnter={() => setHovWa(true)}
            onMouseLeave={() => setHovWa(false)}
            style={{
              width:34, height:34, borderRadius:10,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:  hovWa ? '#25D366' : 'rgba(37,211,102,.12)',
              border:      `1px solid ${hovWa ? '#25D366' : 'rgba(37,211,102,.35)'}`,
              boxShadow:   hovWa ? '0 0 14px rgba(37,211,102,.45)' : 'none',
              transform:   hovWa ? 'scale(1.08)' : 'scale(1)',
              transition:  'all .18s cubic-bezier(.4,0,.2,1)',
              textDecoration:'none', flexShrink:0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={hovWa ? '#fff' : '#25D366'}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.5l5.797-1.448A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.493-5.183-1.355l-.371-.22-3.441.859.924-3.357-.242-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </a>

          {/* Llamar */}
          <a
            href={`tel:${m.telefono}`}
            onClick={e => e.stopPropagation()}
            onMouseEnter={() => setHovTel(true)}
            onMouseLeave={() => setHovTel(false)}
            style={{
              width:34, height:34, borderRadius:10,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:  hovTel ? 'rgba(124,58,237,.22)' : 'rgba(124,58,237,.08)',
              border:      `1px solid ${hovTel ? 'rgba(124,58,237,.55)' : 'rgba(124,58,237,.25)'}`,
              boxShadow:   hovTel ? '0 0 14px rgba(124,58,237,.3)' : 'none',
              transform:   hovTel ? 'scale(1.08)' : 'scale(1)',
              transition:  'all .18s cubic-bezier(.4,0,.2,1)',
              textDecoration:'none', flexShrink:0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={hovTel ? '#7c3aed' : '#a78bfa'} strokeWidth="2.2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   CoordLogoCircle — logo circular premium (igual que admin)
══════════════════════════════════════════════════════════════════════════ */
function CoordLogoCircle({ size }: { size: number }) {
  const inner = Math.round(size * 0.72)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#ffffff',
      boxShadow: [
        '0 8px 28px rgba(0,0,0,.18)',
        '0 2px 6px  rgba(0,0,0,.10)',
        'inset 3px 3px 6px  rgba(255,255,255,.9)',
        'inset -3px -3px 6px rgba(0,0,0,.12)',
      ].join(', '),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: inner, height: inner, borderRadius: '50%',
        background: '#ffffff',
        boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/asp-kids-logo.png" alt="ASP Kids" style={{ width:'88%', height:'88%', objectFit:'contain' }} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   CoordNavIcon — iconos para los items de nav
══════════════════════════════════════════════════════════════════════════ */
function CoordNavIcon({ type, active }: { type: 'coord' | 'ninos' | 'asistencias' | 'salir'; active: boolean }) {
  const c = active ? '#7c3aed' : '#8496ac'
  const s = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke: c, strokeWidth: '1.65',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  if (type === 'coord') return (
    <svg {...s}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  if (type === 'asistencias') return (
    <svg {...s}>
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
  if (type === 'salir') return (
    <svg {...s} stroke="#ef4444">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
  return (
    <svg {...s}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
