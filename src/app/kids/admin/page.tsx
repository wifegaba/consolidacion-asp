'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminModal,         { type KidsAdmin }        from './components/AdminModal'
import MaestroModal,      { type KidsMaestro }       from './components/MaestroModal'
import CoordinadorModal,  { type KidsCoordinador }  from './components/CoordinadorModal'
import ObservacionesModal                           from './components/ObservacionesModal'
import NinosSection                                 from './components/NinosSection'
import AsistenciasSection                           from './components/AsistenciasSection'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Usuario {
  id:       string
  nombre:   string
  apellido: string
  cedula:   string
  foto_url: string | null
}

type FilterTab = 'todos' | 'activos' | 'inactivos'

/* ── Navigation items ───────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { num: '01', label: 'Dashboard',       section: 'dashboard'       },
  { num: '02', label: 'Administradores', section: 'administradores' },
  { num: '03', label: 'Coordinadores',   section: 'coordinadores'   },
  { num: '04', label: 'Maestros',        section: 'maestros'        },
  { num: '05', label: 'Auxiliares',      section: 'auxiliares'      },
  { num: '06', label: 'Rotaciones',      section: 'rotaciones'      },
  { num: '07', label: 'Niños',           section: 'ninos'           },
  { num: '08', label: 'Asistencias',     section: 'asistencias'     },
  { num: '09', label: 'Seguimientos',    section: 'seguimientos'    },
] as const

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
  // ── Administradores ─────────────────────────────────────────────────────
  const [admins,         setAdmins]         = useState<KidsAdmin[]>([])
  const [loadingAdmins,  setLoadingAdmins]  = useState(true)
  const [adminFilter,    setAdminFilter]    = useState<FilterTab>('todos')
  const [adminSearch,    setAdminSearch]    = useState('')
  const [adminModal,     setAdminModal]     = useState(false)
  const [editAdmin,      setEditAdmin]      = useState<KidsAdmin | null>(null)
  const [deletingAdminId,setDeletingAdminId]= useState<string | null>(null)
  // ── Maestros ─────────────────────────────────────────────────────────────
  const [maestros,       setMaestros]       = useState<KidsMaestro[]>([])
  const [loadingMaestros,setLoadingMaestros]= useState(true)
  const [maestroFilter,  setMaestroFilter]  = useState<FilterTab>('todos')
  const [maestroSearch,  setMaestroSearch]  = useState('')
  const [maestroModal,   setMaestroModal]   = useState(false)
  const [editMaestro,    setEditMaestro]    = useState<KidsMaestro | null>(null)
  const [deletingMaestroId,setDeletingMaestroId] = useState<string | null>(null)
  // ── Coordinadores ────────────────────────────────────────────────────────
  const [coordinadores,        setCoordinadores]        = useState<KidsCoordinador[]>([])
  const [loadingCoordinadores, setLoadingCoordinadores] = useState(true)
  const [coordinadorFilter,    setCoordinadorFilter]    = useState<FilterTab>('todos')
  const [coordinadorSearch,    setCoordinadorSearch]    = useState('')
  const [coordinadorModal,     setCoordinadorModal]     = useState(false)
  const [editCoordinador,      setEditCoordinador]      = useState<KidsCoordinador | null>(null)
  const [deletingCoordinadorId,setDeletingCoordinadorId]= useState<string | null>(null)
  // ── Shared ───────────────────────────────────────────────────────────────
  const [activeNav,      setActiveNav]      = useState<string>('administradores')
  const [displayNav,     setDisplayNav]     = useState<string>('administradores')
  const [animPhase,      setAnimPhase]      = useState<'enter' | 'exit' | 'idle'>('idle')
  const [isMobile,       setIsMobile]       = useState(false)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [logoNavOpen,    setLogoNavOpen]    = useState(false)
  const [logoPressed,    setLogoPressed]    = useState(false)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [coordMaestrosModal, setCoordMaestrosModal] = useState<KidsCoordinador | null>(null)
  const [obsModal,           setObsModal]           = useState<{ maestro: KidsMaestro; coordinador: KidsCoordinador | null } | null>(null)

  // Aliases for the active section
  const loading   = displayNav === 'maestros'      ? loadingMaestros
                  : displayNav === 'coordinadores' ? loadingCoordinadores
                  : loadingAdmins
  const filter    = displayNav === 'maestros'      ? maestroFilter
                  : displayNav === 'coordinadores' ? coordinadorFilter
                  : adminFilter
  const setFilter = displayNav === 'maestros'      ? setMaestroFilter
                  : displayNav === 'coordinadores' ? setCoordinadorFilter
                  : setAdminFilter
  const search    = displayNav === 'maestros'      ? maestroSearch
                  : displayNav === 'coordinadores' ? coordinadorSearch
                  : adminSearch
  const setSearch = displayNav === 'maestros'      ? setMaestroSearch
                  : displayNav === 'coordinadores' ? setCoordinadorSearch
                  : setAdminSearch

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

  /* ── Fetch admins ─────────────────────────────────────────────────────── */
  const fetchAdmins = useCallback(async () => {
    setLoadingAdmins(true)
    try {
      const res  = await fetch('/api/kids/administradores')
      const json = await res.json()
      if (json.ok) setAdmins(json.data ?? [])
    } catch { /* silently ignore */ }
    finally { setLoadingAdmins(false) }
  }, [])

  /* ── Fetch maestros ───────────────────────────────────────────────────── */
  const fetchMaestros = useCallback(async () => {
    setLoadingMaestros(true)
    try {
      const res  = await fetch('/api/kids/maestros')
      const json = await res.json()
      if (json.ok) setMaestros(json.data ?? [])
    } catch { /* silently ignore */ }
    finally { setLoadingMaestros(false) }
  }, [])

  /* ── Fetch coordinadores ──────────────────────────────────────────────── */
  const fetchCoordinadores = useCallback(async () => {
    setLoadingCoordinadores(true)
    try {
      const res  = await fetch('/api/kids/coordinadores')
      const json = await res.json()
      if (json.ok) setCoordinadores(json.data ?? [])
    } catch { /* silently ignore */ }
    finally { setLoadingCoordinadores(false) }
  }, [])

  useEffect(() => { fetchAdmins() },        [fetchAdmins])
  useEffect(() => { fetchMaestros() },      [fetchMaestros])
  useEffect(() => { fetchCoordinadores() }, [fetchCoordinadores])

  /* ── Derived data ─────────────────────────────────────────────────────── */
  const isMaestrosView      = displayNav === 'maestros'
  const isCoordinadoresView = displayNav === 'coordinadores'
  const activeList          = isMaestrosView      ? maestros
                            : isCoordinadoresView ? coordinadores
                            : admins
  const totalActivos     = activeList.filter(a => a.activo).length
  const ultimoIngreso    = activeList[0]?.creado_en ? lastLogin(activeList[0].creado_en) : '—'
  const ultimaFecha      = activeList[0]?.creado_en
    ? new Date(activeList[0].creado_en).toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' })
    : ''

  const filtered = activeList.filter(a => {
    const matchFilter =
      filter === 'todos'    ? true :
      filter === 'activos'  ? a.activo :
      !a.activo

    const q = search.toLowerCase().trim()
    const matchSearch = !q ||
      a.nombre.toLowerCase().includes(q)   ||
      a.apellido.toLowerCase().includes(q) ||
      a.cedula.includes(q)

    return matchFilter && matchSearch
  })

  /* ── Actions ──────────────────────────────────────────────────────────── */
  function openCreate() {
    if (isMaestrosView)      { setEditMaestro(null);      setMaestroModal(true)      }
    else if (isCoordinadoresView) { setEditCoordinador(null); setCoordinadorModal(true) }
    else                     { setEditAdmin(null);        setAdminModal(true)        }
  }
  function openEdit(a: KidsAdmin | KidsMaestro | KidsCoordinador) {
    if (isMaestrosView)      { setEditMaestro(a as KidsMaestro);           setMaestroModal(true)      }
    else if (isCoordinadoresView) { setEditCoordinador(a as KidsCoordinador); setCoordinadorModal(true) }
    else                     { setEditAdmin(a as KidsAdmin);                setAdminModal(true)        }
  }

  async function handleAdminSaved() {
    setAdminModal(false)
    await fetchAdmins()
  }

  async function handleMaestroSaved() {
    setMaestroModal(false)
    await fetchMaestros()
  }

  async function handleCoordinadorSaved() {
    setCoordinadorModal(false)
    await fetchCoordinadores()
  }

  async function handleDelete(a: KidsAdmin | KidsMaestro | KidsCoordinador) {
    if (!window.confirm(
      `¿Desactivar a ${a.nombre} ${a.apellido}?\n\nEl registro no se eliminará, solo quedará inactivo.`
    )) return

    if (isMaestrosView) {
      setDeletingMaestroId(a.id)
      try {
        const res = await fetch(`/api/kids/maestros/${a.id}`, { method: 'DELETE' })
        if (res.ok) await fetchMaestros()
      } finally { setDeletingMaestroId(null) }
    } else if (isCoordinadoresView) {
      setDeletingCoordinadorId(a.id)
      try {
        const res = await fetch(`/api/kids/coordinadores/${a.id}`, { method: 'DELETE' })
        if (res.ok) await fetchCoordinadores()
      } finally { setDeletingCoordinadorId(null) }
    } else {
      setDeletingAdminId(a.id)
      try {
        const res = await fetch(`/api/kids/administradores/${a.id}`, { method: 'DELETE' })
        if (res.ok) await fetchAdmins()
      } finally { setDeletingAdminId(null) }
    }
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
          transform: perspective(1000px) translateY(72px) rotateX(6deg) scale(0.93);
          box-shadow: 0 -40px 80px rgba(124,58,237,0);
        }
        40% {
          opacity: 1;
          box-shadow: 0 -24px 60px rgba(124,58,237,.22);
        }
        72% {
          transform: perspective(1000px) translateY(-6px) rotateX(-1deg) scale(1.004);
        }
        100% {
          opacity: 1;
          transform: perspective(1000px) translateY(0) rotateX(0deg) scale(1);
          box-shadow: 0 -8px 32px rgba(124,58,237,.10);
        }
      }

      /* ── Niños — shimmer overlay que desaparece al entrar ── */
      @keyframes ninosShimmerFade {
        0%   { opacity: 1; }
        60%  { opacity: .18; }
        100% { opacity: 0; pointer-events: none; }
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
            SIDEBAR
        ════════════════════════════════════════ */}
        <aside style={{
          width:         230,
          minWidth:      230,
          background:    'rgba(255,255,255,.22)',
          backdropFilter:       'blur(32px) saturate(220%)',
          WebkitBackdropFilter: 'blur(32px) saturate(220%)',
          display:       'flex',
          flexDirection: 'column',
          padding:       '32px 0',
          borderTop:     '0px solid transparent',
          borderRight:   '1px solid rgba(255,255,255,.5)',
          borderBottom:  '0px solid transparent',
          borderLeft:    '0px solid transparent',
          boxShadow:     'inset 0 1px 0 rgba(255,255,255,.8), 1px 0 0 rgba(255,255,255,.25)',
          /* Mobile: slide-in drawer */
          ...(isMobile ? {
            position:   'fixed' as const,
            top:        0,
            left:       sidebarOpen ? 0 : -260,
            bottom:     0,
            zIndex:     60,
            background:           'linear-gradient(160deg,#d4f5ec 0%,#e8e2ff 55%,#d6ecff 100%)',
            backdropFilter:       'none',
            WebkitBackdropFilter: 'none',
            boxShadow:  sidebarOpen ? '8px 0 48px rgba(0,0,0,.2)' : 'none',
            transition: 'left .25s cubic-bezier(.4,0,.2,1)',
            borderRadius: '0 20px 20px 0',
            borderTop:    '1px solid rgba(255,255,255,.45)',
            borderRight:  '1px solid rgba(255,255,255,.45)',
            borderBottom: '1px solid rgba(255,255,255,.45)',
            borderLeft:   '1px solid rgba(255,255,255,.45)',
          } : {}),
        }}>

          {/* Logo */}
          <div style={{ padding:'0 16px 28px', display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
            {/* Close button (mobile only) — esquina superior derecha */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  position:'absolute', top:0, right:16,
                  width:34, height:34, borderRadius:9, border:'1px solid #e5e7eb',
                  background:'#f9fafb', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
            {/* Logo premium circular */}
            <LogoCircle size={130} />
          </div>

          {/* Nav */}
          <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:2, padding:'0 14px' }}>
            {NAV_ITEMS.map(n => {
              const isActive = n.section === activeNav
              return (
                <div
                  key={n.num}
                  onClick={() => handleNavClick(n.section)}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        10,
                    padding:    '9px 11px',
                    borderRadius: 12,
                    cursor:     'pointer',
                    background:           isActive ? 'rgba(255,255,255,.72)' : 'transparent',
                    backdropFilter:       isActive ? 'blur(12px)'            : 'none',
                    WebkitBackdropFilter: isActive ? 'blur(12px)'            : 'none',
                    boxShadow:  isActive
                      ? '0 2px 12px rgba(0,0,0,.09), inset 0 1px 0 rgba(255,255,255,.95), 0 0 0 1px rgba(255,255,255,.5)'
                      : 'none',
                    borderLeft: `3px solid ${isActive ? '#0d9488' : 'transparent'}`,
                    transition: 'all .2s',
                  }}
                >
                  <NavIcon section={n.section} active={isActive} />
                  <span style={{
                    fontSize:   13,
                    fontWeight: isActive ? 700 : 500,
                    color:      isActive ? '#111827' : '#5a6a80',
                  }}>{n.label}</span>
                </div>
              )
            })}
          </nav>

          {/* User strip */}
          <div style={{ margin:'0 14px' }}>
            <div style={{
              padding:              '12px 12px',
              borderRadius:         14,
              background:           'rgba(255,255,255,.62)',
              border:               '1px solid rgba(255,255,255,.85)',
              backdropFilter:       'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              boxShadow:            '0 4px 16px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.95)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {/* Avatar */}
                <AvatarImg
                  src={usuario.foto_url}
                  nombre={usuario.nombre}
                  apellido={usuario.apellido}
                  grad="linear-gradient(135deg,#0d9488,#0891b2)"
                  size={34}
                />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {usuario.nombre} {usuario.apellido}
                  </div>
                  <div style={{ fontSize:10, color:'#0d9488', fontWeight:600 }}>Administrador</div>
                </div>
                {/* Logout */}
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  style={{
                    width:36, height:36, borderRadius:8, border:'none',
                    background:'transparent', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink:0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
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

          {/* ── Logo interactivo — solo móvil ── */}
          {isMobile && (
            <div style={{
              position:  'relative',
              width:     '100%',
              height:    128,
              flexShrink: 0,
            }}>
              {/* ── Items izquierda: Admin, Coordinadores ── */}
              {([
                { section: 'administradores', label: 'Admin' },
                { section: 'coordinadores',   label: 'Coord' },
              ] as const).map((item, i) => {
                const isActive = activeNav === item.section
                // left edge positions: item0 = 50%-96px, item1 = 50%-144px
                const leftPx = 96 + i * 48
                return (
                  <div
                    key={item.section}
                    onClick={() => { handleNavClick(item.section); setLogoNavOpen(false) }}
                    style={{
                      position:    'absolute',
                      left:        `calc(50% - ${leftPx}px)`,
                      top:         42,
                      display:     'flex',
                      flexDirection:'column',
                      alignItems:  'center',
                      gap:         4,
                      cursor:      'pointer',
                      pointerEvents: logoNavOpen ? 'auto' : 'none',
                      opacity:     logoNavOpen ? 1 : 0,
                      transform:   logoNavOpen
                        ? 'scale(1) translateX(0)'
                        : `scale(0.4) translateX(${leftPx - 22}px)`,
                      transition:  `opacity .26s ${i * 65}ms, transform .30s cubic-bezier(.34,1.56,.64,1) ${i * 65}ms`,
                      zIndex:      1,
                    }}
                  >
                    <div style={{
                      width:44, height:44, borderRadius:'50%',
                      background: isActive
                        ? [
                            'linear-gradient(rgba(255,255,255,.96),rgba(255,255,255,.96)) padding-box',
                            'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box',
                          ].join(',')
                        : 'rgba(255,255,255,0.92)',
                      border: isActive ? '2px solid transparent' : '2px solid rgba(0,0,0,0.09)',
                      boxShadow: isActive
                        ? '-3px 0 14px rgba(96,165,250,.42), 3px 0 14px rgba(244,114,182,.36), 0 6px 18px rgba(167,139,250,.30), inset 0 1.5px 0 rgba(255,255,255,1)'
                        : '0 3px 12px rgba(0,0,0,0.13)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      backdropFilter:'blur(8px)',
                    }}>
                      <NavIcon section={item.section} active={isActive} />
                    </div>
                    <span style={{
                      fontSize:9, fontWeight:700,
                      color: isActive ? '#7c3aed' : '#6b7280',
                      whiteSpace:'nowrap',
                    }}>{item.label}</span>
                  </div>
                )
              })}

              {/* ── Logo central — botón animado ── */}
              <div
                onPointerDown={() => setLogoPressed(true)}
                onPointerUp={() => { setLogoPressed(false); setLogoNavOpen(v => !v) }}
                onPointerLeave={() => setLogoPressed(false)}
                onPointerCancel={() => setLogoPressed(false)}
                style={{
                  position:  'absolute',
                  left:      '50%',
                  top:       16,
                  transform: `translateX(-50%) ${
                    logoPressed
                      ? 'scale(0.86)'
                      : logoNavOpen ? 'scale(0.93)' : 'scale(1)'
                  }`,
                  transition: logoPressed
                    ? 'transform .08s ease'
                    : 'transform .38s cubic-bezier(.34,1.56,.64,1)',
                  cursor:    'pointer',
                  zIndex:    2,
                  filter:    logoNavOpen
                    ? 'drop-shadow(0 0 16px rgba(96,165,250,0.65)) drop-shadow(0 0 14px rgba(244,114,182,0.55)) drop-shadow(0 4px 10px rgba(167,139,250,0.55))'
                    : logoPressed
                      ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))'
                      : 'drop-shadow(0 4px 14px rgba(0,0,0,0.18))',
                } as React.CSSProperties}
              >
                <LogoCircle size={96} />
              </div>

              {/* ── Items derecha: Maestros, Niños ── */}
              {([
                { section: 'maestros', label: 'Maestros' },
                { section: 'ninos',    label: 'Niños'    },
              ] as const).map((item, i) => {
                const isActive = activeNav === item.section
                // left edge positions: item0 = 50%+52px, item1 = 50%+100px
                const leftPx = 52 + i * 48
                return (
                  <div
                    key={item.section}
                    onClick={() => { handleNavClick(item.section); setLogoNavOpen(false) }}
                    style={{
                      position:    'absolute',
                      left:        `calc(50% + ${leftPx}px)`,
                      top:         42,
                      display:     'flex',
                      flexDirection:'column',
                      alignItems:  'center',
                      gap:         4,
                      cursor:      'pointer',
                      pointerEvents: logoNavOpen ? 'auto' : 'none',
                      opacity:     logoNavOpen ? 1 : 0,
                      transform:   logoNavOpen
                        ? 'scale(1) translateX(0)'
                        : `scale(0.4) translateX(-${leftPx + 22}px)`,
                      transition:  `opacity .26s ${i * 65}ms, transform .30s cubic-bezier(.34,1.56,.64,1) ${i * 65}ms`,
                      zIndex:      1,
                    }}
                  >
                    <div style={{
                      width:44, height:44, borderRadius:'50%',
                      background: isActive
                        ? [
                            'linear-gradient(rgba(255,255,255,.96),rgba(255,255,255,.96)) padding-box',
                            'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box',
                          ].join(',')
                        : 'rgba(255,255,255,0.92)',
                      border: isActive ? '2px solid transparent' : '2px solid rgba(0,0,0,0.09)',
                      boxShadow: isActive
                        ? '-3px 0 14px rgba(96,165,250,.42), 3px 0 14px rgba(244,114,182,.36), 0 6px 18px rgba(167,139,250,.30), inset 0 1.5px 0 rgba(255,255,255,1)'
                        : '0 3px 12px rgba(0,0,0,0.13)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      backdropFilter:'blur(8px)',
                    }}>
                      <NavIcon section={item.section} active={isActive} />
                    </div>
                    <span style={{
                      fontSize:9, fontWeight:700,
                      color: isActive ? '#7c3aed' : '#6b7280',
                      whiteSpace:'nowrap',
                    }}>{item.label}</span>
                  </div>
                )
              })}

              {/* ── Indicador de pulsación (ring animado) ── */}
              {logoNavOpen && (
                <div style={{
                  position:    'absolute',
                  left:        '50%',
                  top:         16,
                  width:       96,
                  height:      96,
                  borderRadius:'50%',
                  transform:   'translateX(-50%)',
                  background: [
                    'linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)) padding-box',
                    'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box',
                  ].join(','),
                  border:      '2px solid transparent',
                  boxShadow:   '-4px 0 18px rgba(96,165,250,.38), 4px 0 18px rgba(244,114,182,.34), 0 0 0 5px rgba(167,139,250,.12)',
                  pointerEvents:'none',
                  zIndex:       1,
                }} />
              )}
            </div>
          )}

          {/* ── Panel Niños — layout propio con sheet entrance ── */}
          {displayNav === 'ninos' && (
            <div style={{
              flex:          1,
              minHeight:     0,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
              position:      'relative',
              animation:     'ninosSheetRise 0.62s cubic-bezier(.22,1,.36,1) both',
              willChange:    'transform, opacity',
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
              <NinosSection usuario={usuario} />
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
              animation:     'ninosSheetRise 0.62s cubic-bezier(.22,1,.36,1) both',
              willChange:    'transform, opacity',
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

          {/* ── Top bar + Scroll area (todo excepto niños y asistencias) ── */}
          {displayNav !== 'ninos' && displayNav !== 'asistencias' && (<>
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        isMobile ? '8px 20px 0' : '28px 36px 0',
            flexShrink:     0,
            gap:            12,
          }}>
            {/* Left: hamburger (mobile) + title */}
            <div style={{ display:'flex', alignItems:'center', gap:isMobile ? 12 : 0 }}>
              {/* Hamburger — mobile only */}
              {isMobile && (
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
              )}
              <div>
                {!isMobile && (
                  <div style={{ fontSize:11, fontWeight:600, color:'#0d9488', letterSpacing:'2px', textTransform:'uppercase', marginBottom:4 }}>
                    Módulo Kids
                  </div>
                )}
                <div style={{ fontSize: isMobile ? 20 : 28, fontWeight:800, color:'#111827', letterSpacing:'-0.8px', lineHeight:1 }}>
                  {isMaestrosView ? 'Maestros' : isCoordinadoresView ? 'Coordinadores' : 'Administradores'}
                </div>
              </div>
            </div>

            {/* Right: search + new button */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {/* Search — hidden on mobile unless toggled */}
              {(!isMobile || searchOpen) && (
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  background:'rgba(255,255,255,.85)',
                  border:'1px solid rgba(0,0,0,.08)',
                  borderRadius:50,
                  padding:'9px 18px',
                  ...(isMobile ? { position:'absolute' as const, top:72, left:20, right:20, zIndex:10 } : {}),
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    autoFocus={isMobile}
                    onBlur={() => { if (isMobile && !search) setSearchOpen(false) }}
                    style={{ border:'none', background:'transparent', outline:'none', fontSize:12, color:'#374151', width: isMobile ? '100%' : 120 }}
                  />
                  {isMobile && (
                    <button onClick={() => { setSearch(''); setSearchOpen(false) }} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* Search icon (mobile only, when search is closed) */}
              {isMobile && !searchOpen && (
                <button
                  onClick={() => setSearchOpen(true)}
                  style={{
                    width:38, height:38, borderRadius:11,
                    border:'1px solid rgba(0,0,0,.08)',
                    background:'rgba(255,255,255,.85)',
                    cursor:'pointer', display:'flex',
                    alignItems:'center', justifyContent:'center',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </button>
              )}

              {/* CTA */}
              <button
                onClick={openCreate}
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           isMobile ? 0 : 8,
                  padding:       isMobile ? '0' : '10px 22px',
                  width:         isMobile ? 38 : 'auto',
                  height:        isMobile ? 38 : 'auto',
                  borderRadius:  isMobile ? 11 : 50,
                  fontSize:      13,
                  fontWeight:    700,
                  background:    'linear-gradient(135deg,#0d9488,#0891b2)',
                  color:         '#fff',
                  border:        'none',
                  cursor:        'pointer',
                  boxShadow:     '0 8px 20px rgba(13,148,136,.35)',
                  letterSpacing: '0.2px',
                  justifyContent:'center',
                  flexShrink:    0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                {!isMobile && (isMaestrosView ? 'Nuevo Maestro' : isCoordinadoresView ? 'Nuevo Coordinador' : 'Nuevo Admin')}
              </button>
            </div>
          </div>

          {/* ── Scroll area ── */}
          <div
            style={{
              flex:1, minHeight:0, overflowY:'auto',
              padding: isMobile ? '20px 16px 32px' : '24px 36px 32px',
              display:'flex', flexDirection:'column', gap:16,
              position:'relative',
            }}
          >

            {/* ── Stats bento ── */}
            <div style={{
              display:'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(0, 180px))',
              gap:12,
              flexShrink:0,
              justifyContent: 'start',
            }}>
              {[
                {
                  label:  'Total',
                  val:    String(activeList.length),
                  sub:    isMaestrosView ? 'Maestros' : isCoordinadoresView ? 'Coordinadores' : 'Administradores',
                  accent: isMaestrosView ? '#7c3aed' : isCoordinadoresView ? '#d97706' : '#0d9488',
                },
                {
                  label:  'Activos',
                  val:    String(totalActivos),
                  sub:    'En servicio',
                  accent: '#3b82f6',
                },
                {
                  label:  'Último reg.',
                  val:    ultimoIngreso,
                  sub:    ultimaFecha,
                  accent: '#f59e0b',
                  wide:   true,
                },
              ].map((s, i) => (
                <div key={s.label} style={{
                  /* ── Liquid Glass — fondo blanco + borde iridiscente con glow ── */
                  background: [
                    /* interior blanco (padding-box) */
                    'linear-gradient(rgba(255,255,255,.94),rgba(255,255,255,.94)) padding-box',
                    /* borde holográfico azul → violeta → rosa → aqua */
                    'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box',
                  ].join(','),
                  backdropFilter:       'blur(40px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                  border:               '2px solid transparent',
                  borderRadius:         isMobile ? 20 : 24,
                  boxShadow: [
                    /* glow exterior izquierda azul */
                    '-5px 0 18px rgba(96,165,250,.30)',
                    /* glow exterior derecha rosa */
                    '5px 0 18px rgba(244,114,182,.28)',
                    /* glow exterior abajo violeta suave */
                    '0 12px 36px rgba(167,139,250,.20)',
                    /* sombra base */
                    '0 4px 14px rgba(0,0,0,.07)',
                    /* specular top — línea blanca que simula el vidrio */
                    'inset 0 1.5px 0 rgba(255,255,255,1)',
                  ].join(', '),
                  ...(isMobile && i === 2 ? { gridColumn:'1 / -1' } : {}),
                }}>
                  <div style={{ padding: isMobile ? '12px 14px' : '14px 18px' }}>
                    <div style={{
                      fontSize:9, fontWeight:700,
                      color:'rgba(0,0,0,.38)',
                      textTransform:'uppercase', letterSpacing:'1.8px',
                      marginBottom:6,
                    }}>
                      {s.label}
                    </div>
                    <div style={{
                      fontSize:      s.wide ? (isMobile ? 16 : 18) : (isMobile ? 26 : 30),
                      fontWeight:    900,
                      color:         '#0f172a',
                      letterSpacing: s.wide ? '-0.5px' : '-1.5px',
                      lineHeight:    1.15,
                      marginBottom:  4,
                    }}>
                      {s.val}
                    </div>
                    <div style={{ fontSize:10, color:s.accent, fontWeight:700 }}>
                      {s.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Admin list card ── */}
            <div style={{
              background:   '#fff',
              borderRadius: isMobile ? 20 : 24,
              overflow:     'hidden',
              boxShadow:    '0 4px 24px rgba(0,0,0,.07)',
              border:       '1px solid rgba(0,0,0,.04)',
              flex:         1,
              minHeight:    0,
              display:      'flex',
              flexDirection:'column',
            }}>

              {/* Section header */}
              <div style={{
                display:        'flex',
                alignItems:     isMobile ? 'flex-start' : 'center',
                flexDirection:  isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                padding:        isMobile ? '16px 18px 0' : '20px 24px 0',
                gap:            isMobile ? 12 : 0,
                flexShrink:     0,
              }}>
                <div>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight:700, color:'#111827' }}>
                    {isMaestrosView ? 'Equipo de Maestros' : isCoordinadoresView ? 'Equipo de Coordinadores' : 'Equipo de Administración'}
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                    {filtered.length} de {activeList.length} perfiles
                  </div>
                </div>
                {/* Filter tabs */}
                <div style={{ display:'flex', gap:6 }}>
                  {(['todos','activos','inactivos'] as FilterTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      style={{
                        padding:     isMobile ? '5px 12px' : '5px 14px',
                        borderRadius: 50,
                        fontSize:    11,
                        fontWeight:  600,
                        border:      '1px solid',
                        cursor:      'pointer',
                        background:  filter === t ? '#0d9488' : 'transparent',
                        color:       filter === t ? '#fff'    : '#9ca3af',
                        borderColor: filter === t ? '#0d9488' : '#e5e7eb',
                        transition:  'all .15s',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strips */}
              <div style={{
                padding: isMobile ? '14px 14px 18px' : '16px 24px 20px',
                display:'flex', flexDirection:'column',
                gap: isMobile ? 10 : 10,
                flex:1, minHeight:0, overflowY:'auto',
                animation: animPhase === 'enter'
                  ? 'aspSlideInRight 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both'
                  : animPhase === 'exit'
                  ? 'aspSlideOutLeft 0.22s cubic-bezier(0.55,0,1,0.45) both'
                  : 'none',
                pointerEvents: animPhase === 'exit' ? 'none' : 'auto',
              }}>

                {loading && (
                  <div style={{ textAlign:'center', padding:'40px 0', fontSize:13, color:'#9ca3af' }}>
                    {isMaestrosView ? 'Cargando maestros...' : isCoordinadoresView ? 'Cargando coordinadores...' : 'Cargando administradores...'}
                  </div>
                )}

                {!loading && filtered.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px 0' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                    <div style={{ fontSize:13, color:'#9ca3af', fontWeight:500 }}>
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
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, minmax(0, 230px))',
                    gap:                 isMobile ? 10 : 14,
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
                        isDeleting={deletingCoordinadorId === a.id}
                        onEdit={() => openEdit(a)}
                        onDelete={() => handleDelete(a)}
                        onViewMaestros={() => setCoordMaestrosModal(a as KidsCoordinador)}
                        compact={isMobile}
                      />
                    ))}
                  </div>
                )}

                {/* ── Cards — Administradores ── */}
                {!loading && !isMaestrosView && !isCoordinadoresView && filtered.length > 0 && (
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, minmax(0, 230px))',
                    gap:                 isMobile ? 10 : 16,
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
                        isDeleting={deletingAdminId === a.id}
                        onEdit={() => openEdit(a)}
                        onDelete={() => handleDelete(a)}
                        compact={isMobile}
                      />
                    ))}
                  </div>
                )}

                {/* ── Strips — solo Maestros ── */}
                {!loading && isMaestrosView && filtered.map((a, idx) => {
                  const isDeleting = deletingMaestroId === a.id

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
      {adminModal && (
        <AdminModal
          admin={editAdmin}
          onClose={() => setAdminModal(false)}
          onSave={handleAdminSaved}
        />
      )}
      {maestroModal && (
        <MaestroModal
          maestro={editMaestro}
          onClose={() => setMaestroModal(false)}
          onSave={handleMaestroSaved}
        />
      )}
      {coordinadorModal && (
        <CoordinadorModal
          coordinador={editCoordinador}
          onClose={() => setCoordinadorModal(false)}
          onSave={handleCoordinadorSaved}
        />
      )}
      {coordMaestrosModal && (
        <CoordinadorMaestrosModal
          coordinador={coordMaestrosModal}
          maestros={maestros.filter(m => m.grupo === coordMaestrosModal.grupo_asignado)}
          onClose={() => setCoordMaestrosModal(null)}
          onSelectMaestro={m => setObsModal({ maestro: m, coordinador: coordMaestrosModal })}
        />
      )}
      {obsModal && (
        <ObservacionesModal
          maestro={obsModal.maestro}
          coordinador={obsModal.coordinador}
          onClose={() => setObsModal(null)}
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
   AdminCard — Premium credential card
══════════════════════════════════════════════════════════════════════════ */
function AdminCard({
  a, idx, isDeleting, onEdit, onDelete, compact,
}: {
  a:          KidsAdmin
  idx:        number
  isDeleting: boolean
  onEdit:     () => void
  onDelete:   () => void
  compact?:   boolean
}) {
  const [broken, setBroken] = useState(false)
  const [hov, setHov] = useState<string | null>(null)
  const showImg = a.foto_url && !broken
  const ini     = `${a.nombre.charAt(0)}${a.apellido.charAt(0)}`.toUpperCase()
  const grad    = GRADIENTS[idx % GRADIENTS.length]
  const phone   = a.telefono?.replace(/\D/g,'').replace(/^57/,'')
  const h = (id: string) => ({ onMouseEnter: () => setHov(id), onMouseLeave: () => setHov(null) })

  /* ── Tamaños según modo ── */
  const photoSize  = compact ? 90  : 110
  const fontSize32 = compact ? 24  : 32

  return (
    <div style={{
      borderRadius:        compact ? 18 : 20,
      background:          'linear-gradient(145deg,#5eead4 0%,#a78bfa 55%,#7dd3fc 100%)',
      border:              '1px solid rgba(255,255,255,.55)',
      boxShadow:           '0 8px 32px rgba(124,58,237,.18), 0 2px 8px rgba(0,0,0,.07), inset 0 1px 0 rgba(255,255,255,.6)',
      opacity:             isDeleting ? .5 : 1,
      transition:          'all .2s',
      display:             'flex',
      flexDirection:       'column',
      alignItems:          'center',
      padding:             compact ? '10px 8px 10px' : '14px 14px 12px',
    }}>

      {/* Badge ADMINISTRADOR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', marginBottom: compact ? 10 : 16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4,
          background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.5)',
          padding: compact ? '4px 8px' : '5px 12px', borderRadius:50,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M2 20h20v2H2zM3 13l4-8 5 4 5-4 4 8H3z"/></svg>
          <span style={{ fontSize: compact ? 8 : 9, fontWeight:800, color:'#fff', letterSpacing: compact ? '1px' : '2px', textTransform:'uppercase' }}>
            {compact ? 'Admin' : 'Administrador'}
          </span>
        </div>
      </div>

      {/* Foto */}
      <div style={{
        width:photoSize, height:photoSize, borderRadius:'50%',
        border:'3px solid rgba(255,255,255,.85)',
        boxShadow:'0 0 0 3px rgba(245,158,11,.55), 0 8px 24px rgba(0,0,0,.22)',
        overflow:'hidden', flexShrink:0,
        background: showImg ? 'transparent' : grad,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:fontSize32, fontWeight:800, color:'#fff',
        marginBottom: compact ? 8 : 10,
      }}>
        {showImg
          ? <img src={a.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={() => setBroken(true)} />
          : ini
        }
      </div>

      {/* Nombre + teléfono (compact: phone aquí; desktop: en info rows) */}
      <div style={{ textAlign:'center', marginBottom: compact ? 8 : 10, width:'100%', paddingInline: compact ? 2 : 0 }}>
        <div style={{
          fontSize: compact ? 12 : 14,
          fontWeight:800, color:'#fff', lineHeight:1.25,
          textShadow:'0 1px 4px rgba(0,0,0,.2)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {a.nombre} {a.apellido}
        </div>
        <div style={{ fontSize: compact ? 9 : 10, color:'rgba(255,255,255,.7)', fontWeight:500, marginTop:2 }}>
          Administrador Kids
        </div>
        {/* Teléfono bajo el rol — solo en compact */}
        {compact && a.telefono && (
          <div style={{
            fontSize:9, color:'rgba(255,255,255,.85)', fontWeight:600, marginTop:4,
            display:'flex', alignItems:'center', justifyContent:'center', gap:4,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            {a.telefono}
          </div>
        )}
      </div>

      {/* Info rows — solo en desktop */}
      {!compact && (
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:0, marginBottom:10,
          borderTop:'1px solid rgba(255,255,255,.25)', borderBottom:'1px solid rgba(255,255,255,.25)', padding:'8px 0',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.65)', fontWeight:500 }}>CC</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#fff', marginLeft:'auto' }}>{a.cedula}</span>
          </div>
          {a.telefono && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderTop:'1px solid rgba(255,255,255,.12)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.65)', fontWeight:500 }}>Tel.</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#fff', marginLeft:'auto' }}>{a.telefono}</span>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp + Llamar — solo iconos */}
      {a.telefono && (
        <div style={{ display:'flex', gap: compact ? 6 : 8, marginBottom: compact ? 6 : 8, width:'100%' }}>
          <a href={`https://wa.me/57${phone}`} target="_blank" rel="noopener noreferrer"
            title="WhatsApp"
            {...h('wa')}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              padding: compact ? '7px 0' : '9px 0', borderRadius:50,
              background:'#25D366', textDecoration:'none',
              boxShadow: hov === 'wa' ? '0 0 24px rgba(37,211,102,.52)' : '0 4px 12px rgba(37,211,102,.4)',
              transform: hov === 'wa' ? 'scale(1.04)' : 'scale(1)',
              transition:'all .22s cubic-bezier(.4,0,.2,1)',
            }}>
            <svg width={compact ? 15 : 16} height={compact ? 15 : 16} viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.5l5.797-1.448A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.493-5.183-1.355l-.371-.22-3.441.859.924-3.357-.242-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </a>
          <a href={`tel:${a.telefono}`}
            title="Llamar"
            {...h('tel')}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              padding: compact ? '7px 0' : '9px 0', borderRadius:50,
              background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.45)',
              textDecoration:'none',
              boxShadow: hov === 'tel' ? '0 0 22px rgba(200,210,255,.55)' : 'none',
              transform: hov === 'tel' ? 'scale(1.04)' : 'scale(1)',
              transition:'all .22s cubic-bezier(.4,0,.2,1)',
            }}>
            <svg width={compact ? 15 : 16} height={compact ? 15 : 16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>
        </div>
      )}

      {/* Edit + Delete */}
      <div style={{ display:'flex', gap: compact ? 5 : 8, width:'100%' }}>
        <button onClick={onEdit} {...h('edit')} style={{
          flex:1, padding: compact ? '6px 0' : '8px 0', borderRadius:50, cursor:'pointer',
          background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.5)',
          color:'#fff', fontSize: compact ? 10 : 11, fontWeight:700,
          boxShadow: hov === 'edit'
            ? '0 0 22px rgba(255,255,255,.52), inset 0 1px 0 rgba(255,255,255,.4)'
            : 'inset 0 1px 0 rgba(255,255,255,.4)',
          transform:  hov === 'edit' ? 'scale(1.03)' : 'scale(1)',
          transition: 'all .22s cubic-bezier(.4,0,.2,1)',
        }}>Editar</button>
        <button onClick={() => !isDeleting && onDelete()} disabled={isDeleting} {...h('del')} style={{
          width: compact ? 30 : 36, height: compact ? 30 : 36, borderRadius:50,
          border:'1px solid rgba(255,100,100,.5)',
          background: hov === 'del' ? 'rgba(244,63,94,.32)' : 'rgba(244,63,94,.2)',
          cursor: isDeleting ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          boxShadow: hov === 'del' && !isDeleting ? '0 0 20px rgba(244,63,94,.45)' : 'none',
          transform: hov === 'del' && !isDeleting ? 'scale(1.1)' : 'scale(1)',
          transition:'all .22s cubic-bezier(.4,0,.2,1)',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── CoordinadorCard gradient — rosa-violeta cálida ─────────────────────── */

function CoordinadorCard({
  c, isDeleting, onEdit, onDelete, onViewMaestros, compact,
}: {
  c:               KidsCoordinador
  idx:             number
  isDeleting:      boolean
  onEdit:          () => void
  onDelete:        () => void
  onViewMaestros:  () => void
  compact?:        boolean
}) {
  const [broken, setBroken]   = useState(false)
  const [hov, setHov]         = useState<string | null>(null)
  const [cardHov, setCardHov] = useState(false)
  const showImg = c.foto_url && !broken
  const ini     = `${c.nombre.charAt(0)}${c.apellido.charAt(0)}`.toUpperCase()
  const phone   = c.telefono?.replace(/\D/g,'').replace(/^57/,'')
  const h = (id: string) => ({ onMouseEnter: () => setHov(id), onMouseLeave: () => setHov(null) })

  return (
    <div
      onClick={onViewMaestros}
      onMouseEnter={() => setCardHov(true)}
      onMouseLeave={() => setCardHov(false)}
      style={{
        borderRadius:        compact ? 18 : 20,
        background:          'linear-gradient(145deg,#f9a8d4 0%,#c084fc 52%,#818cf8 100%)',
        border:              '1px solid rgba(255,255,255,.55)',
        boxShadow:           cardHov
          ? '0 16px 48px rgba(192,132,252,.45), 0 4px 16px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.7)'
          : '0 8px 32px rgba(192,132,252,.22), 0 2px 8px rgba(0,0,0,.07), inset 0 1px 0 rgba(255,255,255,.6)',
        opacity:             isDeleting ? .5 : 1,
        transform:           cardHov ? 'translateY(-3px) scale(1.012)' : 'translateY(0) scale(1)',
        transition:          'all .25s cubic-bezier(.4,0,.2,1)',
        display:             'flex',
        flexDirection:       'column',
        alignItems:          'center',
        padding:             compact ? '10px 8px 10px' : '14px 14px 12px',
        cursor:              'pointer',
      }}
    >

      {/* Badge COORDINADORA */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', marginBottom: compact ? 8 : 12 }}>
        <div style={{ display:'flex', alignItems:'center', gap: compact ? 4 : 6,
          background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.5)',
          padding: compact ? '4px 8px' : '5px 12px', borderRadius:50,
        }}>
          <svg width={compact ? 9 : 11} height={compact ? 9 : 11} viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span style={{ fontSize: compact ? 8 : 9, fontWeight:800, color:'#fff', letterSpacing: compact ? '1px' : '2px', textTransform:'uppercase' }}>
            {compact ? 'Coord' : 'Coordinadora'}
          </span>
        </div>
      </div>

      {/* Foto */}
      <div style={{
        width: compact ? 90 : 110, height: compact ? 90 : 110, borderRadius:'50%',
        border:'3px solid rgba(255,255,255,.85)',
        boxShadow:'0 0 0 3px rgba(251,191,36,.5), 0 8px 24px rgba(0,0,0,.22)',
        overflow:'hidden', flexShrink:0,
        background: showImg ? 'transparent' : 'linear-gradient(135deg,#f472b6,#c084fc)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: compact ? 24 : 32, fontWeight:800, color:'#fff',
        marginBottom: compact ? 8 : 10,
      }}>
        {showImg
          ? <img src={c.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={() => setBroken(true)} />
          : ini
        }
      </div>

      {/* Nombre */}
      <div style={{ textAlign:'center', marginBottom: compact ? 6 : 8, width:'100%', paddingInline: compact ? 2 : 0 }}>
        <div style={{
          fontSize: compact ? 12 : 14, fontWeight:800, color:'#fff', lineHeight:1.25,
          textShadow:'0 1px 4px rgba(0,0,0,.2)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {c.nombre} {c.apellido}
        </div>
        <div style={{ fontSize: compact ? 9 : 10, color:'rgba(255,255,255,.7)', fontWeight:500, marginTop: compact ? 2 : 3 }}>
          Coordinadora Kids
        </div>
      </div>

      {/* Grupo badge */}
      {c.grupo_asignado && (
        <div style={{
          background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.45)',
          color:'#fff', padding: compact ? '2px 10px' : '3px 14px', borderRadius:50,
          fontSize: compact ? 9 : 10, fontWeight:800, marginBottom: compact ? 6 : 10, letterSpacing:'0.5px',
          maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {c.grupo_asignado}
        </div>
      )}

      {/* Info rows — solo desktop */}
      {!compact && (
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:0, marginBottom:10,
          borderTop:'1px solid rgba(255,255,255,.25)', borderBottom:'1px solid rgba(255,255,255,.25)', padding:'8px 0',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.65)', fontWeight:500 }}>CC</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#fff', marginLeft:'auto' }}>{c.cedula}</span>
          </div>
          {c.telefono && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', borderTop:'1px solid rgba(255,255,255,.12)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.65)', fontWeight:500 }}>Tel.</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#fff', marginLeft:'auto' }}>{c.telefono}</span>
            </div>
          )}
          {(c.edad ?? 0) > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', borderTop:'1px solid rgba(255,255,255,.12)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.65)', fontWeight:500 }}>Edad</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#fff', marginLeft:'auto' }}>{c.edad} años</span>
            </div>
          )}
        </div>
      )}

      {/* Hint: toca para ver maestros — solo desktop */}
      {!compact && (
        <div style={{
          fontSize:9, color:'rgba(255,255,255,.5)', fontWeight:600,
          letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10,
          display:'flex', alignItems:'center', gap:5,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <path d="M20 10v4a8 8 0 0 1-16 0v-4"/>
          </svg>
          Toca para ver maestros
        </div>
      )}

      {/* WhatsApp + Llamar — solo iconos */}
      {c.telefono && (
        <div style={{ display:'flex', gap: compact ? 6 : 8, marginBottom: compact ? 6 : 8, width:'100%' }}>
          <a href={`https://wa.me/57${phone}`} target="_blank" rel="noopener noreferrer"
            title="WhatsApp"
            onClick={e => e.stopPropagation()}
            {...h('wa')}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              padding: compact ? '7px 0' : '9px 0', borderRadius:50,
              background:'#25D366', textDecoration:'none',
              boxShadow:  hov === 'wa' ? '0 0 22px rgba(37,211,102,.52), 0 6px 18px rgba(37,211,102,.38)' : '0 4px 12px rgba(37,211,102,.35)',
              transform:  hov === 'wa' ? 'scale(1.04)' : 'scale(1)',
              transition: 'all .22s cubic-bezier(.4,0,.2,1)',
            }}>
            <svg width={compact ? 15 : 16} height={compact ? 15 : 16} viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.5l5.797-1.448A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.493-5.183-1.355l-.371-.22-3.441.859.924-3.357-.242-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </a>
          <a href={`tel:${c.telefono}`}
            title="Llamar"
            onClick={e => e.stopPropagation()}
            {...h('tel')}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              padding: compact ? '7px 0' : '9px 0', borderRadius:50,
              background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.45)',
              textDecoration:'none',
              boxShadow:  hov === 'tel' ? '0 0 22px rgba(255,200,240,.55), 0 6px 16px rgba(200,180,255,.35)' : 'none',
              transform:  hov === 'tel' ? 'scale(1.04)' : 'scale(1)',
              transition: 'all .22s cubic-bezier(.4,0,.2,1)',
            }}>
            <svg width={compact ? 15 : 16} height={compact ? 15 : 16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>
        </div>
      )}

      {/* Edit + Delete */}
      <div style={{ display:'flex', gap: compact ? 5 : 8, width:'100%' }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          {...h('edit')}
          style={{
            flex:1, padding: compact ? '6px 0' : '8px 0', borderRadius:50, cursor:'pointer',
            background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.5)',
            color:'#fff', fontSize: compact ? 10 : 11, fontWeight:700,
            boxShadow:  hov === 'edit'
              ? '0 0 22px rgba(255,255,255,.52), inset 0 1px 0 rgba(255,255,255,.4)'
              : 'inset 0 1px 0 rgba(255,255,255,.4)',
            transform:  hov === 'edit' ? 'scale(1.03)' : 'scale(1)',
            transition: 'all .22s cubic-bezier(.4,0,.2,1)',
          }}>Editar</button>
        <button
          onClick={e => { e.stopPropagation(); if (!isDeleting) onDelete() }}
          disabled={isDeleting}
          {...h('del')}
          style={{
            width: compact ? 30 : 36, height: compact ? 30 : 36, borderRadius:50,
            border:'1px solid rgba(255,100,100,.5)',
            background: hov === 'del' ? 'rgba(244,63,94,.32)' : 'rgba(244,63,94,.2)',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            boxShadow:  hov === 'del' && !isDeleting ? '0 0 20px rgba(244,63,94,.45), 0 4px 12px rgba(244,63,94,.28)' : 'none',
            transform:  hov === 'del' && !isDeleting ? 'scale(1.1)' : 'scale(1)',
            transition: 'all .22s cubic-bezier(.4,0,.2,1)',
          }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   CoordinadorMaestrosModal — Premium modal: maestros del grupo
══════════════════════════════════════════════════════════════════════════ */
function CoordinadorMaestrosModal({
  coordinador, maestros, onClose, onSelectMaestro,
}: {
  coordinador:     KidsCoordinador
  maestros:        KidsMaestro[]
  onClose:         () => void
  onSelectMaestro: (m: KidsMaestro) => void
}) {
  const [visible,     setVisible]     = useState(false)
  const [coordBroken, setCoordBroken] = useState(false)
  const [obsCounts,   setObsCounts]   = useState<Record<string, number>>({})
  const coordIni = `${coordinador.nombre.charAt(0)}${coordinador.apellido.charAt(0)}`.toUpperCase()

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  /* ── Fetch conteo de observaciones del grupo (1 sola llamada) ── */
  useEffect(() => {
    if (!coordinador.grupo_asignado) return
    fetch(`/api/kids/observaciones?grupo=${encodeURIComponent(coordinador.grupo_asignado)}`)
      .then(r => r.json())
      .then(json => {
        if (!json.ok) return
        const counts: Record<string, number> = {}
        ;(json.data as { maestro_id: string }[]).forEach(o => {
          counts[o.maestro_id] = (counts[o.maestro_id] ?? 0) + 1
        })
        setObsCounts(counts)
      })
      .catch(() => {/* silently ignore */})
  }, [coordinador.grupo_asignado])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position:'fixed', inset:0, zIndex:80,
        background:     visible ? 'rgba(10,10,30,.55)' : 'rgba(10,10,30,0)',
        backdropFilter: visible ? 'blur(10px)'          : 'none',
        WebkitBackdropFilter: visible ? 'blur(10px)'   : 'none',
        transition: 'all .26s',
      }} />

      {/* Modal */}
      <div style={{
        position:   'fixed',
        top:'50%', left:'50%',
        transform:  visible
          ? 'translate(-50%,-50%) scale(1) translateY(0)'
          : 'translate(-50%,-50%) scale(.93) translateY(18px)',
        opacity:    visible ? 1 : 0,
        transition: 'all .28s cubic-bezier(0.25,0.46,0.45,0.94)',
        zIndex:     90,
        width:      'min(500px, calc(100vw - 28px))',
        maxHeight:  'calc(100vh - 56px)',
        background: 'linear-gradient(145deg,#f9a8d4 0%,#c084fc 52%,#818cf8 100%)',
        borderRadius: 28,
        border:     '1px solid rgba(255,255,255,.55)',
        boxShadow:  '0 28px 80px rgba(192,132,252,.4), 0 8px 32px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.6)',
        display:    'flex',
        flexDirection:'column',
        overflow:   'hidden',
      }}>

        {/* ── Header: coordinadora ── */}
        <div style={{ padding:'20px 20px 16px', position:'relative', flexShrink:0 }}>
          {/* Botón cerrar */}
          <button onClick={handleClose} style={{
            position:'absolute', top:16, right:16,
            width:32, height:32, borderRadius:'50%',
            background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.5)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {/* Foto coordinadora */}
            <div style={{
              width:62, height:62, borderRadius:'50%',
              border:'3px solid rgba(255,255,255,.85)',
              boxShadow:'0 0 0 2px rgba(251,191,36,.5), 0 4px 14px rgba(0,0,0,.22)',
              overflow:'hidden', flexShrink:0,
              background:'linear-gradient(135deg,#f472b6,#c084fc)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18, fontWeight:800, color:'#fff',
            }}>
              {coordinador.foto_url && !coordBroken
                ? <img src={coordinador.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                    onError={() => setCoordBroken(true)} />
                : coordIni
              }
            </div>

            <div>
              <div style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,.65)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:3 }}>
                Coordinadora Kids
              </div>
              <div style={{ fontSize:17, fontWeight:800, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,.2)', lineHeight:1.2 }}>
                {coordinador.nombre} {coordinador.apellido}
              </div>
              {coordinador.grupo_asignado && (
                <div style={{
                  display:'inline-flex', alignItems:'center', marginTop:6,
                  background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.4)',
                  padding:'3px 12px', borderRadius:50, fontSize:10, fontWeight:800, color:'#fff',
                }}>
                  {coordinador.grupo_asignado}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divisor */}
        <div style={{ height:1, background:'rgba(255,255,255,.2)', margin:'0 20px', flexShrink:0 }} />

        {/* ── Título sección maestros ── */}
        <div style={{ padding:'14px 20px 10px', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <path d="M20 10v4a8 8 0 0 1-16 0v-4"/>
          </svg>
          <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.9)' }}>
            Maestros asignados
          </span>
          <div style={{
            marginLeft:'auto',
            background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.4)',
            padding:'2px 10px', borderRadius:50, fontSize:10, fontWeight:800, color:'#fff',
          }}>
            {maestros.length}
          </div>
        </div>

        {/* ── Lista de maestros ── */}
        <div style={{
          overflowY:'auto',
          padding:'0 16px 20px',
          display:'flex', flexDirection:'column', gap:8,
        }}>
          {maestros.length === 0 ? (
            <div style={{ textAlign:'center', padding:'36px 0' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📚</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.75)', fontWeight:600 }}>
                Sin maestros asignados a este grupo
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:6 }}>
                Asigna maestros desde el módulo correspondiente
              </div>
            </div>
          ) : (
            maestros.map((m, idx) => (
              <MaestroRow
                key={m.id}
                m={m}
                idx={idx}
                visible={visible}
                obsCount={obsCounts[m.id] ?? 0}
                onSelect={() => onSelectMaestro(m)}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}

/* ── Fila de maestro dentro del modal ───────────────────────────────────── */
function MaestroRow({
  m, idx, visible, obsCount, onSelect,
}: {
  m:        KidsMaestro
  idx:      number
  visible:  boolean
  obsCount: number
  onSelect: () => void
}) {
  const [broken, setBroken] = useState(false)
  const [rowHov, setRowHov] = useState(false)
  const showImg = m.foto_url && !broken
  const ini     = `${m.nombre.charAt(0)}${m.apellido.charAt(0)}`.toUpperCase()
  const hasObs  = obsCount > 0

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setRowHov(true)}
      onMouseLeave={() => setRowHov(false)}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'11px 13px',
        borderRadius:14,
        background:   rowHov ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.15)',
        border:       `1px solid ${rowHov ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.25)'}`,
        backdropFilter:'blur(8px)',
        WebkitBackdropFilter:'blur(8px)',
        cursor:    'pointer',
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `
          opacity .3s ${0.08 + idx * 0.07}s cubic-bezier(0.25,0.46,0.45,0.94),
          transform .3s ${0.08 + idx * 0.07}s cubic-bezier(0.25,0.46,0.45,0.94),
          background .18s, border-color .18s
        `,
        boxShadow: rowHov ? '0 4px 16px rgba(0,0,0,.12)' : 'none',
      }}
    >
      {/* Foto */}
      <div style={{
        width:44, height:44, borderRadius:'50%',
        overflow:'hidden', flexShrink:0,
        background: GRADIENTS[idx % GRADIENTS.length],
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14, fontWeight:800, color:'#fff',
        border:'2px solid rgba(255,255,255,.65)',
        boxShadow:'0 2px 10px rgba(0,0,0,.18)',
      }}>
        {showImg
          ? <img src={m.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={() => setBroken(true)} />
          : ini
        }
      </div>

      {/* Info + obs badge */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'0 1px 3px rgba(0,0,0,.15)' }}>
          {m.nombre} {m.apellido}
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,.65)', marginTop:2 }}>
          {m.horario_servicio ?? 'Sin horario asignado'}
        </div>
        {/* Obs badge — debajo del horario */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:4, marginTop:5,
          padding:'2px 8px', borderRadius:50,
          background: hasObs ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)',
          border: `1px solid ${hasObs ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.18)'}`,
          boxShadow: hasObs ? '0 0 10px rgba(255,255,255,.15), inset 0 1px 0 rgba(255,255,255,.3)' : 'none',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
            stroke={hasObs ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.4)'}
            strokeWidth="2.2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span style={{
            fontSize:10, fontWeight:800, lineHeight:1,
            color: hasObs ? '#fff' : 'rgba(255,255,255,.4)',
            textShadow: hasObs ? '0 1px 4px rgba(0,0,0,.2)' : 'none',
          }}>
            {obsCount} obs.
          </span>
        </div>
      </div>

      {/* ── Botones WA + Llamar premium ── */}
      <div style={{ display:'flex', gap:7, flexShrink:0 }} onClick={e => e.stopPropagation()}>
        {/* WhatsApp */}
        <a
          href={m.telefono ? `https://wa.me/57${m.telefono.replace(/\D/g,'')}` : undefined}
          target="_blank" rel="noopener noreferrer"
          title={`WhatsApp ${m.nombre}`}
          onClick={e => { if (!m.telefono) e.preventDefault() }}
          style={{
            width:32, height:32, borderRadius:'50%', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: m.telefono
              ? 'linear-gradient(135deg,rgba(37,211,102,.85) 0%,rgba(18,183,80,.75) 100%)'
              : 'rgba(255,255,255,.08)',
            border: `1px solid ${m.telefono ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.15)'}`,
            boxShadow: m.telefono
              ? '0 4px 14px rgba(37,211,102,.45), inset 0 1px 0 rgba(255,255,255,.35)'
              : 'none',
            backdropFilter:'blur(6px)',
            WebkitBackdropFilter:'blur(6px)',
            cursor: m.telefono ? 'pointer' : 'default',
            textDecoration:'none',
            transition:'all .18s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={m.telefono ? '#fff' : 'rgba(255,255,255,.3)'}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M11.5 2C6.261 2 2 6.261 2 11.5c0 1.886.52 3.65 1.426 5.155L2 22l5.488-1.396A9.45 9.45 0 0 0 11.5 21C16.739 21 21 16.739 21 11.5S16.739 2 11.5 2zm0 17.2a7.678 7.678 0 0 1-3.927-1.074l-.281-.168-2.91.74.775-2.835-.184-.29A7.655 7.655 0 0 1 3.8 11.5C3.8 7.253 7.253 3.8 11.5 3.8S19.2 7.253 19.2 11.5 15.747 19.2 11.5 19.2z"/>
          </svg>
        </a>

        {/* Llamar */}
        <a
          href={m.telefono ? `tel:${m.telefono.replace(/\D/g,'')}` : undefined}
          title={`Llamar a ${m.nombre}`}
          onClick={e => { if (!m.telefono) e.preventDefault() }}
          style={{
            width:32, height:32, borderRadius:'50%', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: m.telefono
              ? 'linear-gradient(135deg,rgba(99,102,241,.85) 0%,rgba(139,92,246,.75) 100%)'
              : 'rgba(255,255,255,.08)',
            border: `1px solid ${m.telefono ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.15)'}`,
            boxShadow: m.telefono
              ? '0 4px 14px rgba(99,102,241,.45), inset 0 1px 0 rgba(255,255,255,.35)'
              : 'none',
            backdropFilter:'blur(6px)',
            WebkitBackdropFilter:'blur(6px)',
            cursor: m.telefono ? 'pointer' : 'default',
            textDecoration:'none',
            transition:'all .18s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={m.telefono ? '#fff' : 'rgba(255,255,255,.3)'}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.06 6.06l1.64-1.63a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </a>
      </div>

      {/* Flecha → ver observaciones */}
      <div style={{
        width:24, height:24, borderRadius:'50%', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        background: rowHov ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.1)',
        border:     '1px solid rgba(255,255,255,.3)',
        transition: 'all .18s',
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
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
      /* Anillo exterior con degradado metálico */
      background:   '#ffffff',
      boxShadow:    [
        /* sombra exterior — profundidad */
        '0 8px 28px rgba(0,0,0,.18)',
        '0 2px 6px  rgba(0,0,0,.10)',
        /* relieve tallado — luz arriba-izq, oscuro abajo-der */
        'inset 3px 3px 6px  rgba(255,255,255,.9)',
        'inset -3px -3px 6px rgba(0,0,0,.12)',
      ].join(', '),
      display:       'flex',
      alignItems:    'center',
      justifyContent:'center',
    }}>
      {/* Receso interior circular */}
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

/* ── SF-style nav icons (thin stroke, 18 px) ────────────────────────────── */
function NavIcon({ section, active }: { section: string; active: boolean }) {
  const c = active ? '#0d9488' : '#8496ac'
  const s = {
    width: 18, height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: c,
    strokeWidth: '1.65',
    strokeLinecap:  'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 as const },
  }
  switch (section) {
    case 'dashboard':
      return <svg {...s}>
        <rect x="3"  y="3"  width="7" height="7" rx="1.5"/>
        <rect x="14" y="3"  width="7" height="7" rx="1.5"/>
        <rect x="3"  y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    case 'administradores':
      return <svg {...s}>
        <path d="M12 2L4 5v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V5L12 2z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    case 'coordinadores':
      return <svg {...s}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    case 'maestros':
      return <svg {...s}>
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <path d="M20 10v4a8 8 0 0 1-16 0v-4"/>
      </svg>
    case 'auxiliares':
      return <svg {...s}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="16" y1="11" x2="22" y2="11"/>
      </svg>
    case 'rotaciones':
      return <svg {...s}>
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    case 'ninos':
      return <svg {...s}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    case 'asistencias':
      return <svg {...s}>
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    case 'seguimientos':
      return <svg {...s}>
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    default:
      return <svg {...s}><circle cx="12" cy="12" r="5"/></svg>
  }
}

function IconButton({
  children, onClick, title, borderColor, bg, disabled = false
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  borderColor: string
  bg: string
  disabled?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width:          34,
        height:         34,
        borderRadius:   10,
        border:         `1px solid ${borderColor}`,
        background:     bg,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        opacity:        disabled ? .5 : 1,
        transition:     'opacity .15s',
      }}
    >
      {children}
    </button>
  )
}
