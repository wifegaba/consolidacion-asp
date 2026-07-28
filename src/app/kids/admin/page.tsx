'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { LiquidGlassWorkspace, type LiquidGlassDockItem } from '@kids/liquid-glass-ui'
import ServidorModal,      { type KidsServidor }     from './components/ServidorModal'
import { type KidsAdmin }                            from './components/AdminModal'
import { type KidsMaestro }                          from './components/MaestroModal'
import { type KidsCoordinador }                      from './components/CoordinadorModal'
import ObservacionesModal                           from './components/ObservacionesModal'
import NinosSection                                 from './components/NinosSection'
import AsistenciasSection                           from './components/AsistenciasSection'
import SeguimientosSection                          from './components/SeguimientosSection'
import TimoteosSection                              from './components/TimoteosSection'
import AgendaSection                                from './components/AgendaSection'
import PremiumPagination                           from './components/PremiumPagination'
import { normalizeSearchText }                     from './utils/normalizeSearchText'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Usuario {
  id:       string
  nombre:   string
  apellido: string
  cedula:   string
  foto_url: string | null
}

type FilterTab = 'todos' | 'coordinadores' | 'maestros' | 'auxiliares' | 'timoteos'

/* ── Animaciones UI (Estilo Cursor / Fluid UI Morphing - Réplica FluidUIProject) ──── */
/* ── Navigation items ───────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { num: '01', label: 'Servidores',      section: 'servidores'      },
  { num: '02', label: 'Agenda',          section: 'agenda'          },
  { num: '03', label: 'Niños',           section: 'ninos'           },
  { num: '04', label: 'Asistencias',     section: 'asistencias'     },
  { num: '05', label: 'Seguimientos',    section: 'seguimientos'    },
  { num: '06', label: 'Timoteos',        section: 'timoteos'        },
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
  if (section === 'timoteos') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="9" cy="7" r="3"/>
        <circle cx="17" cy="9" r="2.5"/>
        <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h0a5.5 5.5 0 0 1 5.5 5.5V20"/>
        <path d="M14.5 14.2a4.5 4.5 0 0 1 6 4.3V20"/>
        <path d="M18.8 3.8l.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2.6-1.2z" fill={active ? color : 'none'}/>
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

type ServerLaunchOrigin = {
  dx: number
  dy: number
  scaleX: number
  scaleY: number
}

function serverLaunchOriginFromRect(rect: DOMRect): ServerLaunchOrigin {
  const modalWidth = Math.min(window.innerWidth - 24, 680)
  const modalHeight = Math.min(window.innerHeight * .9, 530)
  return {
    dx: rect.left + rect.width / 2 - window.innerWidth / 2,
    dy: rect.top + rect.height / 2 - window.innerHeight / 2,
    scaleX: Math.max(.08, rect.width / modalWidth),
    scaleY: Math.max(.06, rect.height / modalHeight),
  }
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
  const [servidorFilterOpen, setServidorFilterOpen] = useState(false)
  const [servidorSearch, setServidorSearch] = useState('')
  const [servidorPage, setServidorPage] = useState(1)
  const [servidorPageSize, setServidorPageSize] = useState(8)
  const [servidorModal,  setServidorModal]  = useState(false)
  const [editServidor,   setEditServidor]   = useState<KidsServidor | null>(null)
  const [servidorLaunchOrigin, setServidorLaunchOrigin] = useState<ServerLaunchOrigin | null>(null)
  const [deletingServidorId, setDeletingServidorId] = useState<string | null>(null)
  const newServidorButtonRef = useRef<HTMLButtonElement>(null)

  // ── Shared ───────────────────────────────────────────────────────────────
  const [activeNav,      setActiveNav]      = useState<string>('ninos')
  const [displayNav,     setDisplayNav]     = useState<string>('ninos')
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

  const handleFilterChange = (newFilter: FilterTab) => {
    setServidorFilter(newFilter)
    setServidorPage(1)
  }

  const search    = servidorSearch
  const setSearch = setServidorSearch
  const [searchFocused, setSearchFocused] = useState(false)


  /* ── Responsive detection ─────────────────────────────────────────────── */
  useEffect(() => {
    const check = () => {
      const width = window.innerWidth
      setIsMobile(width < 980)
      setServidorPageSize(width < 620 ? 4 : width < 1100 ? 6 : 8)
    }
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
  const isMaestrosView      = filter === 'maestros'
  const isCoordinadoresView = filter === 'coordinadores'
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

    const q = normalizeSearchText(search)
    const matchSearch = !q ||
      normalizeSearchText(a.nombre).includes(q)   ||
      normalizeSearchText(a.apellido).includes(q) ||
      normalizeSearchText(a.cedula).includes(q)

    return matchFilter && matchSearch
  })
  const servidorTotalPages = Math.max(1, Math.ceil(filtered.length / servidorPageSize))
  const paginatedServers = filtered.slice(
    (servidorPage - 1) * servidorPageSize,
    servidorPage * servidorPageSize
  )

  useEffect(() => {
    setServidorPage(1)
  }, [servidorSearch, servidorPageSize])

  useEffect(() => {
    setServidorPage(page => Math.min(page, servidorTotalPages))
  }, [servidorTotalPages])

  /* ── Actions ──────────────────────────────────────────────────────────── */
  function openCreate() {
    const rect = newServidorButtonRef.current?.getBoundingClientRect()
    setServidorLaunchOrigin(rect ? serverLaunchOriginFromRect(rect) : null)
    setEditServidor(null)
    setServidorModal(true)
  }
  function openEdit(a: KidsServidor, origin: ServerLaunchOrigin | null = null) {
    setServidorLaunchOrigin(origin)
    setEditServidor(a)
    setServidorModal(true)
  }

  async function handleServidorSaved() {
    setServidorModal(false)
    setServidorLaunchOrigin(null)
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
    setActiveNav(section)
    setDisplayNav(section)
  }

  const dockColors: Record<string, string> = {
    ninos: '#ed3a9a',
    asistencias: '#0795a7',
    seguimientos: '#742ddd',
    timoteos: '#0f9b8e',
    servidores: '#2468f2',
    agenda: '#ff7b16',
  }

  const liquidDockItems: LiquidGlassDockItem[] = NAV_ITEMS.map((item) => ({
    id: item.section,
    label: item.label,
    color: dockColors[item.section],
    icon: <NavIcon section={item.section} active={false} color={dockColors[item.section]} />,
  }))

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
      .lgx-dock {
        --lgx-count: 6;
        width: min(570px, calc(100% - 22px));
      }
      @media (max-width: 980px) {
        .lgx-window {
          inset: 8px 8px 66px 8px !important;
          border-radius: clamp(24px, 5vw, 34px) !important;
        }
        .lgx-window__bar {
          flex-basis: 34px !important;
        }
        .lgx-dock {
          width: calc(100% - 18px) !important;
          bottom: 4px !important;
          min-height: 54px !important;
          padding: 5px 8px 4px !important;
        }
        .lgx-dock__icon,
        .lgx-dock__icon svg {
          width: 21px !important;
          height: 21px !important;
        }
        .lgx-dock__label {
          font-size: 8.5px !important;
        }
        .server-responsive-actions {
          width: 100%;
          flex-wrap: nowrap !important;
          justify-content: flex-end;
        }
        .server-responsive-actions > button {
          flex: 1 1 auto;
          min-width: 0;
          justify-content: center;
        }
        .server-responsive-actions .server-filter-select {
          width: 106px !important;
          flex: 0 0 106px;
        }
        .server-responsive-actions .server-filter-trigger {
          width: 100% !important;
          min-width: 0 !important;
        }
        .server-team-overview {
          display: none !important;
        }
      }
    `}</style>
    <div style={{
      fontFamily:    "'Segoe UI',system-ui,sans-serif",
      height:        '100vh',
      maxHeight:     '100vh',
      background:    '#0c0b74',
      display:       'flex',
      alignItems:    'stretch',
      justifyContent:'center',
      padding:       0,
      position:      'relative',
      overflow:      'hidden',
      boxSizing:     'border-box',
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
        borderRadius: 0,
        overflow:     'visible',
        boxShadow:    'none',
        height:       '100vh',
        maxHeight:    '100vh',
        position:     'relative',
        zIndex:       1,
        /* gradient visible inside the shell — what the sidebar blurs */
        background:   'transparent',
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
          display:              'none',
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
                  <div className={`server-team-title ${isCoordinadoresView ? 'is-coordinators' : ''}`} style={{
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
        <LiquidGlassWorkspace
          items={liquidDockItems}
          activeId={displayNav}
          onActiveChange={handleNavClick}
          windowLabel="Administración ASP Kids"
        >
        <main style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          background:    'transparent',
          minWidth:      0,
        }}>

          {/* ── Panel Niños — layout propio con sheet entrance ── */}
          {displayNav === 'ninos' && (
            <div className="ninos-panel-entry" style={{
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
              <div className="ninos-shimmer-entry" style={{
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

          {/* ── Panel Timoteos ── */}
          {displayNav === 'timoteos' && (
            <div style={{
              flex:1, minHeight:0, display:'flex', flexDirection:'column',
              overflow:'hidden', position:'relative', zIndex:20,
            }}>
              <TimoteosSection servidores={servidores} />
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
          {displayNav !== 'ninos' && displayNav !== 'asistencias' && displayNav !== 'seguimientos' && displayNav !== 'timoteos' && displayNav !== 'agenda' && (<>
          {/* ── Scroll area (Admin list card - Liquid Glass Reference Board) ── */}
          <div style={{
              /* El fondo pertenece a la ventana liquid glass; las tarjetas quedan libres. */
              background:   'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              borderRadius: 0,
              overflow:     'hidden',
              boxShadow:    'none',
              flex:         1,
              margin:       isMobile ? '10px 10px 16px' : '14px 20px 20px',
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
                <div
                  className="server-responsive-actions"
                  style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}
                >
                  {/* Botón Nuevo Servidor */}
                  <button
                    ref={newServidorButtonRef}
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
                  <div className="server-filter-select">
                    <button
                      type="button"
                      className={`server-filter-trigger ${servidorFilterOpen ? 'is-open' : ''}`}
                      onClick={() => setServidorFilterOpen(open => !open)}
                      aria-expanded={servidorFilterOpen}
                      aria-haspopup="listbox"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 5h16l-6.2 7.1v5.1l-3.6 1.8v-6.9L4 5z"/>
                      </svg>
                      <span>
                        {filter === 'todos' ? 'Todos' :
                         filter === 'coordinadores' ? 'Coord.' :
                         filter === 'maestros' ? 'Maestros' :
                         filter === 'auxiliares' ? 'Auxiliares' : 'Timoteos'}
                      </span>
                      <span className="server-filter-chevron">⌄</span>
                    </button>

                    {servidorFilterOpen && (
                      <div className="server-filter-menu" role="listbox" aria-label="Filtrar servidores">
                        {([
                          ['todos', 'Todos'],
                          ['coordinadores', 'Coord.'],
                          ['maestros', 'Maestros'],
                          ['auxiliares', 'Auxiliares'],
                          ['timoteos', 'Timoteos'],
                        ] as [FilterTab, string][]).map(([value, label]) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={filter === value}
                            className={`server-filter-option ${filter === value ? 'is-selected' : ''}`}
                            key={value}
                            onClick={() => {
                              handleFilterChange(value)
                              setServidorFilterOpen(false)
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Strips */}
              <div style={{
                padding: isMobile ? '24px 12px 90px' : '30px 16px 76px',
                display:'flex', flexDirection:'column',
                gap: isMobile ? 6 : 5,
                flex:1, minHeight:0, overflowY:isMobile ? 'auto' : 'hidden',
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

                {/* ── Área animada con morphing espacial estilo FluidUIProject ── */}
                <div>
                  <div
                    key={`${filter}_${search}`}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    {/* ── Grid de tarjetas — Coordinadores ── */}
                    {false && !loading && isCoordinadoresView && filtered.length > 0 && (
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
                          <div
                            key={a.id}
                          >
                            <CoordinadorCard
                              c={a as KidsCoordinador}
                              idx={idx}
                              isDeleting={deletingServidorId === a.id}
                              onEdit={() => openEdit(a)}
                              onDelete={() => handleDelete(a)}
                              onViewMaestros={() => setCoordMaestrosModal(a as KidsCoordinador)}
                              compact={isMobile}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Cards — Administradores & Servidores ── */}
                    {!loading && filtered.length > 0 && (
                      <div className="server-cards-grid" style={{
                        display:             'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 160px))',
                        gap:                 isMobile ? 8 : 10,
                        justifyContent:      'start',
                        margin:              '0 auto',
                        width:               '100%',
                        alignContent:        'start',
                      }}>
                        {paginatedServers.map((a, idx) => (
                          <div
                            key={a.id}
                          >
                            <AdminCard
                              a={a as KidsAdmin}
                              idx={(servidorPage - 1) * servidorPageSize + idx}
                              isDeleting={deletingServidorId === a.id || deletingServidorId === a.id}
                              onEdit={(origin) => openEdit(a, origin ?? null)}
                              onDelete={() => handleDelete(a)}
                              compact={isMobile}
                            />
                          </div>
                        ))}
                        <ServerTeamOverviewPanel servidores={activeList} />
                      </div>
                    )}
                    {!loading && filtered.length > 0 && (
                      <PremiumPagination
                        page={servidorPage}
                        totalPages={servidorTotalPages}
                        onPageChange={setServidorPage}
                        label="Página de servidores"
                        alwaysVisible
                      />
                    )}
                    
                    {/* ── Strips — solo Maestros ── */}
                    {false && !loading && isMaestrosView && filtered.map((a, idx) => {
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
                                  <span style={{ color:'#0d9488', fontWeight:600 }}>• {(a as KidsMaestro).horario_servicio}</span>
                                )}
                              </div>
                              <div style={{ display:'flex', gap:4 }}>
                                {isMaestrosView && (
                                  <IconButton title="Observaciones de seguimiento" onClick={() => setObsModal({ maestro: a as KidsMaestro, coordinador: null })} borderColor="#ddd6fe" bg="#f5f3ff">
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
                          <div style={{
                            padding:'5px 12px', borderRadius:50, fontSize:11, fontWeight:700,
                            background: a.activo ? 'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))' : '#fef2f2',
                            color: a.activo ? '#0d9488' : '#f43f5e',
                            border: `1px solid ${a.activo ? 'rgba(13,148,136,.3)' : '#fecdd3'}`,
                            display:'flex', alignItems:'center', gap:6,
                          }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background:a.activo ? '#0d9488' : '#f43f5e' }} />
                            {a.activo ? 'Activo' : 'Inactivo'}
                          </div>
                          <div style={{ fontSize:12, color:'#6b7280', display:'flex', gap:16 }}>
                            <span>CC <strong>{a.cedula}</strong></span>
                            {a.telefono && <span>Tel: <strong>{a.telefono}</strong></span>}
                            {isMaestrosView && (a as KidsMaestro).horario_servicio && (
                              <span style={{ color:'#0d9488', fontWeight:600 }}>Servicio: {(a as KidsMaestro).horario_servicio}</span>
                            )}
                          </div>
                          <div style={{ display:'flex', gap:6 }}>
                            {isMaestrosView && (
                              <IconButton title="Observaciones de seguimiento" onClick={() => setObsModal({ maestro: a as KidsMaestro, coordinador: null })} borderColor="#ddd6fe" bg="#f5f3ff">
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
            </div>
          </>)} {/* end: displayNav !== 'ninos' && displayNav !== 'asistencias' */}
        </main>
        </LiquidGlassWorkspace>
      </div>

      {/* ── Modales ── */}
      {servidorModal && (
        <ServidorModal
          servidor={editServidor}
          launchOrigin={servidorLaunchOrigin}
          onClose={() => {
            setServidorModal(false)
            setServidorLaunchOrigin(null)
          }}
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

function ServerTeamOverviewPanel({ servidores }: { servidores: KidsServidor[] }) {
  const active = servidores.filter(servidor => servidor.activo !== false)
  const hasRole = (servidor: KidsServidor, token: string) =>
    servidor.roles?.some(role => role.replace(/_/g, ' ').toUpperCase().includes(token)) ?? false

  const coordinadores = active.filter(servidor => hasRole(servidor, 'COORDINADOR')).length
  const maestros = active.filter(servidor => hasRole(servidor, 'MAESTRO') && !hasRole(servidor, 'AUXILIAR')).length
  const auxiliares = active.filter(servidor => hasRole(servidor, 'AUXILIAR')).length
  const timoteos = active.filter(servidor => hasRole(servidor, 'TIMOTEO')).length
  const administradores = active.filter(servidor => hasRole(servidor, 'ADMINISTRADOR')).length
  const entreSemana = active.filter(servidor => servidor.sirve_entre_semana).length
  const maxMetric = Math.max(coordinadores, maestros, auxiliares, timoteos, 1)

  const metrics = [
    { label: 'Coordinadores', value: coordinadores, color: '#0ea5e9' },
    { label: 'Maestros', value: maestros, color: '#7c3aed' },
    { label: 'Auxiliares', value: auxiliares, color: '#ec4899' },
    { label: 'Timoteos', value: timoteos, color: '#f59e0b' },
  ]

  return (
    <aside className="server-team-overview" aria-label="Resumen del equipo de servidores">
      <div className="server-team-overview__glow" />
      <header className="server-team-overview__header">
        <div>
          <span>Resumen del equipo</span>
          <h3>Composición activa</h3>
        </div>
        <div className="server-team-overview__status"><i /> Actualizado</div>
      </header>

      <div className="server-team-overview__total">
        <strong>{active.length}</strong>
        <div>
          <b>Servidores activos</b>
          <span>Equipo Kids disponible</span>
        </div>
      </div>

      <div className="server-team-overview__metrics">
        {metrics.map(metric => (
          <div className="server-team-overview__metric" key={metric.label}>
            <i style={{ background: metric.color, boxShadow: `0 0 9px ${metric.color}66` }} />
            <span>{metric.label}</span>
            <div><b style={{ width: `${Math.max(12, (metric.value / maxMetric) * 100)}%`, background: metric.color }} /></div>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <footer className="server-team-overview__footer">
        <div><span>Administración</span><strong>{administradores}</strong></div>
        <div><span>Entre semana</span><strong>{entreSemana}</strong></div>
      </footer>
    </aside>
  )
}

function compactServerRoles(roles: unknown, fallback = 'Servidor Kids') {
  if (!Array.isArray(roles) || roles.length === 0) return fallback
  const labels = roles.map(role => String(role).replace(/_/g, ' ').trim())
  const uniqueLabels = Array.from(new Set(labels.filter(Boolean)))
  if (uniqueLabels.length > 1) return 'Coordinador Mixto'
  return uniqueLabels[0] || fallback
}

function AdminCard({
  a, idx, isDeleting, onEdit, onDelete,
}: {
  a:          any
  idx:        number
  isDeleting: boolean
  onEdit:     (origin?: ServerLaunchOrigin) => void
  onDelete:   () => void
  compact?:   boolean
}) {
  const [flipped,  setFlipped]  = useState(false)
  const [broken,   setBroken]   = useState(false)
  const [hov,      setHov]      = useState<string | null>(null)
  const [cardHov,  setCardHov]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [closingExpanded, setClosingExpanded] = useState(false)
  const [aladdinOrigin, setAladdinOrigin] = useState<Record<string, string>>({})
  const cardRef = useRef<HTMLDivElement>(null)

  const showImg = a.foto_url && !broken
  const ini     = `${a.nombre.charAt(0)}${a.apellido.charAt(0)}`.toUpperCase()
  const phone   = a.telefono?.replace(/\D/g,'').replace(/^57/,'')
  const ingreso = a.creado_en ? new Date(a.creado_en).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' }) : null
  const h = (id: string) => ({ onMouseEnter: () => setHov(id), onMouseLeave: () => setHov(null) })

  const GRAD_A = 'linear-gradient(145deg,#134e4a 0%,#0d9488 50%,#0891b2 100%)'

  function openExpanded() {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const modalWidth = Math.min(window.innerWidth * .9, 620)
    const modalHeight = Math.min(window.innerHeight * .78, 540)
    setAladdinOrigin({
      '--server-origin-x': `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      '--server-origin-y': `${rect.top + rect.height / 2 - window.innerHeight / 2}px`,
      '--server-scale-x': `${Math.max(.08, rect.width / modalWidth)}`,
      '--server-scale-y': `${Math.max(.08, rect.height / modalHeight)}`,
    })
    setFlipped(true)
    setClosingExpanded(false)
    setExpanded(true)
  }

  function closeExpanded() {
    if (closingExpanded) return
    setClosingExpanded(true)
    window.setTimeout(() => {
      setExpanded(false)
      setClosingExpanded(false)
      setFlipped(false)
    }, 620)
  }

  return (
    <>
    <div
      ref={cardRef}
      className="server-card-entry"
      onMouseEnter={() => { if (!flipped) setCardHov(true) }}
      onMouseLeave={() => setCardHov(false)}
      style={{
        perspective:  '1000px',
        height:       170,
        borderRadius: 16,
        opacity:      isDeleting ? .5 : 1,
        boxShadow:    flipped
          ? '0 16px 48px rgba(13,148,136,.5), 0 4px 16px rgba(0,0,0,.18)'
          : cardHov
            ? '0 16px 48px rgba(13,148,136,.4), 0 4px 16px rgba(0,0,0,.14)'
            : '0 8px 32px rgba(13,148,136,.26), 0 2px 8px rgba(0,0,0,.08)',
        transition:   'box-shadow .25s, opacity .2s',
        animation:    `server-card-entry .38s ${Math.min(idx, 8) * .04}s cubic-bezier(.25,.46,.45,.94) both`,
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
          className="lgx-content-card lgx-content-card--blue"
          onClick={openExpanded}
          style={{
            position:'absolute', top:0, left:0, right:0, bottom:0,
            backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            borderRadius:14, overflow:'hidden', cursor:'pointer',
            background: GRAD_A,
            border:'1px solid rgba(255,255,255,.45)',
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'8px 4px 8px',
            justifyContent:'flex-start',
          }}
        >
          {/* Foto */}
          <div style={{
            width:76, height:76, borderRadius:'50%',
            border:'2.5px solid rgba(255,255,255,.85)',
            boxShadow: cardHov
              ? '0 0 0 2.5px rgba(245,158,11,.65), 0 5px 16px rgba(19,78,74,.45)'
              : '0 0 0 1.8px rgba(245,158,11,.5),  0 3.5px 12px rgba(19,78,74,.3)',
            overflow:'hidden', flexShrink:0,
            background: showImg ? 'transparent' : GRADIENTS[idx % GRADIENTS.length],
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, fontWeight:800, color:'#fff', marginBottom:14,
            transition:'box-shadow .25s',
          }}>
            {showImg
              ? <img src={a.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)} />
              : ini
            }
          </div>

          {/* Nombre */}
          <div style={{ textAlign:'center', width:'100%', paddingInline:4, marginBottom:0 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#101931', lineHeight:1.2,
              textShadow:'none',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {a.nombre} {a.apellido}
            </div>
            <div style={{ fontSize:8.5, color:'#53617d', fontWeight:600, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {compactServerRoles(a.roles)}
            </div>
          </div>

          {/* Hint voltear */}
          <div style={{
            position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
            opacity: cardHov ? 0.55 : 0, transition:'opacity .2s',
            fontSize:7.5, color:'#53617d', whiteSpace:'nowrap', pointerEvents:'none',
            display:'flex', alignItems:'center', gap:2,
          }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.74"/>
            </svg>
            Ver info
          </div>

          {/* WA + Call — absoluto inferior */}
          {a.telefono && (
            <div className="server-card-contact-actions" onClick={e => e.stopPropagation()}
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
          className="server-card-back"
          onClick={() => setFlipped(false)}
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
          <div className="server-card-back-header" style={{
            padding:'3px 6px', display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'rgba(0,0,0,.15)', borderBottom:'1px solid rgba(255,255,255,.2)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0, flex:1 }}>
              <div className="server-card-back-avatar" style={{ width:18, height:18, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                background: showImg ? 'transparent' : GRADIENTS[idx % GRADIENTS.length],
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:8, fontWeight:800, color:'#fff',
              }}>
                {showImg
                  ? <img src={a.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : ini
                }
              </div>
              <div className="server-card-back-identity" style={{ flex:1, minWidth:0 }}>
                <div className="server-card-back-name" style={{ fontSize:9, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textShadow:'0 1px 3px rgba(0,0,0,.18)' }}>
                  {a.nombre} {a.apellido}
                </div>
                <span className="server-card-back-roles" style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,.9)', background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.3)', padding:'0 4px', borderRadius:50, marginTop:1, display:'inline-block' }}>
                  {compactServerRoles(a.roles, 'Servidor')}
                </span>
              </div>
            </div>

            {/* Volver button */}
            <button className="server-card-back-return" onClick={e => { e.stopPropagation(); setFlipped(false) }}
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
          <div className="server-card-back-body" style={{
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
            <div className="server-card-back-details" style={{ display:'flex', flexDirection:'column', gap:3 }}>
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
            <div className="server-card-back-actions" style={{ display:'flex', gap:4, marginTop:4 }} onClick={e => e.stopPropagation()}>
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
    {expanded && createPortal(
      <ServerAladdinModal
        servidor={a}
        origin={aladdinOrigin}
        closing={closingExpanded}
        onClose={closeExpanded}
        onEdit={(origin) => {
          closeExpanded()
          window.setTimeout(() => onEdit(origin), 640)
        }}
        onDelete={() => { closeExpanded(); window.setTimeout(onDelete, 640) }}
      />,
      document.body,
    )}
    </>
  )
}

/* ── Logo premium con efecto tallado ───────────────────────────────────── */
function ServerAladdinModal({ servidor, origin, closing, onClose, onEdit, onDelete }: {
  servidor: any
  origin: Record<string, string>
  closing: boolean
  onClose: () => void
  onEdit: (origin: ServerLaunchOrigin) => void
  onDelete: () => void
}) {
  const ingreso = servidor.creado_en ? new Date(servidor.creado_en).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha registrada'
  const phone = servidor.telefono?.replace(/\D/g, '').replace(/^57/, '')
  const coordinatorRoles = Array.isArray(servidor.roles)
    ? servidor.roles
        .map((role: unknown) => String(role).replace(/_/g, ' ').trim())
        .filter((role: string) => /^coordinador\b/i.test(role))
        .map((role: string) => {
          const area = role.replace(/^coordinador(?:\s+de)?\s*/i, '').trim()
          return area ? `Coord. ${area.charAt(0).toUpperCase()}${area.slice(1).toLowerCase()}` : 'Coord.'
        })
    : []
  const details = [
    ['Documento', servidor.cedula || 'No registrado'],
    ['Teléfono', servidor.telefono || 'No registrado'],
    ['Estado', servidor.activo === false ? 'Inactivo' : 'Activo'],
    ...(coordinatorRoles.length ? [['Coordinaciones', coordinatorRoles.join(' · ')]] : []),
    ['Vinculado', ingreso],
  ]

  return (
    <div className={`server-aladdin-backdrop server-profile-backdrop ${closing ? 'is-closing' : 'is-opening'}`} onClick={onClose} role="presentation">
      <section className={`server-aladdin-modal ${closing ? 'is-closing' : 'is-opening'}`} style={origin as React.CSSProperties} onClick={event => event.stopPropagation()} aria-label={`Información de ${servidor.nombre} ${servidor.apellido}`}>
        <div className="server-aladdin-modal__shine" />
        <header className="server-profile-header">
          <div className="server-profile-avatar">
            {servidor.foto_url ? <img src={servidor.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : `${servidor.nombre?.charAt(0) || ''}${servidor.apellido?.charAt(0) || ''}`}
          </div>
          <div className="server-profile-identity">
            <div className="server-profile-eyebrow">Perfil del servidor</div>
            <h2>{servidor.nombre} {servidor.apellido}</h2>
          </div>
          <div className="server-profile-quick-actions">
            <button type="button" onClick={onClose} className="server-profile-close" aria-label="Cerrar">×</button>
            {servidor.telefono && (
              <div className="server-profile-contact-row">
                <a
                  className="server-profile-contact server-profile-contact--whatsapp"
                  href={`https://wa.me/57${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${servidor.nombre}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.5l5.797-1.448A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.493-5.183-1.355l-.371-.22-3.441.859.924-3.357-.242-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                </a>
                <a
                  className="server-profile-contact server-profile-contact--phone"
                  href={`tel:${servidor.telefono}`}
                  aria-label={`Llamar a ${servidor.nombre}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </a>
              </div>
            )}
          </div>
        </header>
        <div className="server-profile-details">
          {details.map(([label, value]) => (
            <div className="server-profile-row" key={label}>
              <span>{label}</span>
              <strong className={
                label === 'Estado'
                  ? 'is-status'
                  : label === 'Coordinaciones'
                    ? 'is-coordinations'
                    : undefined
              }>{value}</strong>
            </div>
          ))}
        </div>
        <footer className="server-profile-actions">
          <button type="button" onClick={onDelete} className="server-profile-delete">Eliminar</button>
          <button
            type="button"
            onClick={(event) => onEdit(serverLaunchOriginFromRect(event.currentTarget.getBoundingClientRect()))}
            className="server-profile-edit"
          >
            Editar servidor
          </button>
        </footer>
      </section>
    </div>
  )
}

function CoordinadorCard({
  c, isDeleting, onEdit, onDelete, onViewMaestros,
}: {
  c:              KidsCoordinador
  idx:            number
  isDeleting:     boolean
  onEdit:         () => void
  onDelete:       () => void
  onViewMaestros: () => void
  compact?:       boolean
}) {
  const [flipped,  setFlipped]  = useState(false)
  const [broken,   setBroken]   = useState(false)
  const [hov,      setHov]      = useState<string | null>(null)
  const [cardHov,  setCardHov]  = useState(false)

  const showImg = c.foto_url && !broken
  const ini     = `${c.nombre.charAt(0)}${c.apellido.charAt(0)}`.toUpperCase()
  const phone   = c.telefono?.replace(/\D/g,'').replace(/^57/,'')
  const h = (id: string) => ({ onMouseEnter: () => setHov(id), onMouseLeave: () => setHov(null) })

  const GRAD = 'linear-gradient(145deg,#1e3a8a 0%,#4338ca 50%,#6d28d9 100%)'

  return (
    <div
      onMouseEnter={() => { if (!flipped) setCardHov(true) }}
      onMouseLeave={() => setCardHov(false)}
      style={{
        perspective: '1200px',
        height:      312,
        borderRadius: 20,
        opacity:     isDeleting ? .5 : 1,
        boxShadow:   flipped
          ? '0 16px 48px rgba(67,56,202,.52), 0 4px 16px rgba(0,0,0,.18)'
          : cardHov
            ? '0 16px 48px rgba(67,56,202,.45), 0 4px 16px rgba(0,0,0,.14)'
            : '0 8px 32px rgba(67,56,202,.28), 0 2px 8px rgba(0,0,0,.09)',
        transition:  'box-shadow .25s, opacity .2s',
      }}
    >
      {/* ─── Flipper ─── */}
      <div style={{
        position:       'relative', width:'100%', height:'100%',
        transformStyle: 'preserve-3d',
        transform:      flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition:     'transform .65s cubic-bezier(.34,1.05,.64,1)',
        borderRadius:   20,
      }}>

        {/* ══════════ FRONT ══════════ */}
        <div
          onClick={() => setFlipped(true)}
          style={{
            position:'absolute', top:0, left:0, right:0, bottom:0,
            backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            borderRadius:20, overflow:'hidden', cursor:'pointer',
            background: GRAD,
            border:'1px solid rgba(255,255,255,.55)',
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'12px 12px 56px',
            justifyContent:'center',
          }}
        >
          {/* Badge */}
          <div style={{ display:'flex', alignItems:'center', gap:5,
            background:'rgba(36,102,242,.10)', border:'1px solid rgba(36,102,242,.20)',
            padding:'4px 12px', borderRadius:50, marginBottom:10,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#2466f2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span style={{ fontSize:8, fontWeight:800, color:'#2466f2', letterSpacing:'2px', textTransform:'uppercase' }}>Coordinadora</span>
          </div>

          {/* Foto */}
          <div style={{
            width:100, height:100, borderRadius:'50%',
            border:'3px solid rgba(255,255,255,.85)',
            boxShadow: cardHov
              ? '0 0 0 4px rgba(251,191,36,.65), 0 8px 32px rgba(30,58,138,.45)'
              : '0 0 0 3px rgba(251,191,36,.5),  0 6px 22px rgba(30,58,138,.32)',
            overflow:'hidden', flexShrink:0,
            background: showImg ? 'transparent' : 'linear-gradient(135deg,#1e3a8a,#4338ca)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, fontWeight:800, color:'#fff', marginBottom:10,
            transition:'box-shadow .25s',
          }}>
            {showImg
              ? <img src={c.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)} />
              : ini
            }
          </div>

          {/* Nombre */}
          <div style={{ textAlign:'center', width:'100%', paddingInline:4, marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#101931', lineHeight:1.25,
              textShadow:'none',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {c.nombre} {c.apellido}
            </div>
            <div style={{ fontSize:9, color:'#53617d', fontWeight:500, marginTop:3 }}>
              Coordinadora Kids
            </div>
          </div>

          {/* Grupo */}
          {c.grupo_asignado && (
            <div style={{
              background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.45)',
              color:'#fff', padding:'3px 14px', borderRadius:50,
              fontSize:10, fontWeight:800, letterSpacing:'.5px',
              maxWidth:'90%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>
              {c.grupo_asignado}
            </div>
          )}

          {/* Hint voltear */}
          <div style={{
            position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)',
            opacity: cardHov ? 0.55 : 0, transition:'opacity .2s',
            fontSize:8, color:'rgba(255,255,255,.9)', whiteSpace:'nowrap', pointerEvents:'none',
            display:'flex', alignItems:'center', gap:3,
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.74"/>
            </svg>
            Ver info
          </div>

          {/* WA + Call — absoluto inferior */}
          {c.telefono && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ position:'absolute', bottom:12, left:12, right:12, display:'flex', gap:8 }}
            >
              <a href={`https://wa.me/57${phone}`} target="_blank" rel="noopener noreferrer"
                {...h('wa')}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'8px 0', borderRadius:50, background:'#25D366', textDecoration:'none',
                  boxShadow: hov==='wa' ? '0 0 18px rgba(37,211,102,.55)' : '0 3px 10px rgba(37,211,102,.35)',
                  transform: hov==='wa' ? 'scale(1.04)' : 'scale(1)', transition:'all .18s',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.5l5.797-1.448A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.493-5.183-1.355l-.371-.22-3.441.859.924-3.357-.242-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              </a>
              <a href={`tel:${c.telefono}`}
                {...h('tel')}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'8px 0', borderRadius:50,
                  background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.45)',
                  textDecoration:'none',
                  boxShadow: hov==='tel' ? '0 0 18px rgba(255,200,240,.5)' : 'none',
                  transform: hov==='tel' ? 'scale(1.04)' : 'scale(1)', transition:'all .18s',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </a>
            </div>
          )}
          {!c.telefono && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ position:'absolute', bottom:12, left:12, right:12 }}
            />
          )}
        </div>

        {/* ══════════ BACK ══════════ */}
        <div
          className="lgx-content-card lgx-content-card--blue"
          onClick={() => setFlipped(false)}
          style={{
            position:'absolute', top:0, left:0, right:0, bottom:0,
            backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            transform:'rotateY(180deg)', borderRadius:20, overflow:'hidden',
            cursor:'pointer', display:'flex', flexDirection:'column',
            border:'1px solid rgba(67,56,202,.25)',
          }}
        >
          {/* Header degradado */}
          <div style={{
            background: GRAD,
            padding:'12px 12px 10px',
            display:'flex', alignItems:'center', gap:10,
            flexShrink:0, position:'relative',
          }}>
            {/* X cerrar */}
            <div style={{
              position:'absolute', top:8, right:8,
              width:20, height:20, borderRadius:'50%',
              background:'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.35)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            {/* Foto pequeña */}
            <div style={{
              width:44, height:44, borderRadius:'50%', flexShrink:0, overflow:'hidden',
              border:'2.5px solid rgba(255,255,255,.85)',
              boxShadow:'0 2px 10px rgba(0,0,0,.18)',
              background:'linear-gradient(135deg,#1e3a8a,#4338ca)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:13, fontWeight:800, color:'#fff',
            }}>
              {showImg
                ? <img src={c.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)} />
                : ini
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textShadow:'0 1px 4px rgba(0,0,0,.18)' }}>
                {c.nombre} {c.apellido}
              </div>
              {c.grupo_asignado && (
                <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.9)', background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.3)', padding:'1px 7px', borderRadius:50, marginTop:3, display:'inline-block' }}>
                  {c.grupo_asignado}
                </span>
              )}
            </div>
          </div>

          {/* ── Cuerpo premium estilo macOS ── */}
          <div style={{
            flex:1, overflow:'hidden',
            /* Fondo glass con líneas horizontales sutiles tipo macOS */
            background:[
              'repeating-linear-gradient(180deg,rgba(67,56,202,.03) 0px,rgba(67,56,202,.03) 1px,transparent 1px,transparent 44px)',
              'linear-gradient(160deg,rgba(238,242,255,.97) 0%,rgba(237,233,254,.96) 55%,rgba(235,244,255,.97) 100%)',
            ].join(','),
            backdropFilter:'blur(20px)',
            WebkitBackdropFilter:'blur(20px)',
            padding:'8px 12px 10px',
            display:'flex', flexDirection:'column',
          } as React.CSSProperties}>

            {/* Info rows — estilo macOS System Preferences */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:0 }}>
              {[
                { icon:'cc',   label:'CC',   val: c.cedula },
                c.telefono     ? { icon:'tel',  label:'Tel.',  val: c.telefono }     : null,
                (c.edad??0)>0  ? { icon:'age',  label:'Edad',  val:`${c.edad} años`} : null,
                c.direccion    ? { icon:'dir',  label:'Dir.',  val: c.direccion }     : null,
              ].filter(Boolean).map((row, i, arr) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:9,
                  padding:'7px 8px',
                  borderRadius: i===0 ? '10px 10px 0 0' : i===arr.length-1 ? '0 0 10px 10px' : '0',
                  background:'rgba(255,255,255,.62)',
                  borderBottom: i < arr.length-1 ? '1px solid rgba(67,56,202,.08)' : 'none',
                  boxShadow: i===0 ? 'inset 0 1px 0 rgba(255,255,255,.9)' : 'none',
                }}>
                  {/* Icono circular */}
                  <div style={{
                    width:28, height:28, borderRadius:'50%', flexShrink:0,
                    background:'linear-gradient(135deg,rgba(67,56,202,.18),rgba(99,102,241,.14))',
                    border:'1px solid rgba(67,56,202,.16)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 1px 4px rgba(67,56,202,.1)',
                  }}>
                    {row!.icon === 'cc'  && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>}
                    {row!.icon === 'tel' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                    {row!.icon === 'age' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}
                    {row!.icon === 'dir' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                  </div>
                  {/* Label */}
                  <span style={{ fontSize:9.5, color:'#6366f1', fontWeight:700, width:26, flexShrink:0, letterSpacing:'.3px' }}>
                    {row!.label}
                  </span>
                  {/* Valor */}
                  <span style={{ fontSize:11.5, color:'#1e1b4b', fontWeight:700, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {row!.val}
                  </span>
                </div>
              ))}
            </div>

            {/* Separador con gradiente */}
            <div style={{ height:1, margin:'8px 0 7px', background:'linear-gradient(90deg,transparent,rgba(67,56,202,.22),transparent)' }} />

            {/* Botones */}
            <div style={{ display:'flex', gap:5 }} onClick={e => e.stopPropagation()}>
              {/* Ver maestros */}
              <button onClick={onViewMaestros} style={{
                flex:2, height:32, borderRadius:50, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#4338ca,#6366f1)',
                color:'#fff', fontSize:10, fontWeight:800,
                boxShadow:'0 3px 12px rgba(67,56,202,.42), inset 0 1px 0 rgba(255,255,255,.2)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:4,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/><path d="M20 10v4a8 8 0 0 1-16 0v-4"/>
                </svg>
                Maestros
              </button>
              {/* Editar */}
              <button onClick={onEdit} style={{
                flex:1, height:32, borderRadius:50, cursor:'pointer',
                background:'rgba(255,255,255,.8)', border:'1px solid rgba(67,56,202,.28)',
                color:'#4338ca', fontSize:10, fontWeight:700,
                boxShadow:'inset 0 1px 0 rgba(255,255,255,.9)',
              }}>
                Editar
              </button>
              {/* Eliminar */}
              <button onClick={() => { if (!isDeleting) onDelete() }} disabled={isDeleting} style={{
                width:32, height:32, borderRadius:'50%', cursor: isDeleting ? 'not-allowed' : 'pointer',
                border:'1px solid rgba(244,63,94,.28)', background:'rgba(255,255,255,.75)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

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
