'use client'

import { useState, useRef, useEffect } from 'react'
import CropModal from './CropModal'

/* ── Types ───────────────────────────────────────────────────────────────── */
export interface KidsCoordinador {
  id:             string
  cedula:         string
  nombre:         string
  apellido:       string
  telefono:       string | null
  foto_url:       string | null
  grupo_asignado: string | null
  direccion:      string | null
  edad:           number | null
  activo:         boolean
  creado_en:      string
}

interface Props {
  coordinador: KidsCoordinador | null
  onClose:     () => void
  onSave:      () => Promise<void>
}

/* ── Opciones ────────────────────────────────────────────────────────────── */
const OPT_GRUPO = ['Grupo 1','Grupo 2','Grupo 3','Grupo 4','Grupo 5','Grupo 6']

/* ══════════════════════════════════════════════════════════════════════════ */
export default function CoordinadorModal({ coordinador, onClose, onSave }: Props) {
  const isEdit  = !!coordinador
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    cedula:         coordinador?.cedula         ?? '',
    nombre:         coordinador?.nombre         ?? '',
    apellido:       coordinador?.apellido       ?? '',
    telefono:       coordinador?.telefono       ?? '',
    grupo_asignado: coordinador?.grupo_asignado ?? '',
    direccion:      coordinador?.direccion      ?? '',
    edad:           coordinador?.edad           ?? 0,
    activo:         coordinador?.activo         ?? true,
  })

  const [foto,        setFoto]        = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>(coordinador?.foto_url ?? '')
  const [cropFile,    setCropFile]    = useState<File | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [visible,     setVisible]     = useState(false)
  const [isMobile,    setIsMobile]    = useState(false)

  /* Cédula verification */
  const originalCedula = coordinador?.cedula ?? ''
  type CedulaStatus = 'idle' | 'checking' | 'found' | 'not_found' | 'inactive'
  const [cedulaStatus, setCedulaStatus] = useState<CedulaStatus>('idle')
  const [cedulaNombre, setCedulaNombre] = useState('')
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Background removal */
  const [removingBg, setRemovingBg] = useState(false)
  const [bgProgress, setBgProgress] = useState(0)
  const [bgPhase,    setBgPhase]    = useState('')
  const [bgDetail,   setBgDetail]   = useState('')
  const inferenceTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => () => { if (inferenceTimer.current) clearInterval(inferenceTimer.current) }, [])
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function clearFieldError(field: string) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }; delete next[field]; return next
    })
  }

  function handleCedulaChange(val: string) {
    setForm(f => ({ ...f, cedula: val }))
    if (val.trim()) clearFieldError('cedula')
    setCedulaStatus('idle'); setCedulaNombre('')
    if (isEdit && val.trim() === originalCedula) return
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
    const trimmed = val.trim()
    if (trimmed.length < 3) return
    setCedulaStatus('checking')
    checkTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000) // timeout 5s
      try {
        const res  = await fetch(`/api/kids/servidores-check?cedula=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        clearTimeout(timer)
        const json = await res.json()
        if (json.found) {
          setCedulaStatus('found'); setCedulaNombre(json.nombre ?? '')
          if (json.nombre) {
            const parts = (json.nombre as string).trim().split(' ')
            setForm(f => ({ ...f, nombre: f.nombre || parts[0] || '', apellido: f.apellido || parts.slice(1).join(' ') }))
          }
        } else if (json.inactivo) { setCedulaStatus('inactive'); setCedulaNombre(json.nombre ?? '') }
        else { setCedulaStatus('not_found') }
      } catch { clearTimeout(timer); setCedulaStatus('not_found') }
    }, 600)
  }

  function handleClose() { setVisible(false); setTimeout(onClose, 220) }

  /* ── Imagen ──────────────────────────────────────────────────────────── */
  function compressImage(file: File, maxPx = 1200, quality = 0.85): Promise<File> {
    return new Promise(resolve => {
      const img = new Image(), url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx }
          else { width = Math.round(width * maxPx / height); height = maxPx }
        }
        const c = document.createElement('canvas'); c.width = width; c.height = height
        c.getContext('2d')!.drawImage(img, 0, 0, width, height)
        c.toBlob(b => resolve(b ? new File([b], 'foto.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', quality)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }
  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setCropFile(file)
  }
  async function handleCropConfirm(cropped: File) {
    setCropFile(null); setFotoPreview(URL.createObjectURL(cropped)); setCompressing(true)
    try   { setFoto(await compressImage(cropped, 400, 0.92)) }
    catch { setFoto(cropped) }
    finally { setCompressing(false) }
  }

  /* ── Quitar fondo ────────────────────────────────────────────────────── */
  async function handleRemoveBg() {
    if (!fotoPreview || removingBg) return
    setRemovingBg(true); setBgProgress(2); setBgPhase('Iniciando…'); setBgDetail(''); setServerError('')
    const dlMap = new Map<string, { c: number; t: number }>()
    let inferenciaIniciada = false, fakeVal = 70
    const startInferenceAnim = () => {
      if (inferenceTimer.current) clearInterval(inferenceTimer.current)
      inferenceTimer.current = setInterval(() => {
        fakeVal = Math.min(96, fakeVal + Math.random() * 1.6); setBgProgress(Math.round(fakeVal))
      }, 380)
    }
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const src = foto ?? await fetch(fotoPreview).then(r => r.blob())
      const resultBlob = await removeBackground(src, {
        model: 'isnet_quint8', publicPath: `${window.location.origin}/bg-removal/`, output: { format: 'image/png' },
        progress: (key: string, current: number, total: number) => {
          if (total <= 0) return
          if (current < total) {
            dlMap.set(key, { c: current, t: total })
            let totalB = 0, loadedB = 0; dlMap.forEach(d => { totalB += d.t; loadedB += d.c })
            setBgPhase('Cargando modelo'); setBgDetail(`${(loadedB/1_048_576).toFixed(1)} / ${(totalB/1_048_576).toFixed(1)} MB`)
            setBgProgress(Math.max(2, Math.round((loadedB / totalB) * 70)))
          } else if (!inferenciaIniciada) {
            inferenciaIniciada = true; setBgPhase('Eliminando fondo…'); setBgProgress(70); startInferenceAnim()
          }
        },
      })
      if (inferenceTimer.current) { clearInterval(inferenceTimer.current); inferenceTimer.current = null }
      setBgProgress(96); setBgPhase('Fondo blanco')
      const img = new Image(), tmp = URL.createObjectURL(resultBlob)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = tmp })
      URL.revokeObjectURL(tmp)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || 400; canvas.height = img.naturalHeight || 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0)
      await new Promise<void>(resolve => canvas.toBlob(b => {
        if (!b) return resolve()
        setFoto(new File([b], 'foto.jpg', { type: 'image/jpeg' }))
        setFotoPreview(URL.createObjectURL(b)); resolve()
      }, 'image/jpeg', 0.93))
      setBgProgress(100)
    } catch { setServerError('No se pudo quitar el fondo.') }
    finally {
      if (inferenceTimer.current) { clearInterval(inferenceTimer.current); inferenceTimer.current = null }
      setTimeout(() => { setRemovingBg(false); setBgProgress(0); setBgPhase(''); setBgDetail('') }, 700)
    }
  }

  /* ── Submit ──────────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (compressing) return

    const errs: Record<string, string> = {}
    if (!form.cedula.trim())    errs.cedula        = 'La cédula es requerida'
    if (!form.nombre.trim())    errs.nombre        = 'El nombre es requerido'
    if (!form.apellido.trim())  errs.apellido      = 'El apellido es requerido'
    if (!form.telefono.trim())  errs.telefono      = 'El teléfono es requerido'
    if (!form.grupo_asignado)   errs.grupo_asignado = 'El grupo asignado es requerido'
    if (!form.direccion.trim()) errs.direccion     = 'La dirección es requerida'

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setTimeout(() => {
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior:'smooth', block:'center' })
      }, 50)
      return
    }

    setFieldErrors({}); setServerError(''); setSaving(true)
    try {
      let foto_url: string | null = coordinador?.foto_url ?? null
      if (foto) {
        const fd = new FormData(); fd.append('file', foto); fd.append('folder', 'coordinadores')
        const up = await fetch('/api/kids/upload', { method: 'POST', body: fd }), uj = await up.json()
        if (!up.ok) throw new Error(uj.error ?? 'Error al subir foto.')
        foto_url = uj.url
      }
      const body = {
        cedula:         form.cedula.trim(),
        nombre:         form.nombre.trim(),
        apellido:       form.apellido.trim(),
        telefono:       form.telefono.trim()       || null,
        foto_url,
        grupo_asignado: form.grupo_asignado.trim() || null,
        direccion:      form.direccion.trim()      || null,
        edad:           form.edad > 0 ? form.edad  : null,
        activo:         form.activo,
      }
      const url    = isEdit ? `/api/kids/coordinadores/${coordinador!.id}` : '/api/kids/coordinadores'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar.')
      await onSave()
    } catch (e: any) { setServerError(e.message); setSaving(false) }
  }

  /* ── Layout ──────────────────────────────────────────────────────────── */
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 40,
    background:     visible ? 'rgba(0,0,0,.50)' : 'rgba(0,0,0,0)',
    backdropFilter: visible ? 'blur(3px)' : 'none',
    transition: 'background .22s, backdrop-filter .22s',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
    padding: isMobile ? 0 : '16px',
  }
  const dialogStyle: React.CSSProperties = isMobile ? {
    width: '100%', maxHeight: '96dvh', background: '#fff',
    borderRadius: '24px 24px 0 0', boxShadow: '0 -24px 72px rgba(0,0,0,.2)',
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
  } : {
    width: '100%', maxWidth: 800,
    maxHeight: 'calc(100dvh - 32px)',
    background: '#fff', borderRadius: 24,
    boxShadow: '0 32px 80px rgba(0,0,0,.22)',
    transform: visible ? 'scale(1) translateY(0)' : 'scale(.97) translateY(12px)',
    opacity: visible ? 1 : 0,
    transition: 'transform .22s cubic-bezier(.4,0,.2,1), opacity .22s',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  const liveNombre = `${form.nombre} ${form.apellido}`.trim()
  const hasErrors  = Object.keys(fieldErrors).length > 0

  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes fadeInDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes coordIn{from{opacity:0;transform:scale(.97) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .coord-row-input { border:none; outline:none; background:transparent; font-size:13px; color:#111827; width:100%; font-family:inherit; }
        .coord-row-input::placeholder { color:#c4c9d4; }
        .coord-row:focus-within { background:rgba(67,56,202,.03) !important; }
        .coord-row:focus-within .coord-row-label { color:#4338ca !important; }
      `}</style>

      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
        <div style={{ ...dialogStyle, animation:'coordIn .28s cubic-bezier(.34,1.2,.64,1) both' }}>

          {/* Drag handle móvil */}
          {isMobile && (
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 6px', flexShrink:0 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,.35)' }} />
            </div>
          )}

          {/* ══════════════════════════
              HEADER PREMIUM — gradiente
          ══════════════════════════ */}
          <div style={{
            background:'linear-gradient(145deg,#1e3a8a 0%,#4338ca 52%,#6d28d9 100%)',
            padding: isMobile ? '20px 20px 18px' : '24px 28px 20px',
            display:'flex', alignItems:'center', gap:18,
            position:'relative', flexShrink:0,
            borderBottom:'1px solid rgba(255,255,255,.12)',
          }}>
            {/* Cerrar */}
            <button type="button" onClick={handleClose} style={{
              position:'absolute', top:14, right:16,
              width:30, height:30, borderRadius:'50%',
              border:'1px solid rgba(255,255,255,.25)',
              background:'rgba(255,255,255,.12)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            {/* Avatar clickable */}
            <div
              onClick={() => !compressing && !removingBg && fileRef.current?.click()}
              style={{
                position:'relative', width:76, height:76, borderRadius:'50%', flexShrink:0,
                border:'3px solid rgba(255,255,255,.85)',
                boxShadow:'0 0 0 3px rgba(251,191,36,.55), 0 6px 22px rgba(0,0,0,.3)',
                overflow:'hidden', cursor:'pointer',
                background: fotoPreview ? 'transparent' : 'linear-gradient(135deg,#4338ca,#6d28d9)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:24, fontWeight:800, color:'rgba(255,255,255,.7)',
              }}
            >
              {fotoPreview
                ? <img src={fotoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.currentTarget.style.display='none' }} />
                : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
              {/* Overlay cámara */}
              <div style={{
                position:'absolute', inset:0,
                background:'rgba(15,23,42,.45)',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity:0, transition:'opacity .18s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity='1')}
                onMouseLeave={e => (e.currentTarget.style.opacity='0')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFotoChange} />

            {/* Info dinámica */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.55)', letterSpacing:'2.5px', textTransform:'uppercase', marginBottom:4 }}>
                {isEdit ? 'Editando perfil' : 'Nuevo registro'}
              </div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight:800, color:'#fff', letterSpacing:'-.4px', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {liveNombre || 'Coordinador Kids'}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:7, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.85)', background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.28)', padding:'2px 9px', borderRadius:50 }}>
                  Coordinador/a
                </span>
                {form.grupo_asignado && (
                  <span style={{ fontSize:9, fontWeight:700, color:'#99f6e4', background:'rgba(13,148,136,.25)', border:'1px solid rgba(13,148,136,.4)', padding:'2px 9px', borderRadius:50 }}>
                    {form.grupo_asignado}
                  </span>
                )}
              </div>
            </div>

            {/* Botones foto */}
            {(fotoPreview || removingBg) && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                {fotoPreview && !compressing && !removingBg && (
                  <button type="button" onClick={handleRemoveBg} style={{
                    padding:'5px 10px', borderRadius:50, border:'1px solid rgba(255,255,255,.3)',
                    background:'rgba(255,255,255,.14)', color:'rgba(255,255,255,.9)',
                    fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                  }}>✨ Quitar fondo</button>
                )}
                {removingBg && (
                  <div style={{ minWidth:100 }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,.7)', marginBottom:3 }}>{bgPhase} {bgProgress}%</div>
                    <div style={{ height:3, borderRadius:50, background:'rgba(255,255,255,.2)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:50, width:`${bgProgress}%`, background:'#5eead4', transition:'width .35s ease' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══════════════════════════
              BODY — filas estilo macOS
          ══════════════════════════ */}
          <div style={{ flex:1, overflowY:'auto', background:'#f0f2f8', padding: isMobile ? '14px 14px 20px' : '18px 22px 24px' }}>
            <form onSubmit={handleSubmit} id="coordinador-form">

              {/* ── IDENTIDAD ── */}
              <GroupLabel label="Identidad" icon={
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>
              }/>
              <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)' }}>

                {/* Cédula */}
                <div className="coord-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                  <RowIcon color="#4338ca" bg="rgba(67,56,202,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>
                  </RowIcon>
                  <span className="coord-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:72, flexShrink:0, transition:'color .15s' }}>Cédula *</span>
                  <div style={{ flex:1 }}>
                    <input className="coord-row-input" value={form.cedula} onChange={e => handleCedulaChange(e.target.value)} placeholder="Ej: 12345678" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.cedula ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {cedulaStatus !== 'idle' && !fieldErrors.cedula && (
                      <div style={{ fontSize:9, fontWeight:600, marginTop:2, animation:'fadeInDown .18s ease',
                        color: cedulaStatus==='found' ? '#0d9488' : cedulaStatus==='checking' ? '#9ca3af' : '#d97706' }}>
                        {cedulaStatus==='checking' && '🔍 Verificando…'}
                        {cedulaStatus==='found'    && `✅ ${cedulaNombre}`}
                        {cedulaStatus==='not_found'&& '⚠️ No está en el sistema — puedes continuar'}
                        {cedulaStatus==='inactive' && `⚠️ Inactivo: ${cedulaNombre}`}
                      </div>
                    )}
                    {fieldErrors.cedula && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.cedula}</div>}
                  </div>
                </div>

                {/* Nombre */}
                <div className="coord-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                  <RowIcon color="#4338ca" bg="rgba(67,56,202,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </RowIcon>
                  <span className="coord-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:72, flexShrink:0, transition:'color .15s' }}>Nombre *</span>
                  <div style={{ flex:1 }}>
                    <input className="coord-row-input" value={form.nombre} onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); if (e.target.value.trim()) clearFieldError('nombre') }} placeholder="Nombre" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.nombre ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {fieldErrors.nombre && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.nombre}</div>}
                  </div>
                </div>

                {/* Apellido */}
                <div className="coord-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', transition:'background .15s' }}>
                  <RowIcon color="#4338ca" bg="rgba(67,56,202,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </RowIcon>
                  <span className="coord-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:72, flexShrink:0, transition:'color .15s' }}>Apellido *</span>
                  <div style={{ flex:1 }}>
                    <input className="coord-row-input" value={form.apellido} onChange={e => { setForm(f => ({ ...f, apellido: e.target.value })); if (e.target.value.trim()) clearFieldError('apellido') }} placeholder="Apellido" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.apellido ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {fieldErrors.apellido && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.apellido}</div>}
                  </div>
                </div>
              </div>

              {/* ── CONTACTO ── */}
              <GroupLabel label="Contacto" icon={
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              }/>
              <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)' }}>
                {/* Teléfono */}
                <div className="coord-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                  <RowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </RowIcon>
                  <span className="coord-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:72, flexShrink:0, transition:'color .15s' }}>Teléfono *</span>
                  <div style={{ flex:1 }}>
                    <input className="coord-row-input" value={form.telefono} onChange={e => { setForm(f => ({ ...f, telefono: e.target.value })); if (e.target.value.trim()) clearFieldError('telefono') }} placeholder="300 123 4567" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.telefono ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {fieldErrors.telefono && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.telefono}</div>}
                  </div>
                </div>
                {/* Dirección */}
                <div className="coord-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                  <RowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </RowIcon>
                  <span className="coord-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:72, flexShrink:0, transition:'color .15s' }}>Dirección *</span>
                  <div style={{ flex:1 }}>
                    <input className="coord-row-input" value={form.direccion} onChange={e => { setForm(f => ({ ...f, direccion: e.target.value })); if (e.target.value.trim()) clearFieldError('direccion') }} placeholder="Ej: Calle 45 # 23-10" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.direccion ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {fieldErrors.direccion && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.direccion}</div>}
                  </div>
                </div>
                {/* Edad */}
                <div className="coord-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', transition:'background .15s' }}>
                  <RowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  </RowIcon>
                  <span className="coord-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:72, flexShrink:0, transition:'color .15s' }}>Edad</span>
                  <div style={{ display:'flex', alignItems:'center', gap:0, background:'#f8fafc', borderRadius:10, overflow:'hidden', height:34, border:'1px solid #e5e7eb' }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, edad: Math.max(0, f.edad - 1) }))} style={{ width:32, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                    <span style={{ fontSize:13, fontWeight:700, color:'#111827', minWidth:32, textAlign:'center' }}>{form.edad || 0}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, edad: Math.min(120, f.edad + 1) }))} style={{ width:32, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                </div>
              </div>

              {/* ── GRUPO — pills ── */}
              <GroupLabel label="Grupo asignado" icon={
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><path d="M20 10v4a8 8 0 0 1-16 0v-4"/></svg>
              }/>
              <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${fieldErrors.grupo_asignado ? 'rgba(239,68,68,.35)' : 'rgba(0,0,0,.05)'}` }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {OPT_GRUPO.map(g => (
                    <button
                      key={g} type="button"
                      onClick={() => { setForm(f => ({ ...f, grupo_asignado: g })); clearFieldError('grupo_asignado') }}
                      style={{
                        padding:'7px 16px', borderRadius:50, cursor:'pointer', fontSize:12, fontWeight:600,
                        border: form.grupo_asignado === g ? 'none' : '1.5px solid #e2e8f0',
                        background: form.grupo_asignado === g
                          ? 'linear-gradient(135deg,#4338ca,#6d28d9)'
                          : '#f8fafc',
                        color: form.grupo_asignado === g ? '#fff' : '#64748b',
                        boxShadow: form.grupo_asignado === g ? '0 4px 12px rgba(67,56,202,.38)' : 'none',
                        transform: form.grupo_asignado === g ? 'scale(1.04)' : 'scale(1)',
                        transition:'all .18s cubic-bezier(.34,1.56,.64,1)',
                      }}
                    >{g}</button>
                  ))}
                </div>
                {fieldErrors.grupo_asignado && (
                  <div style={{ fontSize:10, color:'#ef4444', marginTop:8, display:'flex', alignItems:'center', gap:4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    {fieldErrors.grupo_asignado}
                  </div>
                )}
              </div>

              {/* ── Estado (solo edición) ── */}
              {isEdit && (
                <>
                  <GroupLabel label="Estado" icon={
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  }/>
                  <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)', display:'flex', gap:8 }}>
                    {([true, false] as const).map(val => (
                      <button key={String(val)} type="button" onClick={() => setForm(f => ({ ...f, activo: val }))}
                        style={{
                          flex:1, padding:'9px', borderRadius:10, fontSize:12, fontWeight:600,
                          border:'1.5px solid', cursor:'pointer', transition:'all .15s',
                          background:  form.activo === val ? (val ? '#0d9488' : '#f43f5e') : '#fff',
                          color:       form.activo === val ? '#fff' : '#9ca3af',
                          borderColor: form.activo === val ? (val ? '#0d9488' : '#f43f5e') : '#e5e7eb',
                          boxShadow:   form.activo === val ? (val ? '0 4px 12px rgba(13,148,136,.3)' : '0 4px 12px rgba(244,63,94,.3)') : 'none',
                        }}>
                        {val ? '✓ Activo' : '○ Inactivo'}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Errores + servidor */}
              {hasErrors && (
                <div style={{ padding:'10px 14px', borderRadius:12, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', marginBottom:8, display:'flex', alignItems:'center', gap:8, animation:'fadeInDown .18s ease' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>
                    {Object.values(fieldErrors).filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              {serverError && (
                <div style={{ padding:'10px 14px', borderRadius:12, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>{serverError}</span>
                </div>
              )}

            </form>
          </div>

          {/* ══════════════════════════
              FOOTER
          ══════════════════════════ */}
          <div style={{
            display:'flex', gap:10,
            padding: isMobile ? '12px 16px 20px' : '14px 22px',
            borderTop:'1px solid #f1f5f9', flexShrink:0, background:'#fff',
          }}>
            <button type="button" onClick={handleClose} style={{
              flex:1, padding:'13px', borderRadius:50,
              border:'1.5px solid #e2e8f0', background:'#f8fafc',
              fontSize:13, fontWeight:600, color:'#64748b', cursor:'pointer',
              transition:'all .15s',
            }}>Cancelar</button>
            <button type="submit" form="coordinador-form" disabled={saving} style={{
              flex:3, padding:'13px', borderRadius:50, border:'none',
              background: saving
                ? 'linear-gradient(135deg,rgba(67,56,202,.4),rgba(109,40,217,.4))'
                : 'linear-gradient(135deg,#4338ca 0%,#6d28d9 100%)',
              color:'#fff', fontSize:13, fontWeight:700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 6px 22px rgba(67,56,202,.42)',
              transition:'all .2s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              {saving
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-9-9"/></svg>Guardando…</>
                : isEdit ? '✓ Guardar cambios' : '✦ Crear coordinador'
              }
            </button>
          </div>

        </div>
      </div>

      {cropFile && <CropModal file={cropFile} onConfirm={handleCropConfirm} onCancel={() => setCropFile(null)} />}
    </>
  )
}

/* ── GroupLabel — título de sección ─────────────────────────────────────── */
function GroupLabel({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, paddingLeft:2 }}>
      <span style={{ color:'#94a3b8', display:'flex', alignItems:'center' }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1.5px' }}>
        {label}
      </span>
    </div>
  )
}

/* ── RowIcon — ícono circular para cada fila ─────────────────────────────── */
function RowIcon({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{
      width:30, height:30, borderRadius:'50%', flexShrink:0,
      background: bg, border:`1px solid ${color}22`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      {children}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontSize:10, fontWeight:600, color:'#6b7280',
  textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6,
}
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'10px 13px', borderRadius:11,
  border:'1.5px solid #e5e7eb', fontSize:13, color:'#111827',
  background:'#fff', outline:'none', boxSizing:'border-box', transition:'border .15s',
}

function SectionLabel({ label, accent }: { label:string; accent:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
      <div style={{ width:3, height:13, borderRadius:2, background:accent, flexShrink:0 }} />
      <span style={{ fontSize:10, fontWeight:700, color:accent, textTransform:'uppercase', letterSpacing:'2px' }}>{label}</span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder='', error, disabled=false }:
  { label:string; value:string; onChange:(v:string)=>void; placeholder?:string; error?:string; disabled?:boolean }) {
  const hasError = !!error
  return (
    <div data-field-error={hasError ? 'true' : undefined}>
      <label style={{ ...labelStyle, color: hasError ? '#dc2626' : '#6b7280' }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{ ...inputStyle, background: disabled ? '#f9fafb' : '#fff', opacity: disabled ? .65 : 1,
          borderColor: hasError ? '#fca5a5' : '#e5e7eb',
          boxShadow:   hasError ? '0 0 0 3px rgba(239,68,68,.08)' : 'none',
        }}
        onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#f59e0b' }}
        onBlur={e  => { e.currentTarget.style.borderColor = hasError ? '#fca5a5' : '#e5e7eb' }}
      />
      {hasError && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, animation:'fadeInDown .18s ease' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink:0 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span style={{ fontSize:10, color:'#ef4444', fontWeight:600 }}>{error}</span>
        </div>
      )}
    </div>
  )
}

function SelectField({ label, value, options, allowCustom=false, onChange, error }:
  { label:string; value:string; options:string[]; allowCustom?:boolean; onChange:(v:string)=>void; error?:string }) {
  const [custom, setCustom] = useState(false)
  const isCustom = value && !options.includes(value)
  const hasError = !!error
  return (
    <div data-field-error={hasError ? 'true' : undefined}>
      <label style={{ ...labelStyle, color: hasError ? '#dc2626' : '#6b7280' }}>{label}</label>
      {(!custom && !isCustom) ? (
        <div style={{ position:'relative' }}>
          <select value={value} onChange={e => {
            if (allowCustom && e.target.value === '__custom__') { setCustom(true); onChange('') }
            else onChange(e.target.value)
          }} style={{ ...inputStyle, appearance:'none', paddingRight:28, cursor:'pointer',
            borderColor: hasError ? '#fca5a5' : '#e5e7eb',
            boxShadow:   hasError ? '0 0 0 3px rgba(239,68,68,.08)' : 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#f59e0b' }}
          onBlur={e  => { e.currentTarget.style.borderColor = hasError ? '#fca5a5' : '#e5e7eb' }}
          >
            <option value="">— Seleccionar —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
            {allowCustom && <option value="__custom__">✏️ Otro...</option>}
          </select>
          <svg style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      ) : (
        <div style={{ display:'flex', gap:6 }}>
          <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Escribir..." autoFocus
            style={{ ...inputStyle, flex:1, borderColor: hasError ? '#fca5a5' : '#e5e7eb' }}
            onFocus={e => { e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#f59e0b' }}
            onBlur={e  => { e.currentTarget.style.borderColor = hasError ? '#fca5a5' : '#e5e7eb' }}
          />
          <button type="button" onClick={() => { setCustom(false); onChange('') }}
            style={{ width:36, height:42, borderRadius:10, border:'1.5px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', fontSize:12, color:'#9ca3af', flexShrink:0 }}>✕</button>
        </div>
      )}
      {hasError && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, animation:'fadeInDown .18s ease' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink:0 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span style={{ fontSize:10, color:'#ef4444', fontWeight:600 }}>{error}</span>
        </div>
      )}
    </div>
  )
}

function SmallBtn({ label, color, onClick, disabled=false }:
  { label:string; color:string; onClick:()=>void; disabled?:boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      width:'100%', padding:'8px 10px', borderRadius:50, fontSize:11, fontWeight:600,
      border:`1.5px solid ${disabled ? '#d1d5db' : color}`,
      color: disabled ? '#9ca3af' : color, background:'#fff',
      cursor: disabled ? 'not-allowed' : 'pointer', transition:'all .15s',
    }}>{label}</button>
  )
}
