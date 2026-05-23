'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SeguimientosSection from '../admin/components/SeguimientosSection'

/* ════════════════════════════════════════════════════════════════════
   Página pública de Seguimientos — accesible desde el panel coordinador
   Verifica sesión (coordinador o admin) antes de mostrar el contenido
════════════════════════════════════════════════════════════════════ */
export default function SeguimientosPage() {
  const router  = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      /* Intentar autenticación como coordinador primero */
      const coordRes = await fetch('/api/kids/coordinador/me')
      if (coordRes.ok) {
        const json = await coordRes.json()
        if (json.ok) { setReady(true); return }
      }

      /* Fallback: verificar sesión admin */
      const adminRes = await fetch('/api/kids/session')
      if (adminRes.ok) {
        const json = await adminRes.json()
        if (json.ok) { setReady(true); return }
      }

      /* Sin sesión válida → login */
      router.replace('/login')
    }
    checkAuth()
  }, [router])

  if (!ready) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
        fontFamily: "'Segoe UI',system-ui,sans-serif",
      }}>
        <div style={{
          background: 'rgba(255,255,255,.28)',
          backdropFilter: 'blur(24px)',
          borderRadius: 20,
          padding: '28px 48px',
          border: '1px solid rgba(255,255,255,.5)',
          fontSize: 14,
          color: '#4c1d95',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(139,92,246,.15)',
        }}>
          Cargando seguimientos…
        </div>
      </main>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg,#b2f0e0 0%,#d4c8ff 50%,#b3dcf7 100%)',
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Back button ── */}
      <div style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 50,
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            color: '#4c1d95',
            transition: 'all .18s',
          } as React.CSSProperties}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
      </div>

      {/* ── Seguimientos panel (ocupa todo el alto disponible) ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 0,
      }}>
        <SeguimientosSection />
      </div>
    </main>
  )
}
