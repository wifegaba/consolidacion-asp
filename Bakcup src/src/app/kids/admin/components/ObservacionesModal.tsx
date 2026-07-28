'use client'

import { useState, useEffect, useCallback } from 'react'
import { type KidsMaestro }      from './MaestroModal'
import { type KidsCoordinador }  from './CoordinadorModal'

/* ── Type ────────────────────────────────────────────────────────────────── */
export interface KidsObservacion {
  id:             string
  maestro_id:     string
  coordinador_id: string
  grupo:          string
  tipo:           string
  titulo:         string
  descripcion:    string | null
  fecha:          string
  activo:         boolean
  creado_en:      string
}

/* ── Tipos de observación con colores ───────────────────────────────────── */
const TIPOS = [
  { value: 'general',     label: 'General',     color: '#3b82f6', bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.28)'  },
  { value: 'puntualidad', label: 'Puntualidad', color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.28)'  },
  { value: 'desempeño',   label: 'Desempeño',   color: '#10b981', bg: 'rgba(16,185,129,.12)',  border: 'rgba(16,185,129,.28)'  },
  { value: 'logro',       label: 'Logro ⭐',    color: '#0d9488', bg: 'rgba(13,148,136,.12)',  border: 'rgba(13,148,136,.28)'  },
  { value: 'conducta',    label: 'Conducta',    color: '#f43f5e', bg: 'rgba(244,63,94,.12)',   border: 'rgba(244,63,94,.28)'   },
  { value: 'asistencia',  label: 'Asistencia',  color: '#8b5cf6', bg: 'rgba(139,92,246,.12)',  border: 'rgba(139,92,246,.28)'  },
]

/* ── Props ───────────────────────────────────────────────────────────────── */
interface Props {
  maestro:     KidsMaestro
  coordinador: KidsCoordinador | null   // null → admin: ve todas, no puede crear
  onClose:     () => void
}

/* ════════════════════════════════════════════════════════════════════════════
   ObservacionesModal
════════════════════════════════════════════════════════════════════════════ */
export default function ObservacionesModal({ maestro, coordinador, onClose }: Props) {

  const [visible,    setVisible]    = useState(false)
  const [obs,        setObs]        = useState<KidsObservacion[]>([])
  const [loading,    setLoading]    = useState(true)
  const [imgBroken,  setImgBroken]  = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [deleteErr,  setDeleteErr]  = useState<string>('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')
  const [form, setForm] = useState({
    tipo:        'general',
    titulo:      '',
    descripcion: '',
    fecha:       new Date().toISOString().split('T')[0],
  })

  const isAdmin = !coordinador
  const ini = `${maestro.nombre.charAt(0)}${maestro.apellido.charAt(0)}`.toUpperCase()

  /* ── Animate in ── */
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  /* ── Fetch ── */
  const fetchObs = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/kids/observaciones?maestro_id=${maestro.id}`)
      const json = await res.json()
      if (json.ok) setObs(json.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [maestro.id])

  useEffect(() => { fetchObs() }, [fetchObs])

  /* ── Close ── */
  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  /* ── Delete (confirmación manejada en ObsCard, aquí solo se ejecuta) ── */
  async function handleDelete(id: string) {
    setDeleting(id)
    setDeleteErr('')
    try {
      const res = await fetch(`/api/kids/observaciones/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setObs(prev => prev.filter(o => o.id !== id))
      } else {
        let msg = `Error ${res.status}`
        try { const body = await res.json(); msg = body.error ?? msg } catch { /* noop */ }
        setDeleteErr(msg)
      }
    } catch (e: any) {
      setDeleteErr(e?.message ?? 'Error de red al eliminar')
    } finally {
      setDeleting(null)
    }
  }

  /* ── Save ── */
  async function handleSave() {
    if (!form.titulo.trim()) { setFormErr('El título es obligatorio.'); return }
    if (!coordinador) return
    setSaving(true)
    setFormErr('')
    try {
      const res = await fetch('/api/kids/observaciones', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maestro_id:     maestro.id,
          coordinador_id: coordinador.id,
          grupo:          coordinador.grupo_asignado ?? maestro.grupo,
          tipo:           form.tipo,
          titulo:         form.titulo.trim(),
          descripcion:    form.descripcion.trim() || null,
          fecha:          form.fecha,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setFormErr(json.error ?? 'Error al guardar.'); return }
      setObs(prev => [json.data, ...prev])
      setForm({ tipo:'general', titulo:'', descripcion:'', fecha: new Date().toISOString().split('T')[0] })
      setShowForm(false)
    } finally { setSaving(false) }
  }

  /* ── Helpers ── */
  const tipoInfo  = (t: string) => TIPOS.find(x => x.value === t) ?? TIPOS[0]
  const fmtDate   = (d: string) => {
    const date = new Date(d + 'T12:00:00')  // evita offset issues
    return date.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
  }

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Backdrop — z-index por encima del CoordinadorMaestrosModal */}
      <div onClick={handleClose} style={{
        position:'fixed', inset:0, zIndex:100,
        background:           visible ? 'rgba(5,5,20,.68)'  : 'rgba(5,5,20,0)',
        backdropFilter:       visible ? 'blur(14px)'        : 'none',
        WebkitBackdropFilter: visible ? 'blur(14px)'        : 'none',
        transition: 'all .26s',
      }} />

      {/* Modal card — Liquid Glass */}
      <div style={{
        position:   'fixed',
        top:'50%', left:'50%',
        transform:  visible
          ? 'translate(-50%,-50%) scale(1) translateY(0)'
          : 'translate(-50%,-50%) scale(.92) translateY(22px)',
        opacity:    visible ? 1 : 0,
        transition: 'all .28s cubic-bezier(0.25,0.46,0.45,0.94)',
        zIndex:     110,
        width:      'min(540px, calc(100vw - 20px))',
        maxHeight:  'calc(100vh - 40px)',
        /* ── Liquid glass body ── */
        background:           'rgba(235,228,255,.72)',
        backdropFilter:       'blur(48px) saturate(210%) brightness(1.08)',
        WebkitBackdropFilter: 'blur(48px) saturate(210%) brightness(1.08)',
        borderRadius: 28,
        border:     '1px solid rgba(255,255,255,.82)',
        boxShadow:  [
          '0 36px 90px rgba(80,0,160,.22)',
          '0 8px 32px rgba(0,0,0,.14)',
          'inset 0 1.5px 0 rgba(255,255,255,.95)',
          'inset 0 -1px 0 rgba(200,180,255,.3)',
          'inset 1px 0 0 rgba(255,255,255,.6)',
          'inset -1px 0 0 rgba(255,255,255,.4)',
        ].join(', '),
        display:    'flex',
        flexDirection: 'column',
        overflow:   'hidden',
      }}>

        {/* ════════ HEADER GRADIENTE (estilo coordinador) ════════ */}
        <div style={{
          background:  'linear-gradient(145deg,#f9a8d4 0%,#c084fc 52%,#818cf8 100%)',
          padding:     '20px 18px 22px',
          flexShrink:  0,
          position:    'relative',
        }}>
          {/* Cierre */}
          <button onClick={handleClose} style={{
            position:'absolute', top:14, right:14,
            width:30, height:30, borderRadius:'50%',
            background:'rgba(255,255,255,.24)', border:'1px solid rgba(255,255,255,.45)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          {/* Maestro info */}
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {/* Foto */}
            <div style={{
              width:60, height:60, borderRadius:'50%',
              border:'2.5px solid rgba(255,255,255,.88)',
              boxShadow:'0 0 0 2.5px rgba(251,191,36,.45), 0 6px 18px rgba(0,0,0,.22)',
              overflow:'hidden', flexShrink:0,
              background:'linear-gradient(135deg,#5eead4,#a78bfa)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:17, fontWeight:800, color:'#fff',
            }}>
              {maestro.foto_url && !imgBroken
                ? <img src={maestro.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setImgBroken(true)} />
                : ini
              }
            </div>

            {/* Texto */}
            <div>
              {/* Quién ve */}
              <div style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,.6)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:3 }}>
                {isAdmin
                  ? '🔐 Vista administrador · todas las observaciones'
                  : `Coordinadora · ${coordinador!.nombre} ${coordinador!.apellido}`
                }
              </div>
              {/* Nombre maestro */}
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,.2)', lineHeight:1.2 }}>
                {maestro.nombre} {maestro.apellido}
              </div>
              {/* Badges */}
              <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                {maestro.grupo && (
                  <span style={{ background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.38)', color:'#fff', padding:'3px 11px', borderRadius:50, fontSize:9, fontWeight:800 }}>
                    {maestro.grupo}
                  </span>
                )}
                {isAdmin && (
                  <span style={{ background:'rgba(245,158,11,.3)', border:'1px solid rgba(245,158,11,.5)', color:'#fef3c7', padding:'3px 11px', borderRadius:50, fontSize:9, fontWeight:800 }}>
                    SOLO LECTURA
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════════ BARRA DE ACCIONES ════════ */}
        <div style={{
          padding:'12px 18px',
          display:'flex', alignItems:'center', gap:10,
          flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,.55)',
          background:           'rgba(255,255,255,.38)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
          {/* Ícono + título */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span style={{ fontSize:13, fontWeight:700, color:'#3b1f6a', flex:1 }}>Observaciones</span>

          {/* Contador */}
          <div style={{
            background:'linear-gradient(135deg,#c084fc,#818cf8)',
            color:'#fff', padding:'3px 12px', borderRadius:50,
            fontSize:11, fontWeight:800,
          }}>
            {obs.length}
          </div>

          {/* Botón nueva — solo coordinadores */}
          {!isAdmin && (
            <button
              onClick={() => { setShowForm(v => !v); setFormErr('') }}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'7px 16px', borderRadius:50,
                background: showForm
                  ? 'rgba(192,132,252,.15)'
                  : 'linear-gradient(135deg,#c084fc,#818cf8)',
                border: showForm ? '1px solid rgba(192,132,252,.4)' : 'none',
                color: showForm ? '#c084fc' : '#fff',
                fontSize:11, fontWeight:700, cursor:'pointer',
                boxShadow: showForm ? 'none' : '0 4px 14px rgba(192,132,252,.4)',
                transition:'all .18s',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {showForm
                  ? <path d="M18 6L6 18M6 6l12 12"/>
                  : <path d="M12 5v14M5 12h14"/>
                }
              </svg>
              {showForm ? 'Cancelar' : 'Nueva'}
            </button>
          )}
        </div>

        {/* ════════ FORMULARIO NUEVA OBSERVACIÓN ════════ */}
        {showForm && !isAdmin && (
          <div style={{
            padding:'16px 18px',
            borderBottom:'1px solid rgba(255,255,255,.5)',
            background:           'rgba(255,255,255,.28)',
            backdropFilter:       'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            flexShrink:0,
          }}>
            {/* Selector de tipo */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'1px', marginBottom:7 }}>
                Tipo de observación
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                    style={{
                      padding:'5px 12px', borderRadius:50, fontSize:10, fontWeight:700,
                      cursor:'pointer', transition:'all .15s',
                      background: form.tipo === t.value ? t.bg         : 'transparent',
                      color:      form.tipo === t.value ? t.color      : '#9ca3af',
                      border:     `1.5px solid ${form.tipo === t.value ? t.border : '#e5e7eb'}`,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Título */}
            <input
              type="text"
              placeholder="Título de la observación *"
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              style={{
                width:'100%', boxSizing:'border-box',
                padding:'10px 14px', borderRadius:12,
                border:'1.5px solid rgba(255,255,255,.7)',
                fontSize:13, fontFamily:'inherit', outline:'none',
                marginBottom:8,
                background:           'rgba(255,255,255,.65)',
                backdropFilter:       'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow:            'inset 0 1px 0 rgba(255,255,255,.9)',
                transition:'border-color .15s, box-shadow .15s',
              } as React.CSSProperties}
              onFocus={e => { e.target.style.borderColor = '#c084fc'; e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 3px rgba(192,132,252,.18)' }}
              onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,.7)'; e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.9)' }}
            />

            {/* Descripción */}
            <textarea
              placeholder="Descripción detallada (opcional)"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={3}
              style={{
                width:'100%', boxSizing:'border-box',
                padding:'10px 14px', borderRadius:12,
                border:'1.5px solid rgba(255,255,255,.7)',
                fontSize:12, fontFamily:'inherit',
                outline:'none', resize:'vertical',
                marginBottom:10,
                background:           'rgba(255,255,255,.65)',
                backdropFilter:       'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow:            'inset 0 1px 0 rgba(255,255,255,.9)',
                transition:'border-color .15s',
                lineHeight:1.5,
              } as React.CSSProperties}
              onFocus={e => { e.target.style.borderColor = '#c084fc'; e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 3px rgba(192,132,252,.18)' }}
              onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,.7)'; e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.9)' }}
            />

            {/* Fecha + acciones */}
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:9, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>Fecha</div>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  style={{
                    padding:'8px 12px', borderRadius:10,
                    border:'1.5px solid rgba(255,255,255,.7)', fontSize:12,
                    fontFamily:'inherit', outline:'none',
                    background:'rgba(255,255,255,.65)',
                    backdropFilter:'blur(8px)',
                    boxShadow:'inset 0 1px 0 rgba(255,255,255,.9)',
                  }}
                />
              </div>
              <div style={{ flex:1 }} />
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding:'10px 24px', borderRadius:50, border:'none',
                  background: saving ? '#e5e7eb' : 'linear-gradient(135deg,#c084fc,#818cf8)',
                  color:  saving ? '#9ca3af' : '#fff',
                  fontSize:12, fontWeight:700,
                  cursor: saving ? 'default' : 'pointer',
                  boxShadow: saving ? 'none' : '0 6px 18px rgba(192,132,252,.4)',
                  transition:'all .18s',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar observación'}
              </button>
            </div>

            {formErr && (
              <div style={{ fontSize:11, color:'#f43f5e', marginTop:8, fontWeight:600 }}>{formErr}</div>
            )}
          </div>
        )}

        {/* ════════ LISTA DE OBSERVACIONES ════════ */}
        <div style={{
          overflowY:'auto',
          padding:'14px 16px 24px',
          display:'flex', flexDirection:'column', gap:10,
          flex:1,
          background:'rgba(255,255,255,.08)',
        }}>

          {/* Error de eliminación */}
          {deleteErr && (
            <div style={{
              padding:'10px 14px', borderRadius:12, marginBottom:4,
              background:'rgba(244,63,94,.12)',
              border:'1.5px solid rgba(244,63,94,.35)',
              display:'flex', alignItems:'center', gap:8,
              flexShrink:0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize:11, color:'#f43f5e', fontWeight:600, flex:1 }}>{deleteErr}</span>
              <button onClick={() => setDeleteErr('')} style={{
                background:'none', border:'none', cursor:'pointer', padding:2,
                color:'rgba(244,63,94,.6)', fontSize:14, lineHeight:1,
              }}>✕</button>
            </div>
          )}

          {/* Cargando */}
          {loading && (
            <div style={{ textAlign:'center', padding:'40px 0', fontSize:13, color:'rgba(100,60,160,.7)', fontWeight:600 }}>
              Cargando observaciones…
            </div>
          )}

          {/* Vacío */}
          {!loading && obs.length === 0 && (
            <div style={{ textAlign:'center', padding:'44px 0' }}>
              <div style={{
                width:64, height:64, borderRadius:'50%', margin:'0 auto 14px',
                background:'rgba(255,255,255,.6)',
                backdropFilter:'blur(12px)',
                border:'1.5px solid rgba(255,255,255,.85)',
                boxShadow:'inset 0 1.5px 0 rgba(255,255,255,.95), 0 4px 16px rgba(0,0,0,.06)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28,
              }}>📋</div>
              <div style={{ fontSize:14, fontWeight:800, color:'#3b1f6a' }}>Sin observaciones</div>
              <div style={{ fontSize:11, color:'rgba(80,50,120,.6)', marginTop:5, lineHeight:1.6 }}>
                {isAdmin
                  ? 'No hay observaciones registradas para este maestro.'
                  : 'Agrega la primera observación con el botón "Nueva".'}
              </div>
            </div>
          )}

          {/* Tarjetas de observación */}
          {!loading && obs.map((o, idx) => (
            <ObsCard
              key={o.id}
              obs={o}
              idx={idx}
              visible={visible}
              isDeleting={deleting === o.id}
              onConfirmDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Tarjeta individual de observación ──────────────────────────────────── */
function ObsCard({
  obs, idx, visible, isDeleting, onConfirmDelete,
}: {
  obs:              KidsObservacion
  idx:              number
  visible:          boolean
  isDeleting:       boolean
  onConfirmDelete:  (id: string) => void
}) {
  const [hov,          setHov]          = useState(false)
  // Estado de confirmación LOCAL al card — evita stale-closure del padre
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const t = TIPOS.find(x => x.value === obs.tipo) ?? TIPOS[0]

  const fmtDate = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
  }

  function handleClick() {
    if (isDeleting) return
    if (!needsConfirm) {
      // Primer clic → mostrar confirmación; auto-cancelar en 3 s
      setNeedsConfirm(true)
      setTimeout(() => setNeedsConfirm(false), 3000)
    } else {
      // Segundo clic → ejecutar el delete en el padre
      setNeedsConfirm(false)
      onConfirmDelete(obs.id)
    }
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:      '13px 14px',
        borderRadius: 16,
        /* ── Liquid glass card ── */
        background:           hov
          ? 'rgba(255,255,255,.82)'
          : 'rgba(255,255,255,.62)',
        backdropFilter:       'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border:       `1.5px solid ${hov ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.78)'}`,
        boxShadow: hov
          ? [
              `0 8px 28px rgba(0,0,0,.09)`,
              `0 0 0 1px ${t.border}`,
              'inset 0 1.5px 0 rgba(255,255,255,.95)',
              'inset 0 -1px 0 rgba(200,180,255,.2)',
            ].join(', ')
          : [
              '0 2px 10px rgba(0,0,0,.05)',
              'inset 0 1.5px 0 rgba(255,255,255,.9)',
            ].join(', '),
        opacity:   isDeleting ? .45 : 1,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: `
          opacity  .3s ${0.06 + idx * 0.06}s cubic-bezier(.25,.46,.45,.94),
          transform .3s ${0.06 + idx * 0.06}s cubic-bezier(.25,.46,.45,.94),
          background .18s, border-color .18s, box-shadow .18s
        `,
        position: 'relative',
      }}
    >
      {/* Franja de color izquierda según tipo */}
      <div style={{
        position:'absolute', left:0, top:8, bottom:8, width:3,
        borderRadius:'0 3px 3px 0',
        background: t.color,
        opacity:.7,
      }} />

      {/* Fila superior: tipo + fecha + eliminar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, paddingLeft:10 }}>
        <span style={{
          padding:'3px 10px', borderRadius:50, fontSize:9, fontWeight:800,
          background: t.bg, color: t.color, border:`1px solid ${t.border}`,
        }}>
          {t.label}
        </span>
        <span style={{ fontSize:10, color:'#9ca3af', flex:1 }}>
          {fmtDate(obs.fecha)}
        </span>

        {/* Un solo botón con dos estados visuales */}
        <button
          onClick={handleClick}
          disabled={isDeleting}
          style={{
            height:           26,
            padding:          needsConfirm ? '0 10px' : '0',
            width:            needsConfirm ? 'auto'   : 26,
            borderRadius:     needsConfirm ? 50       : '50%',
            background:       needsConfirm
              ? 'rgba(244,63,94,.18)'
              : hov ? 'rgba(244,63,94,.1)' : 'transparent',
            border:           needsConfirm
              ? '1.5px solid rgba(244,63,94,.55)'
              : hov ? '1px solid rgba(244,63,94,.25)' : '1px solid transparent',
            cursor:           isDeleting ? 'not-allowed' : 'pointer',
            display:          'flex',
            alignItems:       'center',
            justifyContent:   'center',
            gap:              5,
            transition:       'all .18s',
            flexShrink:       0,
            opacity:          isDeleting ? .4 : 1,
          }}
        >
          <svg width={needsConfirm ? 10 : 11} height={needsConfirm ? 10 : 11}
            viewBox="0 0 24 24" fill="none" stroke="#f43f5e"
            strokeWidth={needsConfirm ? 2.5 : 2.2} strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            {!needsConfirm && <path d="M10 11v6M14 11v6"/>}
            {!needsConfirm && <path d="M9 6V4h6v2"/>}
          </svg>
          {needsConfirm && (
            <span style={{ fontSize:9, fontWeight:800, color:'#f43f5e', letterSpacing:'0.5px' }}>
              ¿Seguro?
            </span>
          )}
        </button>
      </div>

      {/* Título */}
      <div style={{ fontSize:13, fontWeight:700, color:'#111827', paddingLeft:10, marginBottom: obs.descripcion ? 5 : 0, lineHeight:1.3 }}>
        {obs.titulo}
      </div>

      {/* Descripción */}
      {obs.descripcion && (
        <div style={{ fontSize:11, color:'#6b7280', paddingLeft:10, lineHeight:1.55 }}>
          {obs.descripcion}
        </div>
      )}
    </div>
  )
}
