'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NinosSection from '../admin/components/NinosSection'
import { type KidsCoordinador } from '../admin/components/CoordinadorModal'

export default function KidsNinosPage() {
  const router  = useRouter()
  const [coord,       setCoord]      = useState<KidsCoordinador | null>(null)
  const [loading,     setLoading]    = useState(true)
  const [isMobile,    setIsMobile]   = useState(false)
  const [logoNavOpen, setLogoNavOpen] = useState(false)
  const [logoPressed, setLogoPressed] = useState(false)

  /* ── Responsive ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── Logout ── */
  async function handleLogout() {
    await Promise.allSettled([
      fetch('/api/kids/coordinador/logout', { method: 'POST' }),
      fetch('/api/kids/admin/logout',       { method: 'POST' }),
    ])
    router.replace('/login')
  }

  /* ── Auth: intentar coordinador primero, luego admin ── */
  useEffect(() => {
    async function load() {
      try {
        // Intentar sesión coordinador
        const res = await fetch('/api/kids/coordinador/me')
        if (res.ok) {
          const json = await res.json()
          if (json.ok && json.coordinador) {
            setCoord(json.coordinador)
            setLoading(false)
            return
          }
        }
        // Intentar sesión admin (me)
        const adminRes = await fetch('/api/kids/admin/me')
        if (adminRes.ok) {
          const adminJson = await adminRes.json()
          if (adminJson.ok) {
            setCoord(null) // admin sin coord info, igual puede ver niños
            setLoading(false)
            return
          }
        }
        // Sin sesión válida
        router.replace('/login')
      } catch {
        router.replace('/login')
      }
    }
    load()
  }, [router])

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
          Cargando panel de niños…
        </div>
      </main>
    )
  }

  const usuario = coord
    ? { nombre: coord.nombre, apellido: coord.apellido, foto_url: coord.foto_url ?? null }
    : null

  return (
    <>
    <style>{`
      @keyframes ninosFadeIn {
        from { opacity:0; transform:translateY(22px) scale(.97); }
        to   { opacity:1; transform:translateY(0)    scale(1);   }
      }
    `}</style>
    <div style={{
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      minHeight:'100vh',
      background:'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
      display:'flex', flexDirection:'column', alignItems:'center',
      position:'relative',
      animation:'ninosFadeIn .42s cubic-bezier(0.25,0.46,0.45,0.94) both',
    }}>
      {/* Orbs decorativos */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-10%', left:'-4%', width:340, height:340, borderRadius:'50%', background:'radial-gradient(circle,rgba(13,148,136,.5) 0%,transparent 68%)', filter:'blur(32px)' }}/>
        <div style={{ position:'absolute', bottom:'8%', right:'2%', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,.4) 0%,transparent 68%)', filter:'blur(30px)' }}/>
        <div style={{ position:'absolute', top:'40%', right:'6%',  width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(236,72,153,.28) 0%,transparent 68%)', filter:'blur(24px)' }}/>
      </div>

      {/* ══════════════════════════════════════════
          LOGO NAV — centrado, items a los lados
      ══════════════════════════════════════════ */}
      <div style={{
        position:'relative', width:'100%', height:110,
        flexShrink:0, zIndex:10,
      }}>
        {/* Izquierda 1: Mi Panel */}
        <div
          onClick={() => { setLogoNavOpen(false); router.push('/kids/coordinador') }}
          style={{
            position:'absolute', left:'calc(50% - 96px)', top:42,
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            cursor:'pointer',
            pointerEvents: logoNavOpen ? 'auto' : 'none',
            opacity:       logoNavOpen ? 1 : 0,
            transform:     logoNavOpen ? 'scale(1) translateX(0)' : 'scale(0.4) translateX(74px)',
            transition:    'opacity .26s 0ms, transform .30s cubic-bezier(.34,1.56,.64,1) 0ms',
            zIndex:1,
          }}
        >
          <div style={{
            width:44, height:44, borderRadius:'50%',
            background:'rgba(255,255,255,0.92)',
            border:'2px solid rgba(0,0,0,0.09)',
            boxShadow:'0 3px 12px rgba(0,0,0,0.13)',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)',
          }}>
            <NinosNavIcon type="coord" active={false} />
          </div>
          <span style={{ fontSize:9, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap' }}>Mi Panel</span>
        </div>

        {/* Izquierda 2: Salir */}
        <div
          onClick={() => { setLogoNavOpen(false); handleLogout() }}
          style={{
            position:'absolute', left:'calc(50% - 148px)', top:42,
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            cursor:'pointer',
            pointerEvents: logoNavOpen ? 'auto' : 'none',
            opacity:       logoNavOpen ? 1 : 0,
            transform:     logoNavOpen ? 'scale(1) translateX(0)' : 'scale(0.4) translateX(126px)',
            transition:    'opacity .26s 65ms, transform .30s cubic-bezier(.34,1.56,.64,1) 65ms',
            zIndex:1,
          }}
        >
          <div style={{
            width:44, height:44, borderRadius:'50%',
            background:'rgba(255,255,255,0.92)',
            border:'2px solid rgba(239,68,68,0.2)',
            boxShadow:'0 3px 12px rgba(239,68,68,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)',
          }}>
            <NinosNavIcon type="salir" active={false} />
          </div>
          <span style={{ fontSize:9, fontWeight:700, color:'#ef4444', whiteSpace:'nowrap' }}>Salir</span>
        </div>

        {/* Logo central */}
        <div
          onPointerDown={() => setLogoPressed(true)}
          onPointerUp={() => { setLogoPressed(false); setLogoNavOpen(v => !v) }}
          onPointerLeave={() => setLogoPressed(false)}
          onPointerCancel={() => setLogoPressed(false)}
          style={{
            position:'absolute', left:'50%', top:8,
            transform: `translateX(-50%) ${logoPressed ? 'scale(0.86)' : logoNavOpen ? 'scale(0.93)' : 'scale(1)'}`,
            transition: logoPressed ? 'transform .08s ease' : 'transform .38s cubic-bezier(.34,1.56,.64,1)',
            cursor:'pointer', zIndex:2,
            filter: logoNavOpen
              ? 'drop-shadow(0 0 16px rgba(96,165,250,0.65)) drop-shadow(0 0 14px rgba(244,114,182,0.55)) drop-shadow(0 4px 10px rgba(167,139,250,0.55))'
              : logoPressed ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' : 'drop-shadow(0 4px 14px rgba(0,0,0,0.18))',
          } as React.CSSProperties}
        >
          <NinosLogoCircle size={96} />
        </div>

        {/* Derecha 1: Niños (activo) */}
        <div
          onClick={() => setLogoNavOpen(false)}
          style={{
            position:'absolute', left:'calc(50% + 52px)', top:42,
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            cursor:'pointer',
            pointerEvents: logoNavOpen ? 'auto' : 'none',
            opacity:       logoNavOpen ? 1 : 0,
            transform:     logoNavOpen ? 'scale(1) translateX(0)' : 'scale(0.4) translateX(-74px)',
            transition:    'opacity .26s 0ms, transform .30s cubic-bezier(.34,1.56,.64,1) 0ms',
            zIndex:1,
          }}
        >
          <div style={{
            width:44, height:44, borderRadius:'50%',
            background:['linear-gradient(rgba(255,255,255,.96),rgba(255,255,255,.96)) padding-box',
                        'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box'].join(','),
            border:'2px solid transparent',
            boxShadow:'-3px 0 14px rgba(96,165,250,.42), 3px 0 14px rgba(244,114,182,.36), 0 6px 18px rgba(167,139,250,.30), inset 0 1.5px 0 rgba(255,255,255,1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)',
          }}>
            <NinosNavIcon type="ninos" active={true} />
          </div>
          <span style={{ fontSize:9, fontWeight:700, color:'#7c3aed', whiteSpace:'nowrap' }}>Niños</span>
        </div>

        {/* Derecha 2: Asistencias */}
        <div
          onClick={() => { setLogoNavOpen(false); router.push('/kids/asistencias') }}
          style={{
            position:'absolute', left:'calc(50% + 104px)', top:42,
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            cursor:'pointer',
            pointerEvents: logoNavOpen ? 'auto' : 'none',
            opacity:       logoNavOpen ? 1 : 0,
            transform:     logoNavOpen ? 'scale(1) translateX(0)' : 'scale(0.4) translateX(-126px)',
            transition:    'opacity .26s 65ms, transform .30s cubic-bezier(.34,1.56,.64,1) 65ms',
            zIndex:1,
          }}
        >
          <div style={{
            width:44, height:44, borderRadius:'50%',
            background:'rgba(255,255,255,0.92)',
            border:'2px solid rgba(0,0,0,0.09)',
            boxShadow:'0 3px 12px rgba(0,0,0,0.13)',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)',
          }}>
            <NinosNavIcon type="asistencias" active={false} />
          </div>
          <span style={{ fontSize:9, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap' }}>Asist.</span>
        </div>

        {/* Ring indicador */}
        {logoNavOpen && (
          <div style={{
            position:'absolute', left:'50%', top:8, width:96, height:96, borderRadius:'50%',
            transform:'translateX(-50%)',
            background:['linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)) padding-box',
                        'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box'].join(','),
            border:'2px solid transparent',
            boxShadow:'-4px 0 18px rgba(96,165,250,.38), 4px 0 18px rgba(244,114,182,.34), 0 0 0 5px rgba(167,139,250,.12)',
            pointerEvents:'none', zIndex:1,
          }}/>
        )}
      </div>

      {/* ── NinosSection ocupa el resto ── */}
      <div style={{ position:'relative', zIndex:1, width:'100%', flex:1 }}>
        <NinosSection usuario={usuario} />
      </div>
    </div>
    </>
  )
}

/* ── Logo circle para la página de niños ── */
function NinosLogoCircle({ size }: { size: number }) {
  const inner = Math.round(size * 0.72)
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:'#ffffff',
      boxShadow:[
        '0 8px 28px rgba(0,0,0,.18)',
        '0 2px 6px  rgba(0,0,0,.10)',
        'inset 3px 3px 6px  rgba(255,255,255,.9)',
        'inset -3px -3px 6px rgba(0,0,0,.12)',
      ].join(', '),
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        width:inner, height:inner, borderRadius:'50%',
        background:'#ffffff',
        boxShadow:'inset 0 0 0 1.5px rgba(0,0,0,.06)',
        display:'flex', alignItems:'center', justifyContent:'center',
        overflow:'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/asp-kids-logo.png" alt="ASP Kids" style={{ width:'88%', height:'88%', objectFit:'contain' }} />
      </div>
    </div>
  )
}

/* ── NavIcons para niños page ── */
function NinosNavIcon({ type, active }: { type: 'coord' | 'ninos' | 'asistencias' | 'salir'; active: boolean }) {
  const c = active ? '#7c3aed' : '#8496ac'
  const s = { width:18, height:18, viewBox:'0 0 24 24', fill:'none', stroke:c, strokeWidth:'1.65', strokeLinecap:'round' as const, strokeLinejoin:'round' as const }
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
