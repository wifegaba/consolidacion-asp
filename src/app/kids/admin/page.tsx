'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ServidorModal,      { type KidsServidor }     from './components/ServidorModal'
import ObservacionesModal                           from './components/ObservacionesModal'
import NinosSection                                 from './components/NinosSection'
import AsistenciasSection                           from './components/AsistenciasSection'
import SeguimientosSection                          from './components/SeguimientosSection'
import AgendaSection                                from './components/AgendaSection'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Usuario {
  id:       string
  nombre:   string
  apellido: string
  cedula:   string
  foto_url: string | null
}

type FilterTab = 'todos' | 'coordinadores' | 'maestros' | 'auxiliares' | 'timoteos'

/* ── Navigation items ───────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { num: '01', label: 'Niños',           section: 'ninos'           },
  { num: '02', label: 'Asistencias',     section: 'asistencias'     },
  { num: '03', label: 'Seguimientos',    section: 'seguimientos'    },
  { num: '04', label: 'Servidores',      section: 'servidores'      },
  { num: '05', label: 'Agenda',          section: 'agenda'          },
] as const

/* ── Iconos del Sidebar (NavIcon) ────────────────────────────────────────── */
function NavIcon({ section, active, color }: { section: string, active: boolean, color: string }) {
  if (section === 'ninos') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={active ? 0 : 2}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  }
  if (section === 'asistencias') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={active ? 0 : 2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    )
  }
  if (section === 'seguimientos') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={active ? 0 : 2}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    )
  }
  if (section === 'servidores') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={active ? 0 : 2}>
        <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
      </svg>
    )
  }
  if (section === 'agenda') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={active ? 0 : 2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )
  }
  return <div/>
}



/* ── Avatar palette ─────────────────────────────────────────────────────── */
const GRADIENTS = [
  'linear-gradient(135deg,#0d9488,#0891b2)',
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#3b82f6,#60a5fa)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#8b5cf6,#c084fc)',
]

/* ── Helpers ────────────────────────────────────────────────────────────── */
function initials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}
function gradient(idx: number) {
  return GRADIENTS[idx % GRADIENTS.length]
}
function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function lastLogin(iso: string) {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86_400_000)  return 'Hoy'
  if (diff < 172_800_000) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function KidsAdminPage() {
  const router = useRouter()

  const [usuario,        setUsuario]        = useState<Usuario | null>(null)
  // ── Servidores ───────────────────────────────────────────────────────────
  const [servidores,     setServidores]     = useState<KidsServidor[]>([])
  const [loadingServidores, setLoadingServidores] = useState(true)
  const [servidorFilter, setServidorFilter] = useState<FilterTab>('todos')
  const [servidorSearch, setServidorSearch] = useState('')
  const [servidorModal,  setServidorModal]  = useState(false)
  const [editServidor,   setEditServidor]   = useState<KidsServidor | null>(null)
  const [deletingServidorId, setDeletingServidorId] = useState<string | null>(null)

  // ── Shared ───────────────────────────────────────────────────────────────
  const [activeNav,      setActiveNav]      = useState<string>('ninos')
  const [displayNav,     setDisplayNav]     = useState<string>('ninos')
  const [animPhase,      setAnimPhase]      = useState<'enter' | 'exit' | 'idle'>('idle')
  const [isMobile,       setIsMobile]       = useState(false)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [logoNavOpen,    setLogoNavOpen]    = useState(false)
  const [logoPressed,    setLogoPressed]    = useState(false)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [coordMaestrosModal, setCoordMaestrosModal] = useState<KidsCoordinador | null>(null)
  const [obsModal,           setObsModal]           = useState<{ maestro: KidsMaestro; coordinador: KidsCoordinador | null } | null>(null)

  // Aliases for the active section
  const loading   = loadingServidores
  const filter    = servidorFilter
  const setFilter = setServidorFilter

  const search    = servidorSearch
  const setSearch = setServidorSearch
  const [searchFocused, setSearchFocused] = useState(false)


  /* ── Responsive detection ─────────────────────────────────────────────── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── Close sidebar on desktop ─────────────────────────────────────────── */
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/kids/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUsuario(data.usuario))
      .catch(() => router.replace('/kids/login'))
  }, [router])

  /* ── Fetch servidores ─────────────────────────────────────────────────── */
  const fetchServidores = useCallback(async () => {
    setLoadingServidores(true)
    try {
      const res  = await fetch('/api/kids/servidores')
      const json = await res.json()
      if (json.ok) setServidores(json.data ?? [])
    } catch { /* silently ignore */ }
    finally { setLoadingServidores(false) }
  }, [])

  useEffect(() => { fetchServidores() }, [fetchServidores])

  /* ── Derived data ─────────────────────────────────────────────────────── */
  const isMaestrosView      = false
  const isCoordinadoresView = false
  const activeList          = servidores
  const totalActivos     = activeList.filter(a => a.activo).length
  const ultimoIngreso    = activeList[0]?.creado_en ? lastLogin(activeList[0].creado_en) : '—'
  const ultimaFecha      = activeList[0]?.creado_en
    ? new Date(activeList[0].creado_en).toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' })
    : ''

  const filtered = activeList.filter(a => {
    const matchFilter =
      filter === 'todos'         ? true :
      filter === 'coordinadores' ? a.roles?.some((r: string) => r.includes('COORDINADOR')) :
      filter === 'maestros'      ? a.roles?.some((r: string) => r.includes('MAESTRO') && !r.includes('AUXILIAR')) :
      filter === 'auxiliares'    ? a.roles?.some((r: string) => r.includes('AUXILIAR')) :
      filter === 'timoteos'      ? a.roles?.some((r: string) => r.includes('TIMOTEOS')) : true

    const q = search.toLowerCase().trim()
    const matchSearch = !q ||
      a.nombre.toLowerCase().includes(q)   ||
      a.apellido.toLowerCase().includes(q) ||
      a.cedula.includes(q)

    return matchFilter && matchSearch
  })

  /* ── Actions ──────────────────────────────────────────────────────────── */
  function openCreate() {
    setEditServidor(null); setServidorModal(true)
  }
  function openEdit(a: KidsServidor) {
    setEditServidor(a); setServidorModal(true)
  }

  async function handleServidorSaved() {
    setServidorModal(false)
    await fetchServidores()
  }

  async function handleDelete(a: KidsServidor) {
    if (!window.confirm(`¿Desactivar a ${a.nombre} ${a.apellido}?\n\nEl registro no se eliminará, solo quedará inactivo.`)) return
    setDeletingServidorId(a.id)
    try {
      const res = await fetch(`/api/kids/servidores/${a.id}`, { method: 'DELETE' })
      if (res.ok) await fetchServidores()
    } finally { setDeletingServidorId(null) }
  }

  async function handleLogout() {
    await fetch('/api/kids/logout', { method: 'POST' })
    router.replace('/kids/login')
  }

  function handleNavClick(section: string) {
    if (section === activeNav) { setSidebarOpen(false); return }
    setSidebarOpen(false)
    setActiveNav(section)          // sidebar highlight cambia de inmediato
    setAnimPhase('exit')           // 1. contenido actual sale hacia la izquierda
    setTimeout(() => {
      setDisplayNav(section)       // 2. contenido se intercambia
      setAnimPhase('enter')        // 3. nuevo contenido entra desde la derecha
      setTimeout(() => setAnimPhase('idle'), 320)
    }, 240)
  }

  /* ── Guard ────────────────────────────────────────────────────────────── */
  if (!usuario) return (
    <div style={{
      minHeight:'100vh',
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
    }}>
      <div style={{ fontSize:13, color:'#9ca3af', fontWeight:500 }}>Verificando sesión...</div>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
    {/* ── Keyframes: Apple-style Fade + Slide Vertical ── */}
    <style>{`
      /* Entrada elegante — barrido desde la derecha */
      @keyframes aspSlideInRight {
        from { opacity: 0; transform: translateX(48px) scale(0.97); }
        to   { opacity: 1; transform: translateX(0)    scale(1);    }
      }
      /* Salida elegante — barrido hacia la izquierda */
      @keyframes aspSlideOutLeft {
        from { opacity: 1; transform: translateX(0)     scale(1);    }
        to   { opacity: 0; transform: translateX(-36px) scale(0.97); }
      }

      /* ── Niños — premium sheet rise ── */
      @keyframes ninosSheetRise {
        0% {
          opacity: 0;
          transform: translateY(72px) scale(0.93);
          box-shadow: 0 -40px 80px rgba(124,58,237,0);
        }
        40% {
          opacity: 1;
          box-shadow: 0 -24px 60px rgba(124,58,237,.22);
        }
        72% {
          transform: translateY(-6px) scale(1.004);
        }
        100% {
          opacity: 1;
          transform: none;
          box-shadow: 0 -8px 32px rgba(124,58,237,.10);
        }
      }

      /* ── Niños — shimmer overlay que desaparece al entrar ── */
      @keyframes ninosShimmerFade {
        0%   { opacity: 1; }
        60%  { opacity: .18; }
        100% { opacity: 0; pointer-events: none; }
      }

      /* ── Sidebar Premium CSS ── */
      .sidebar-nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 12px;
        border-radius: 12px;
        cursor: pointer;
        background: transparent;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 3px solid transparent;
        position: relative;
        overflow: hidden;
      }
      .sidebar-nav-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0;
        background: linear-gradient(90deg, rgba(20, 184, 166, 0.08) 0%, transparent 100%);
        transition: width 0.25s ease;
        z-index: 0;
      }
      .sidebar-nav-item:hover::before {
        width: 100%;
      }
      .sidebar-nav-item:hover {
        transform: translateX(4px);
        background: rgba(255, 255, 255, 0.03);
      }
      .sidebar-nav-item:hover .sidebar-icon {
        stroke: #14b8a6 !important;
        filter: drop-shadow(0 0 6px rgba(20, 184, 166, 0.6));
      }
      .sidebar-nav-item:hover .sidebar-text {
        color: #ffffff !important;
      }
      .sidebar-nav-item-active {
        background: linear-gradient(90deg, rgba(13, 148, 136, 0.18) 0%, rgba(13, 148, 136, 0.03) 100%) !important;
        box-shadow: 0 4px 18px rgba(13, 148, 136, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        border-left: 3px solid #14b8a6 !important;
      }
      .sidebar-nav-item-active .sidebar-text {
        color: #99f6e4 !important;
        font-weight: 700 !important;
      }
      .sidebar-nav-item-active .sidebar-icon {
        stroke: #14b8a6 !important;
        filter: drop-shadow(0 0 4px rgba(20, 184, 166, 0.4));
      }
      
      @keyframes pulse-online {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }
      .status-online-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10b981;
        animation: pulse-online 2s infinite;
        border: 1.5px solid #0b1929;
      }
      
      .btn-logout-premium {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .btn-logout-premium:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.2);
      }
      .dock-item:hover .dock-tooltip {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
      .btn-logout-premium:hover svg {
        stroke: #f87171 !important;
        filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));
      }
    `}</style>
    <div style={{
      fontFamily:    "'Segoe UI',system-ui,sans-serif",
      minHeight:     '100vh',
      background:    'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
      display:       'flex',
      alignItems:    'stretch',
      justifyContent:'center',
      padding:       isMobile ? '0' : '16px',
      position:      'relative',
      overflow:      'hidden',
    }}>

      {/* ── Decorative orbs (backdrop for glass effect) ── */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-10%', left:'-4%',  width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle, rgba(13,148,136,.55) 0%, transparent 68%)', filter:'blur(30px)' }}/>
        <div style={{ position:'absolute', bottom:'8%', left:'1%',  width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,.45) 0%, transparent 68%)', filter:'blur(30px)' }}/>
        <div style={{ position:'absolute', top:'38%',  left:'5%',   width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(37,99,235,.38) 0%,  transparent 68%)', filter:'blur(24px)' }}/>
        <div style={{ position:'absolute', top:'20%',  left:'-6%',  width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle, rgba(236,72,153,.32) 0%,  transparent 68%)', filter:'blur(22px)' }}/>
      </div>

      {/* ── Shell ── */}
      <div style={{
        width:        '100%',
        maxWidth:     '100%',
        display:      'flex',
        borderRadius: isMobile ? 0 : 20,
        overflow:     isMobile ? 'visible' : 'hidden',
        boxShadow:    isMobile ? 'none' : '0 32px 72px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.6)',
        minHeight:    isMobile ? '100vh' : 'calc(100vh - 48px)',
        position:     'relative',
        zIndex:       1,
        /* gradient visible inside the shell — what the sidebar blurs */
        background:   'linear-gradient(145deg,#99f6e4 0%,#c4b5fd 50%,#93c5fd 100%)',
      }}>

        {/* ── Mobile sidebar overlay — dentro del shell para stacking correcto ── */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position:   'fixed',
              inset:      0,
              background: 'rgba(0,0,0,.18)',
              zIndex:     55,
            }}
          />
        )}

                {/* ════════════════════════════════════════
            BARRA DE NAVEGACIÓN INFERIOR (Única barra)
        ════════════════════════════════════════ */}
        <aside style={{
          position:             isMobile ? 'fixed' : 'absolute',
          bottom:               isMobile ? 10 : 14,
          left:                 '50%',
          transform:            'translateX(-50%)',
          height:               isMobile ? 54 : 50,
          background:           'rgba(255, 255, 255, 0.88)',
          backdropFilter:       'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          display:              'flex',
          flexDirection:        'row',
          alignItems:           'center',
          padding:              isMobile ? '0 8px' : '0 12px',
          gap:                  isMobile ? 3 : 6,
          borderRadius:         32,
          boxShadow:            '0 12px 36px rgba(0,0,0,0.14), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.6)',
          zIndex:               100,
          transition:           'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
        }}>
          {/* Glass sheen overlay */}
          <div style={{
            position: 'absolute', inset: 1, pointerEvents: 'none', borderRadius: 'inherit',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, transparent 40%, rgba(255, 255, 255, 0.1) 100%)',
            opacity: .8, zIndex: -1
          }} />

          {/* Logo (opcional, oculto en móvil) */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', marginRight: 4, paddingRight: 10, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
               <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <span style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>K</span>
               </div>
            </div>
          )}

          {/* Nav Items con ícono y nombre de pestaña */}
          {NAV_ITEMS.map((item) => {
            const isActive = item.section === activeNav;
            return (
              <div
                key={item.num}
                onClick={() => handleNavClick(item.section)}
                style={{
                  position:       'relative',
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        isMobile ? '4px 8px' : '5px 12px',
                  borderRadius:   14,
                  cursor:         'pointer',
                  transition:     'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  background:     isActive
                    ? 'linear-gradient(135deg, rgba(2,132,199,0.14), rgba(56,189,248,0.06))'
                    : 'transparent',
                  boxShadow:      isActive
                    ? 'inset 0 1px 1px rgba(255,255,255,0.6), 0 2px 8px rgba(2,132,199,0.12)'
                    : 'none',
                  gap:            2,
                }}
              >
                <NavIcon section={item.section} active={isActive} color={isActive ? '#0284c7' : '#64748b'} />
                <span style={{
                  fontSize:      isMobile ? 10 : 11,
                  fontWeight:    isActive ? 800 : 600,
                  color:         isActive ? '#0284c7' : '#64748b',
                  whiteSpace:    'nowrap',
                  lineHeight:    1,
                  letterSpacing: '-0.2px',
                }}>
                  {item.label}
                </span>
                
                {/* Indicador activo */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: '#0ea5e9',
                    boxShadow: '0 0 6px rgba(14,165,233,0.8)'
                  }} />
                )}
              </div>
            );
          })}

          <div style={{ width: 1, height: '45%', background: 'rgba(15,23,42,0.15)', margin: '0 2px' }} />

          {/* User Avatar + Logout */}
          <div 
            style={{ 
              position: 'relative', 
              width: isMobile ? 32 : 36, 
              height: isMobile ? 32 : 36, 
              borderRadius: '50%', 
              cursor: 'pointer',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)',
              transition: 'transform 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              marginLeft: 2,
            }}
            onClick={handleLogout}
            title="Cerrar sesión"
          >
             <img src="/asp-kids-logo.png" alt="ASP Kids" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
             <div className="status-online-dot" style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                zIndex: 4,
                boxShadow: '0 0 4px rgba(16, 185, 129, 0.8), 0 0 0 1.5px #ffffff',
              }} />
          </div>
        </aside>

        {/* ════════════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════════════ */}
        <main style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          background:    'rgba(248,250,252,.93)',
          minWidth:      0,
        }}>

          {/* ── Panel Niños — layout propio con sheet entrance ── */}
          {displayNav === 'ninos' && (
            <div style={{
              flex:          1,
              minHeight:     0,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
              position:      'relative',
              zIndex:        20,
              animation:     'ninosSheetRise 0.62s cubic-bezier(.22,1,.36,1) both',
              willChange:    'opacity',
              borderRadius:  isMobile ? '20px 20px 0 0' : 16,
              boxShadow:     '0 -8px 48px rgba(124,58,237,.14), 0 2px 24px rgba(0,0,0,.06)',
            }}>
              {/* Shimmer de bienvenida — destello blanco que se desvanece */}
              <div style={{
                position:      'absolute',
                inset:         0,
                zIndex:        10,
                pointerEvents: 'none',
                background:    'linear-gradient(160deg, rgba(255,255,255,.55) 0%, rgba(200,180,255,.22) 40%, transparent 70%)',
                animation:     'ninosShimmerFade 0.75s cubic-bezier(.4,0,.2,1) both',
                borderRadius:  'inherit',
              }} />
              <NinosSection usuario={usuario} logoNavOpen={logoNavOpen} />
            </div>
          )}

          {/* ── Panel Asistencias — layout propio ── */}
          {displayNav === 'asistencias' && (
            <div style={{
              flex:          1,
              minHeight:     0,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
              position:      'relative',
              zIndex:        20,
              animation:     'ninosSheetRise 0.62s cubic-bezier(.22,1,.36,1) both',
              willChange:    'opacity',
              borderRadius:  isMobile ? '20px 20px 0 0' : 16,
              boxShadow:     '0 -8px 48px rgba(124,58,237,.14), 0 2px 24px rgba(0,0,0,.06)',
            }}>
              <div style={{
                position:      'absolute',
                inset:         0,
                zIndex:        10,
                pointerEvents: 'none',
                background:    'linear-gradient(160deg, rgba(255,255,255,.55) 0%, rgba(200,180,255,.22) 40%, transparent 70%)',
                animation:     'ninosShimmerFade 0.75s cubic-bezier(.4,0,.2,1) both',
                borderRadius:  'inherit',
              }} />
              <AsistenciasSection usuario={usuario} />
            </div>
          )}

          {/* ── Panel Seguimientos ── */}
          {displayNav === 'seguimientos' && (
            <div style={{
              flex:1, minHeight:0, display:'flex', flexDirection:'column',
              overflow:'hidden', position:'relative', zIndex:20,
              animation:'ninosSheetRise 0.62s cubic-bezier(.22,1,.36,1) both',
              willChange:'opacity',
            }}>
              <div style={{
                position:'absolute', inset:0, zIndex:10, pointerEvents:'none',
                background:'linear-gradient(160deg,rgba(255,255,255,.55) 0%,rgba(200,180,255,.22) 40%,transparent 70%)',
                animation:'ninosShimmerFade 0.75s cubic-bezier(.4,0,.2,1) both',
                borderRadius:'inherit',
              }}/>
              <SeguimientosSection />
            </div>
          )}

          {/* ── Panel Agenda ── */}
          {displayNav === 'agenda' && (
            <div style={{
              flex:1, minHeight:0, display:'flex', flexDirection:'column',
              overflow:'hidden', position:'relative', zIndex:20,
              animation:'ninosSheetRise 0.62s cubic-bezier(.22,1,.36,1) both',
              willChange:'opacity',
            }}>
              <div style={{
                position:'absolute', inset:0, zIndex:10, pointerEvents:'none',
                background:'linear-gradient(160deg,rgba(255,255,255,.55) 0%,rgba(200,180,255,.22) 40%,transparent 70%)',
                animation:'ninosShimmerFade 0.75s cubic-bezier(.4,0,.2,1) both',
                borderRadius:'inherit',
              }}/>
              <AgendaSection servidores={servidores} isMobile={isMobile} />
            </div>
          )}

          {/* ── Top bar + Scroll area (Servidores view) ── */}
          {displayNav !== 'ninos' && displayNav !== 'asistencias' && displayNav !== 'seguimientos' && displayNav !== 'agenda' && (<>
          {isMobile && (
            <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width:38, height:38, borderRadius:11, border:'1px solid rgba(0,0,0,.08)',
                  background:'rgba(255,255,255,.85)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>
          )}

          {/* ── Scroll area ── */}
          <div
            style={{
              flex:1, minHeight:0, overflowY:'auto',
              padding: isMobile ? '20px 16px 32px' : '24px 36px 32px',
              display:'flex', flexDirection:'column', gap:16,
              position:'relative',
            }}
          >

            {/* ── Admin list card (Liquid Glass Reference Board - Azul Celeste Sutil) ── */}
            <div style={{
              background: 'radial-gradient(circle at 11% 75%, rgba(224,242,254,.18), transparent 35%), radial-gradient(circle at 94% 82%, rgba(186,230,253,.12), transparent 30%), linear-gradient(135deg, #f8fafc 0%, #fafafa 50%, #f1f5f9 100%)',
              backdropFilter: 'blur(40px) saturate(150%)',
              WebkitBackdropFilter: 'blur(40px) saturate(150%)',
              borderRadius: isMobile ? 20 : 54,
              overflow:     'hidden',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,.9), 0 35px 70px rgba(54,69,95,.12)',
              flex:         1,
              minHeight:    0,
              display:      'flex',
              flexDirection:'column',
              position:     'relative',
              isolation:    'isolate',
            }}>
              {/* Blobs ambientales ultra sutiles (Tonos azul hielo/celeste muy suaves) */}
              <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:-1, opacity: .35, background: 'radial-gradient(circle at 50% 50%, transparent 42%, rgba(224,242,254,.10) 100%)' }} />
              <div style={{ position:'absolute', filter:'blur(50px)', borderRadius:'50%', pointerEvents:'none', zIndex:-1, width:180, height:120, right:80, top:180, background:'rgba(56,189,248,.08)' }} />
              <div style={{ position:'absolute', filter:'blur(50px)', borderRadius:'50%', pointerEvents:'none', zIndex:-1, width:200, height:140, left:80, bottom:180, background:'rgba(186,230,253,.12)' }} />
              <div style={{ position:'absolute', filter:'blur(45px)', borderRadius:'50%', pointerEvents:'none', zIndex:-1, width:120, height:90, right:120, bottom:200, background:'rgba(14,165,233,.05)' }} />

              {/* ── Ambient glow top (Línea Azul Celeste Sutil) ── */}
              <div style={{
                position:'absolute', top:0, left:'8%', right:'8%', height:1,
                background: isMaestrosView
                  ? 'linear-gradient(90deg, transparent, rgba(167,139,250,.6), rgba(139,92,246,.8), rgba(167,139,250,.6), transparent)'
                  : isCoordinadoresView
                  ? 'linear-gradient(90deg, transparent, rgba(56,189,248,.35), rgba(14,165,233,.5), rgba(56,189,248,.35), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(45,212,191,.6), rgba(20,184,166,.8), rgba(45,212,191,.6), transparent)',
                borderRadius: 1,
                boxShadow: isCoordinadoresView ? '0 0 6px rgba(56,189,248,.3)' : 'none',
                pointerEvents: 'none',
              }} />

              {/* Section header */}
              <div style={{
                display:        'flex',
                alignItems:     isMobile ? 'stretch' : 'center',
                flexDirection:  isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                padding:        isMobile ? '12px 14px 0' : '14px 20px 0',
                gap:            isMobile ? 8 : 12,
                flexShrink:     0,
              }}>
                <div>
                  <div style={{
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 700,
                    letterSpacing: '-0.3px',
                    backgroundImage: isMaestrosView
                      ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)'
                      : isCoordinadoresView
                      ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)'
                      : 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {isMaestrosView ? 'Equipo de Maestros' : isCoordinadoresView ? 'Equipo de Coordinadores' : 'Equipo de Servidores'}
                  </div>
                  <div style={{ fontSize:10, color:'#64748b', marginTop:1, letterSpacing: '0.15px' }}>
                    {filtered.length} de {activeList.length} perfiles
                  </div>
                </div>

                {/* ── Buscador Liquid Glass CENTRADO dentro del panel ── */}
                <div style={{
                  position:       'relative',
                  display:        'flex',
                  alignItems:     'center',
                  height:         isMobile ? 36 : 38,
                  borderRadius:   50,
                  paddingLeft:    isMobile ? 12 : 14,
                  background:     searchFocused
                    ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(224,242,254,.75))'
                    : 'linear-gradient(145deg, rgba(255,255,255,.90), rgba(230,240,252,.50))',
                  border:         searchFocused
                    ? '1px solid rgba(56,189,248,.45)'
                    : '1px solid rgba(255,255,255,.95)',
                  boxShadow:      searchFocused
                    ? '0 0 0 1.5px rgba(56,189,248,.22), 0 3px 10px rgba(14,165,233,.10), inset 0 1px 0 rgba(255,255,255,1)'
                    : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.12), 0 4px 14px rgba(96,116,147,.10)',
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                  overflow:       'hidden',
                  width:          isMobile ? '100%' : 290,
                  flexShrink:     0,
                  transition:     'all .28s cubic-bezier(0.25,0.46,0.45,0.94)',
                  isolation:      'isolate',
                }}>
                  {/* Glossy sheen overlay */}
                  <div style={{
                    position: 'absolute', inset: 1, pointerEvents: 'none', borderRadius: 50, zIndex: 1,
                    background: searchFocused
                      ? 'linear-gradient(110deg, rgba(255,255,255,1), transparent 30%, transparent 70%, rgba(186,230,253,.4))'
                      : 'linear-gradient(110deg, rgba(255,255,255,.8), transparent 25%, transparent 75%, rgba(255,255,255,.5))',
                    opacity: 0.85
                  }} />

                  {/* Icono de búsqueda */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? "#0284c7" : "#475569"} strokeWidth="2.4" style={{ flexShrink: 0, zIndex: 2, transition: 'stroke .25s' }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>

                  {/* Input de texto */}
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder={isCoordinadoresView ? "Buscar coordinador..." : isMaestrosView ? "Buscar maestro..." : "Buscar servidor..."}
                    style={{
                      flex: 1, minWidth: 0, height: '100%', border: 'none', background: 'transparent', outline: 'none',
                      padding: '0 8px', fontSize: 12, color: '#1e293b', fontWeight: 600, letterSpacing: '-0.2px', zIndex: 2
                    }}
                  />

                  {/* Botón limpiar texto */}
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2, marginRight: 2
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Filter tabs en estilo Liquid Glass Secondary */}
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  {/* Botón Nuevo Servidor (agregado antes del botón Todos) */}
                  <button
                    onClick={openCreate}
                    style={{
                      position:       'relative',
                      overflow:       'hidden',
                      display:        'flex',
                      alignItems:     'center',
                      gap:            isMobile ? 4 : 6,
                      padding:        isMobile ? '5px 12px' : '6px 16px',
                      borderRadius:   48,
                      fontSize:       11.5,
                      fontWeight:     700,
                      border:         '1px solid rgba(14,165,233,.45)',
                      background:     'linear-gradient(145deg, rgba(224,242,254,.95), rgba(186,230,253,.75))',
                      boxShadow:      'inset 0 1px 0 rgba(255,255,255,1), 0 4px 12px rgba(14,165,233,.18)',
                      backdropFilter: 'blur(17px) saturate(135%)',
                      WebkitBackdropFilter: 'blur(17px) saturate(135%)',
                      color:          '#0284c7',
                      cursor:         'pointer',
                      letterSpacing:  '-0.1px',
                      transition:     'all .24s cubic-bezier(0.25,0.46,0.45,0.94)',
                    }}
                    onMouseEnter={e => {
                      const btn = e.currentTarget as HTMLButtonElement
                      btn.style.transform = 'translateY(-1px)'
                      btn.style.filter = 'brightness(1.04)'
                    }}
                    onMouseLeave={e => {
                      const btn = e.currentTarget as HTMLButtonElement
                      btn.style.transform = 'none'
                      btn.style.filter = 'none'
                    }}
                  >
                    <div style={{
                      position: 'absolute', inset: 1, pointerEvents: 'none', borderRadius: 48,
                      background: 'linear-gradient(110deg, rgba(255,255,255,.76), transparent 22%, transparent 76%, rgba(255,255,255,.45))',
                      opacity: .72
                    }} />
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" style={{ position: 'relative', zIndex: 2 }}>
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <span style={{ position: 'relative', zIndex: 2 }}>
                      {isMaestrosView ? 'Nuevo Maestro' : isCoordinadoresView ? 'Nuevo Coordinador' : 'Nuevo Servidor'}
                    </span>
                  </button>
                  {(['todos','activos','inactivos'] as FilterTab[]).map(t => {
                    const isSelected = filter === t
                    return (
                      <button
                        key={t}
                        onClick={() => setFilter(t)}
                        style={{
                          position:       'relative',
                          overflow:       'hidden',
                          padding:        isMobile ? '5px 12px' : '6px 16px',
                          borderRadius:   48,
                          fontSize:       11.5,
                          fontWeight:     700,
                          border:         isSelected ? '1px solid rgba(56,189,248,.75)' : '1px solid rgba(255,255,255,.87)',
                          background:     isSelected
                            ? 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(224,242,254,.80))'
                            : 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))',
                          boxShadow:      isSelected
                            ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 4px 14px rgba(14,165,233,.20)'
                            : 'inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(81,105,139,.18), 0 4px 12px rgba(96,116,147,.10)',
                          backdropFilter: 'blur(17px) saturate(135%)',
                          WebkitBackdropFilter: 'blur(17px) saturate(135%)',
                          color:          isSelected ? '#0284c7' : '#283449',
                          cursor:         'pointer',
                          letterSpacing:  '-0.1px',
                          transition:     'all .24s cubic-bezier(0.25,0.46,0.45,0.94)',
                        }}
                        onMouseEnter={e => {
                          const btn = e.currentTarget as HTMLButtonElement
                          if (!isSelected) {
                            btn.style.transform = 'translateY(-1px)'
                            btn.style.borderColor = 'rgba(56,189,248,.65)'
                            btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(81,105,139,.18), 0 0 0 1.5px rgba(56,189,248,.25), 0 4px 14px rgba(14,165,233,.16)'
                          }
                        }}
                        onMouseLeave={e => {
                          const btn = e.currentTarget as HTMLButtonElement
                          if (!isSelected) {
                            btn.style.transform = 'none'
                            btn.style.borderColor = 'rgba(255,255,255,.87)'
                            btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(81,105,139,.18), 0 4px 12px rgba(96,116,147,.10)'
                          }
                        }}
                      >
                        {/* Overlay de brillo estilo Secondary Liquid Glass */}
                        <div style={{
                          position: 'absolute', inset: 1, pointerEvents: 'none', borderRadius: 48,
                          background: 'linear-gradient(110deg, rgba(255,255,255,.76), transparent 22%, transparent 76%, rgba(255,255,255,.45))',
                          opacity: .72
                        }} />
                        <span style={{ position: 'relative', zIndex: 2 }}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Strips */}
              <div style={{
                padding: isMobile ? '10px 12px 14px' : '10px 16px 14px',
                display:'flex', flexDirection:'column',
                gap: isMobile ? 6 : 5,
                flex:1, minHeight:0, overflowY:'auto',
                animation: animPhase === 'enter'
                  ? 'aspSlideInRight 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both'
                  : animPhase === 'exit'
                  ? 'aspSlideOutLeft 0.22s cubic-bezier(0.55,0,1,0.45) both'
                  : 'none',
                pointerEvents: animPhase === 'exit' ? 'none' : 'auto',
              }}>

                {loading && (
                  <div style={{ textAlign:'center', padding:'30px 0', fontSize:11.5, color:'rgba(255,255,255,.4)' }}>
                    {isMaestrosView ? 'Cargando maestros...' : isCoordinadoresView ? 'Cargando coordinadores...' : 'Cargando administradores...'}
                  </div>
                )}

                {!loading && filtered.length === 0 && (
                  <div style={{ textAlign:'center', padding:'30px 0' }}>
                    <div style={{ fontSize:26, marginBottom:6 }}>🔍</div>
                    <div style={{ fontSize:11.5, color:'#64748b', fontWeight:500 }}>
                      {search
                        ? 'Sin resultados para esa búsqueda.'
                        : isMaestrosView ? 'No hay maestros en este filtro.'
                        : isCoordinadoresView ? 'No hay coordinadores en este filtro.'
                        : 'No hay administradores en este filtro.'}
                    </div>
                  </div>
                )}

                {/* ── Grid de tarjetas — Coordinadores ── */}
                {!loading && isCoordinadoresView && filtered.length > 0 && (
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 160px))',
                    gap:                 isMobile ? 8 : 10,
                    justifyContent:      'start',
                    margin:              '0 auto',
                    width:               '100%',
                    alignContent:        'start',
                  }}>
                    {filtered.map((a, idx) => (
                      <CoordinadorCard
                        key={a.id}
                        c={a as KidsCoordinador}
                        idx={idx}
                        isDeleting={deletingServidorId === a.id}
                        onEdit={() => openEdit(a)}
                        onDelete={() => handleDelete(a)}
                        onViewMaestros={() => setCoordMaestrosModal(a as KidsCoordinador)}
                        compact={isMobile}
                      />
                    ))}
                  </div>
                )}

                {/* ── Cards — Administradores & Servidores ── */}
                {!loading && !isMaestrosView && !isCoordinadoresView && filtered.length > 0 && (
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 160px))',
                    gap:                 isMobile ? 8 : 10,
                    justifyContent:      'start',
                    margin:              '0 auto',
                    width:               '100%',
                    alignContent:        'start',
                  }}>
                    {filtered.map((a, idx) => (
                      <AdminCard
                        key={a.id}
                        a={a as KidsAdmin}
                        idx={idx}
                        isDeleting={deletingServidorId === a.id || deletingServidorId === a.id}
                        onEdit={() => openEdit(a)}
                        onDelete={() => handleDelete(a)}
                        compact={isMobile}
                      />
                    ))}
                  </div>
                )}
                
                {/* ── Strips — solo Maestros ── */}
                {!loading && isMaestrosView && filtered.map((a, idx) => {
                  const isDeleting = deletingServidorId === a.id

                  /* ── Mobile card ── */
                  if (isMobile) {
                    return (
                      <div
                        key={a.id}
                        style={{
                          padding:    '14px 14px',
                          borderRadius: 16,
                          background: a.activo
                            ? 'linear-gradient(135deg,#f8fffe,#f5f8ff)'
                            : '#fafafa',
                          border: `1px solid ${a.activo ? 'rgba(13,148,136,.12)' : 'rgba(0,0,0,.06)'}`,
                          opacity:    isDeleting ? .5 : 1,
                          transition: 'all .2s',
                        }}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                          <div style={{
                            flexShrink:0,
                            boxShadow:`0 4px 10px ${a.activo ? 'rgba(13,148,136,.2)' : 'rgba(0,0,0,.08)'}`,
                            borderRadius:12, overflow:'hidden',
                          }}>
                            <AvatarImg src={a.foto_url} nombre={a.nombre} apellido={a.apellido} grad={gradient(idx)} size={40} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {a.nombre} {a.apellido}
                            </div>
                            <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>
                              {isMaestrosView ? ((a as KidsMaestro).grupo ?? 'Maestro Kids') : 'Administrador Kids'}
                            </div>
                          </div>
                          <div style={{
                            padding:'4px 10px', borderRadius:50, fontSize:10, fontWeight:700, flexShrink:0,
                            background: a.activo ? 'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))' : '#fef2f2',
                            color: a.activo ? '#0d9488' : '#f43f5e',
                            border: `1px solid ${a.activo ? 'rgba(13,148,136,.3)' : '#fecdd3'}`,
                            display:'flex', alignItems:'center', gap:4,
                          }}>
                            <div style={{ width:5, height:5, borderRadius:'50%', background:a.activo ? '#0d9488' : '#f43f5e' }} />
                            {a.activo ? 'Activo' : 'Inactivo'}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ fontSize:11, color:'#6b7280', display:'flex', flexWrap:'wrap' as const, gap:'4px 10px', flex:1, minWidth:0 }}>
                            <span style={{ fontWeight:600, color:'#374151' }}>CC {a.cedula}</span>
                            {a.telefono && <span>{a.telefono}</span>}
                            {isMaestrosView && (a as KidsMaestro).horario_servicio && (
                              <span style={{ color:'#3b82f6' }}>{(a as KidsMaestro).horario_servicio}</span>
                            )}
                            <span style={{ color:'#9ca3af' }}>Desde {formatDate(a.creado_en)}</span>
                          </div>
                          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                            {isMaestrosView && (
                              <IconButton title="Observaciones" onClick={() => setObsModal({ maestro: a as KidsMaestro, coordinador: null })} borderColor="#e0e7ff" bg="#f5f3ff">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <line x1="16" y1="13" x2="8" y2="13"/>
                                  <line x1="16" y1="17" x2="8" y2="17"/>
                                </svg>
                              </IconButton>
                            )}
                            <IconButton title="Editar" onClick={() => openEdit(a)} borderColor="#e0f2fe" bg="#f0fdfa">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </IconButton>
                            <IconButton title={a.activo ? 'Desactivar' : 'Ya inactivo'} onClick={() => !isDeleting && handleDelete(a)} borderColor="#fecdd3" bg="#fff5f5" disabled={isDeleting}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </IconButton>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  /* ── Desktop strip ── */
                  return (
                    <div
                      key={a.id}
                      style={{
                        display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                        borderRadius:16,
                        background: a.activo ? 'linear-gradient(135deg,#f8fffe,#f5f8ff)' : '#fafafa',
                        border: `1px solid ${a.activo ? 'rgba(13,148,136,.12)' : 'rgba(0,0,0,.06)'}`,
                        opacity: isDeleting ? .5 : 1, transition:'all .2s',
                      }}
                    >
                      <div style={{ flexShrink:0, boxShadow:`0 4px 12px ${a.activo ? 'rgba(13,148,136,.25)' : 'rgba(0,0,0,.1)'}`, borderRadius:14, overflow:'hidden' }}>
                        <AvatarImg src={a.foto_url} nombre={a.nombre} apellido={a.apellido} grad={gradient(idx)} size={44} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {a.nombre} {a.apellido}
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                          {isMaestrosView ? ((a as KidsMaestro).grupo ?? 'Maestro Kids') : 'Administrador Kids'}
                        </div>
                      </div>
                      <Divider />
                      <InfoBlock label="Cédula" value={a.cedula} width={100} />
                      <Divider />
                      {isMaestrosView
                        ? <InfoBlock label="Horario"  value={(a as KidsMaestro).horario_servicio ?? '—'} width={130} />
                        : <InfoBlock label="Teléfono" value={a.telefono ?? '—'} width={110} />
                      }
                      <Divider />
                      <div style={{ minWidth:80, display:'flex', justifyContent:'center' }}>
                        <div style={{
                          padding:'5px 14px', borderRadius:50, fontSize:11, fontWeight:700,
                          background: a.activo ? 'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))' : '#fef2f2',
                          color: a.activo ? '#0d9488' : '#f43f5e',
                          border: `1px solid ${a.activo ? 'rgba(13,148,136,.3)' : '#fecdd3'}`,
                          display:'flex', alignItems:'center', gap:5,
                        }}>
                          <div style={{ width:5, height:5, borderRadius:'50%', background:a.activo ? '#0d9488' : '#f43f5e' }} />
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                      <div style={{ textAlign:'center', minWidth:80 }}>
                        <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'1px' }}>Desde</div>
                        <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, marginTop:2 }}>{formatDate(a.creado_en)}</div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        {/* Observaciones — solo en vista maestros */}
                        {isMaestrosView && (
                          <IconButton
                            title="Ver observaciones"
                            onClick={() => setObsModal({ maestro: a as KidsMaestro, coordinador: null })}
                            borderColor="#e0e7ff"
                            bg="#f5f3ff"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          </IconButton>
                        )}
                        <IconButton title="Editar" onClick={() => openEdit(a)} borderColor="#e0f2fe" bg="#f0fdfa">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </IconButton>
                        <IconButton title={a.activo ? 'Desactivar' : 'Ya inactivo'} onClick={() => !isDeleting && handleDelete(a)} borderColor="#fecdd3" bg="#fff5f5" disabled={isDeleting}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </IconButton>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </>)} {/* end: displayNav !== 'ninos' && displayNav !== 'asistencias' */}
        </main>
      </div>

      {/* ── Modales ── */}
      {servidorModal && (
        <ServidorModal
          servidor={editServidor}
          onClose={() => setServidorModal(false)}
          onSaved={handleServidorSaved}
        />
      )}
    </div>
    </>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

/** Renders a photo; on error falls back to initials on the gradient background. */
function AvatarImg({
  src, nombre, apellido, grad, size,
}: {
  src: string | null; nombre: string; apellido: string; grad: string; size: number
}) {
  const [broken, setBroken] = useState(false)
  const showImg = src && !broken
  return (
    <div style={{
      width:          size, height: size,
      borderRadius:   Math.round(size * 0.3),
      background:     showImg ? 'transparent' : grad,
      display:        'flex', alignItems: 'center', justifyContent: 'center',
      fontSize:       Math.round(size * 0.33),
      fontWeight:     800, color: '#fff',
      overflow:       'hidden', flexShrink: 0,
    }}>
      {showImg
        ? <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
            onError={() => setBroken(true)} />
        : initials(nombre, apellido)
      }
    </div>
  )
}

function Divider() {
  return <div style={{ width:1, height:32, background:'#f3f4f6', flexShrink:0 }} />
}

function InfoBlock({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <div style={{ textAlign:'center', minWidth:width }}>
      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'1px' }}>{label}</div>
      <div style={{ fontSize:12, color:'#374151', fontWeight:600, marginTop:2 }}>{value}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ServidorCard
══════════════════════════════════════════════════════════════════════════ */
function ServidorCard({
  s, idx, isDeleting, onEdit, onDelete, compact
}: {
  s: KidsServidor
  idx: number
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
}) {
  return <AdminCard a={s as any} idx={idx} isDeleting={isDeleting} onEdit={onEdit} onDelete={onDelete} compact={compact} />
}

function AdminCard({
  a, idx, isDeleting, onEdit, onDelete,
}: {
  a:          any
  idx:        number
  isDeleting: boolean
  onEdit:     () => void
  onDelete:   () => void
  compact?:   boolean
}) {
  const [flipped,  setFlipped]  = useState(false)
  const [broken,   setBroken]   = useState(false)
  const [hov,      setHov]      = useState<string | null>(null)
  const [cardHov,  setCardHov]  = useState(false)

  const showImg = a.foto_url && !broken
  const ini     = `${a.nombre.charAt(0)}${a.apellido.charAt(0)}`.toUpperCase()
  const phone   = a.telefono?.replace(/\D/g,'').replace(/^57/,'')
  const ingreso = a.creado_en ? new Date(a.creado_en).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' }) : null
  const h = (id: string) => ({ onMouseEnter: () => setHov(id), onMouseLeave: () => setHov(null) })

  const GRAD_A = 'linear-gradient(145deg,#134e4a 0%,#0d9488 50%,#0891b2 100%)'

  return (
    <div
      onMouseEnter={() => { if (!flipped) setCardHov(true) }}
      onMouseLeave={() => setCardHov(false)}
      style={{
        perspective:  '1000px',
        height:       185,
        borderRadius: 16,
        opacity:      isDeleting ? .5 : 1,
        boxShadow:    flipped
          ? '0 16px 48px rgba(13,148,136,.5), 0 4px 16px rgba(0,0,0,.18)'
          : cardHov
            ? '0 16px 48px rgba(13,148,136,.4), 0 4px 16px rgba(0,0,0,.14)'
            : '0 8px 32px rgba(13,148,136,.26), 0 2px 8px rgba(0,0,0,.08)',
        transition:   'box-shadow .25s, opacity .2s',
      }}
    >
      {/* ─── Flipper ─── */}
      <div style={{
        position:'relative', width:'100%', height:'100%',
        transformStyle:'preserve-3d',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition:'transform .65s cubic-bezier(.34,1.05,.64,1)',
        borderRadius:20,
      }}>

        {/* ══════ FRONT ══════ */}
        <div
          onClick={() => setFlipped(true)}
          style={{
            position:'absolute', top:0, left:0, right:0, bottom:0,
            backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            borderRadius:14, overflow:'hidden', cursor:'pointer',
            background: GRAD_A,
            border:'1px solid rgba(255,255,255,.45)',
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'4px 4px 26px',
            justifyContent:'center',
          }}
        >
          {/* Badge */}
          <div style={{ display:'flex', alignItems:'center', gap:3,
            background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)',
            padding:'1.5px 6px', borderRadius:50, marginBottom:3, maxWidth: '95%',
          }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="#f59e0b" style={{ flexShrink:0 }}><path d="M2 20h20v2H2zM3 13l4-8 5 4 5-4 4 8H3z"/></svg>
            <span style={{ fontSize:7, fontWeight:800, color:'#fff', letterSpacing:'0.5px', textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(a.roles && a.roles.length > 0) ? a.roles.map(r => r.replace(/_/g, ' ')).join(' • ') : 'SERVIDOR'}
            </span>
          </div>

          {/* Foto */}
          <div style={{
            width:64, height:64, borderRadius:'50%',
            border:'2.5px solid rgba(255,255,255,.85)',
            boxShadow: cardHov
              ? '0 0 0 2.5px rgba(245,158,11,.65), 0 5px 16px rgba(19,78,74,.45)'
              : '0 0 0 1.8px rgba(245,158,11,.5),  0 3.5px 12px rgba(19,78,74,.3)',
            overflow:'hidden', flexShrink:0,
            background: showImg ? 'transparent' : GRADIENTS[idx % GRADIENTS.length],
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, fontWeight:800, color:'#fff', marginBottom:3,
            transition:'box-shadow .25s',
          }}>
            {showImg
              ? <img src={a.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)} />
              : ini
            }
          </div>

          {/* Nombre */}
          <div style={{ textAlign:'center', width:'100%', paddingInline:4, marginBottom:0 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fff', lineHeight:1.2,
              textShadow:'0 1px 3px rgba(0,0,0,.25)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {a.nombre} {a.apellido}
            </div>
            <div style={{ fontSize:8.5, color:'rgba(255,255,255,.85)', fontWeight:600, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(a.roles && a.roles.length > 0) ? a.roles.map(r => r.replace(/_/g, ' ')).join(' • ') : 'Servidor Kids'}
            </div>
          </div>

          {/* Hint voltear */}
          <div style={{
            position:'absolute', bottom:26, left:'50%', transform:'translateX(-50%)',
            opacity: cardHov ? 0.55 : 0, transition:'opacity .2s',
            fontSize:7.5, color:'rgba(255,255,255,.9)', whiteSpace:'nowrap', pointerEvents:'none',
            display:'flex', alignItems:'center', gap:2,
          }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.74"/>
            </svg>
            Ver info
          </div>

          {/* WA + Call — absoluto inferior */}
          {a.telefono && (
            <div onClick={e => e.stopPropagation()}
              style={{ position:'absolute', bottom:6, left:8, right:8, display:'flex', gap:6 }}>
              <a href={`https://wa.me/57${phone}`} target="_blank" rel="noopener noreferrer"
                {...h('wa')}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'3px 0', borderRadius:50, background:'#25D366', textDecoration:'none',
                  boxShadow: hov==='wa' ? '0 0 14px rgba(37,211,102,.55)' : '0 2px 8px rgba(37,211,102,.35)',
                  transform: hov==='wa' ? 'scale(1.04)' : 'scale(1)', transition:'all .18s',
                }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.5l5.797-1.448A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.493-5.183-1.355l-.371-.22-3.441.859.924-3.357-.242-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              </a>
              <a href={`tel:${a.telefono}`} {...h('tel')}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'3px 0', borderRadius:50,
                  background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)',
                  textDecoration:'none',
                  boxShadow: hov==='tel' ? '0 0 14px rgba(255,255,255,.4)' : 'none',
                  transform: hov==='tel' ? 'scale(1.04)' : 'scale(1)', transition:'all .18s',
                }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* ══════ BACK ══════ */}
        <div
          style={{
            position:'absolute', top:0, left:0, right:0, bottom:0,
            backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            transform:'rotateY(180deg)',
            borderRadius:14, overflow:'hidden',
            background: GRAD_A,
            border:'1px solid rgba(255,255,255,.45)',
            display:'flex', flexDirection:'column',
          }}
        >
          {/* Header mini flip */}
          <div style={{
            padding:'3px 6px', display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'rgba(0,0,0,.15)', borderBottom:'1px solid rgba(255,255,255,.2)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0, flex:1 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                background: showImg ? 'transparent' : GRADIENTS[idx % GRADIENTS.length],
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:8, fontWeight:800, color:'#fff',
              }}>
                {showImg
                  ? <img src={a.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : ini
                }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:9, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textShadow:'0 1px 3px rgba(0,0,0,.18)' }}>
                  {a.nombre} {a.apellido}
                </div>
                <span style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,.9)', background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.3)', padding:'0 4px', borderRadius:50, marginTop:1, display:'inline-block' }}>
                  {(a.roles && a.roles.length > 0) ? a.roles.map(r => r.replace(/_/g, ' ')).join(' • ') : 'Servidor'}
                </span>
              </div>
            </div>

            {/* Volver button */}
            <button onClick={e => { e.stopPropagation(); setFlipped(false) }}
              style={{
                background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)',
                borderRadius:50, color:'#fff', cursor:'pointer', padding:'1px 5px',
                fontSize:7.5, fontWeight:700, display:'flex', alignItems:'center', gap:2, flexShrink:0,
              }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.74"/>
              </svg>
              Volver
            </button>
          </div>

          {/* Cuerpo premium macOS — tonos teal */}
          <div style={{
            flex:1, overflow:'hidden',
            background:[
              'repeating-linear-gradient(180deg,rgba(13,148,136,.028) 0px,rgba(13,148,136,.028) 1px,transparent 1px,transparent 44px)',
              'linear-gradient(160deg,rgba(236,253,245,.97) 0%,rgba(204,251,241,.95) 50%,rgba(224,247,250,.97) 100%)',
            ].join(','),
            backdropFilter:'blur(20px)',
            WebkitBackdropFilter:'blur(20px)',
            padding:'4px 6px 6px',
            display:'flex', flexDirection:'column', justifyContent:'space-between',
          }}>
            {/* Info grid compacta */}
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {a.cedula && (
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" style={{ flexShrink:0 }}>
                    <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/>
                  </svg>
                  <span style={{ fontSize:8, color:'#334155', fontWeight:600 }}>CC {a.cedula}</span>
                </div>
              )}
              {a.telefono && (
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" style={{ flexShrink:0 }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span style={{ fontSize:8, color:'#334155', fontWeight:600 }}>{a.telefono}</span>
                </div>
              )}
              {ingreso && (
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" style={{ flexShrink:0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span style={{ fontSize:7.5, color:'#64748b' }}>Desde {ingreso}</span>
                </div>
              )}
            </div>

            {/* Acciones Editar / Eliminar */}
            <div style={{ display:'flex', gap:4, marginTop:4 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setFlipped(false); onEdit() }}
                style={{
                  flex:1, padding:'2.5px 0', borderRadius:6, border:'1px solid rgba(13,148,136,.3)',
                  background:'rgba(255,255,255,.8)', color:'#0d9488', fontSize:8, fontWeight:700,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:3,
                  boxShadow:'0 1px 3px rgba(0,0,0,.05)',
                }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
              <button onClick={() => { setFlipped(false); onDelete() }}
                style={{
                  flex:1, padding:'2.5px 0', borderRadius:6, border:'1px solid rgba(239,68,68,.3)',
                  background:'rgba(254,242,242,.9)', color:'#ef4444', fontSize:8, fontWeight:700,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:3,
                  boxShadow:'0 1px 3px rgba(0,0,0,.05)',
                }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ── Logo premium con efecto tallado ───────────────────────────────────── */
function LogoCircle({ size }: { size: number }) {
  const inner = Math.round(size * 0.72)
  return (
    <div style={{
      width:        size,
      height:       size,
      borderRadius: '50%',
      flexShrink:   0,
      background:   '#ffffff',
      boxShadow:    [
        '0 8px 28px rgba(0,0,0,.18)',
        '0 2px 6px  rgba(0,0,0,.10)',
        'inset 3px 3px 6px  rgba(255,255,255,.9)',
        'inset -3px -3px 6px rgba(0,0,0,.12)',
      ].join(', '),
      display:       'flex',
      alignItems:    'center',
      justifyContent:'center',
    }}>
      <div style={{
        width:        inner,
        height:       inner,
        borderRadius: '50%',
        background:   '#ffffff',
        boxShadow:    'inset 0 0 0 1.5px rgba(0,0,0,.06)',
        display:       'flex',
        alignItems:    'center',
        justifyContent:'center',
        overflow:      'hidden',
      }}>
        <img
          src="/asp-kids-logo.png"
          alt="ASP Kids"
          style={{ width:'88%', height:'88%', objectFit:'contain' }}
        />
      </div>
    </div>
  )
}
