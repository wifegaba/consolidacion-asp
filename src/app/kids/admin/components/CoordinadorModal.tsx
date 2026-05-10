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
      try {
        const res  = await fetch(`/api/kids/servidores-check?cedula=${encodeURIComponent(trimmed)}`)
        const json = await res.json()
        if (json.found) {
          setCedulaStatus('found'); setCedulaNombre(json.nombre ?? '')
          if (json.nombre) {
            const parts = (json.nombre as string).trim().split(' ')
            setForm(f => ({ ...f, nombre: f.nombre || parts[0] || '', apellido: f.apellido || parts.slice(1).join(' ') }))
          }
        } else if (json.inactivo) { setCedulaStatus('inactive'); setCedulaNombre(json.nombre ?? '') }
        else { setCedulaStatus('not_found') }
      } catch { setCedulaStatus('idle') }
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

    /* Cédula — solo bloquea si está verificando */
    const cedulaCambio = isEdit && form.cedula.trim() !== originalCedula
    if ((!isEdit || cedulaCambio) && form.cedula.trim()) {
      if (cedulaStatus === 'checking') errs.cedula = 'Espera, verificando cédula...'
    }

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
  return (
    <>
      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
        <div style={dialogStyle}>

          {isMobile && (
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0', flexShrink:0 }}>
              <div style={{ width:40, height:4, borderRadius:2, background:'#e5e7eb' }} />
            </div>
          )}

          {/* ── Header ── */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding: isMobile ? '16px 24px' : '22px 32px',
            borderBottom:'1px solid #f3f4f6', flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{
                width:42, height:42, borderRadius:12, flexShrink:0,
                background:'linear-gradient(135deg,#f59e0b,#fbbf24)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 4px 12px rgba(245,158,11,.3)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  <path d="M19 8l2 2-2 2"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:600, color:'#d97706', letterSpacing:'2px', textTransform:'uppercase' }}>
                  {isEdit ? 'Editar registro' : 'Nuevo registro'}
                </div>
                <div style={{ fontSize:18, fontWeight:800, color:'#111827', letterSpacing:'-0.4px' }}>
                  {isEdit ? `${coordinador!.nombre} ${coordinador!.apellido}` : 'Nuevo Coordinador Kids'}
                </div>
              </div>
            </div>
            <button type="button" onClick={handleClose} style={{
              width:36, height:36, borderRadius:10, border:'1px solid #e5e7eb',
              background:'#f9fafb', cursor:'pointer', display:'flex',
              alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px' : '28px 32px' }}>
            <form onSubmit={handleSubmit} id="coordinador-form">

              {/* ══ ROW 1: Foto + Datos básicos ══ */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '180px 1fr', gap:20, marginBottom:20 }}>

                {/* Foto */}
                <div style={{
                  background:'linear-gradient(135deg,#fffbeb,#fef3c7)',
                  borderRadius:16, padding:'18px 16px', border:'1px solid rgba(245,158,11,.15)',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:12,
                }}>
                  <SectionLabel label="Foto" accent="#d97706" />
                  <div onClick={() => !compressing && !removingBg && fileRef.current?.click()} style={{
                    width:90, height:90, borderRadius:20, overflow:'hidden', cursor:'pointer',
                    background: fotoPreview ? 'transparent' : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 6px 20px rgba(245,158,11,.3)',
                  }}>
                    {fotoPreview
                      ? <img src={fotoPreview} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.currentTarget.style.display='none' }} />
                      : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%' }}>
                    <SmallBtn label={compressing ? 'Procesando...' : fotoPreview ? 'Cambiar foto' : 'Subir foto'}
                      color="#d97706" onClick={() => !compressing && !removingBg && fileRef.current?.click()} disabled={compressing || removingBg} />
                    {fotoPreview && !compressing && (
                      <SmallBtn label={removingBg ? bgPhase || 'Procesando...' : 'Quitar fondo'}
                        color="#0d9488" onClick={handleRemoveBg} disabled={removingBg} />
                    )}
                  </div>
                  {removingBg && (
                    <div style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.2)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#92400e' }}>{bgPhase}</span>
                        <span style={{ fontSize:10, fontWeight:700, color:'#d97706' }}>{bgProgress}%</span>
                      </div>
                      <div style={{ height:4, borderRadius:50, overflow:'hidden', background:'rgba(245,158,11,.15)' }}>
                        <div style={{
                          height:'100%', borderRadius:50, width:`${bgProgress}%`, transition:'width .35s ease',
                          background: bgProgress < 70 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : bgProgress < 96 ? 'linear-gradient(90deg,#0d9488,#0891b2)' : 'linear-gradient(90deg,#10b981,#34d399)',
                        }} />
                      </div>
                      {bgDetail && <div style={{ fontSize:9, color:'#92400e', marginTop:3, opacity:.75 }}>{bgDetail}</div>}
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFotoChange} />
                </div>

                {/* Datos básicos */}
                <div style={{ background:'#fafafa', borderRadius:16, padding:'18px 20px', border:'1px solid rgba(0,0,0,.05)' }}>
                  <SectionLabel label="Identificación" accent="#d97706" />

                  {/* Cédula */}
                  <Field label="Cédula *" value={form.cedula} placeholder="Ej: 12345678"
                    error={fieldErrors.cedula} onChange={handleCedulaChange} />
                  {cedulaStatus !== 'idle' && !fieldErrors.cedula && (
                    <div style={{
                      marginTop:5, padding:'6px 10px', borderRadius:8, fontSize:10, fontWeight:600,
                      display:'flex', alignItems:'center', gap:6,
                      ...(cedulaStatus === 'checking'
                        ? { background:'#f9fafb', color:'#9ca3af', border:'1px solid #e5e7eb' }
                        : cedulaStatus === 'found'
                        ? { background:'#f0fdfa', color:'#0d9488', border:'1px solid rgba(13,148,136,.25)' }
                        : { background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a' }),
                    }}>
                      {cedulaStatus === 'checking'  && '🔍 Verificando en el sistema...'}
                      {cedulaStatus === 'found'     && <>✅ Encontrado: <strong>{cedulaNombre}</strong></>}
                      {cedulaStatus === 'not_found' && '⚠️ No está en el sistema principal — puedes continuar'}
                      {cedulaStatus === 'inactive'  && `⚠️ Servidor inactivo: ${cedulaNombre} — puedes continuar`}
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                    <Field label="Nombre *"   value={form.nombre}   placeholder="Nombre"         error={fieldErrors.nombre}   onChange={v => { setForm(f => ({ ...f, nombre:   v })); if (v.trim()) clearFieldError('nombre')   }} />
                    <Field label="Apellido *" value={form.apellido} placeholder="Apellido"       error={fieldErrors.apellido} onChange={v => { setForm(f => ({ ...f, apellido: v })); if (v.trim()) clearFieldError('apellido') }} />
                    <Field label="Teléfono *" value={form.telefono} placeholder="300 123 4567"   error={fieldErrors.telefono} onChange={v => { setForm(f => ({ ...f, telefono: v })); if (v.trim()) clearFieldError('telefono') }} />
                  </div>
                </div>
              </div>

              {/* ══ ROW 2: Datos personales ══ */}
              <div style={{ background:'#fafafa', borderRadius:16, padding:'18px 20px', border:'1px solid rgba(0,0,0,.05)', marginBottom:20 }}>
                <SectionLabel label="Datos personales" accent="#d97706" />
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 148px', gap:12 }}>
                  <Field label="Dirección *" value={form.direccion} placeholder="Ej: Calle 45 # 23-10, Barrio El Centro"
                    error={fieldErrors.direccion}
                    onChange={v => { setForm(f => ({ ...f, direccion: v })); if (v.trim()) clearFieldError('direccion') }} />
                  {/* Edad — contador numérico */}
                  <div>
                    <label style={labelStyle}>Edad</label>
                    <div style={{ display:'flex', alignItems:'center', gap:0, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:11, overflow:'hidden', height:42 }}>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, edad: Math.max(0, f.edad - 1) }))}
                        style={{ width:36, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
                      <input type="number" value={form.edad === 0 ? '' : form.edad} min={0} max={120}
                        onChange={e => setForm(f => ({ ...f, edad: Math.max(0, Math.min(120, Number(e.target.value) || 0)) }))}
                        placeholder="0"
                        style={{ flex:1, border:'none', outline:'none', textAlign:'center', fontSize:14, fontWeight:700, color:'#111827', background:'transparent', width:0 }}
                      />
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, edad: Math.min(120, f.edad + 1) }))}
                        style={{ width:36, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ ROW 3: Asignación ══ */}
              <div style={{ background:'#fffbeb', borderRadius:16, padding:'18px 20px', border:'1px solid rgba(245,158,11,.12)', marginBottom: (isEdit || serverError || Object.keys(fieldErrors).length > 0) ? 20 : 0 }}>
                <SectionLabel label="Asignación" accent="#d97706" />
                <SelectField label="Grupo asignado *" value={form.grupo_asignado} options={OPT_GRUPO}
                  error={fieldErrors.grupo_asignado}
                  onChange={v => { setForm(f => ({ ...f, grupo_asignado: v })); if (v) clearFieldError('grupo_asignado') }} />
              </div>

              {/* Estado — solo edición */}
              {isEdit && (
                <div style={{ marginBottom: (serverError || Object.keys(fieldErrors).length > 0) ? 16 : 0 }}>
                  <label style={labelStyle}>Estado del registro</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {([true, false] as const).map(val => (
                      <button key={String(val)} type="button" onClick={() => setForm(f => ({ ...f, activo: val }))}
                        style={{
                          flex:1, padding:'10px', borderRadius:10, fontSize:12, fontWeight:600,
                          border:'1.5px solid', cursor:'pointer', transition:'all .15s',
                          background:  form.activo === val ? (val ? '#0d9488' : '#f43f5e') : '#fff',
                          color:       form.activo === val ? '#fff' : '#9ca3af',
                          borderColor: form.activo === val ? (val ? '#0d9488' : '#f43f5e') : '#e5e7eb',
                        }}>
                        {val ? 'Activo' : 'Inactivo'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen de errores */}
              {Object.keys(fieldErrors).length > 0 && (
                <div style={{ marginTop:12, padding:'12px 16px', borderRadius:12, background:'#fffbeb', border:'1px solid #fde68a', fontSize:12, color:'#92400e', fontWeight:500 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span style={{ fontWeight:700, color:'#b45309' }}>
                      {Object.keys(fieldErrors).length === 1 ? 'Falta 1 campo' : `Faltan ${Object.keys(fieldErrors).length} campos`}
                    </span>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap' as const, gap:'4px 8px' }}>
                    {Object.values(fieldErrors).map((msg, i) => (
                      <span key={i} style={{ background:'rgba(217,119,6,.12)', padding:'3px 8px', borderRadius:20, fontSize:11, color:'#92400e', fontWeight:600 }}>
                        {msg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Error servidor */}
              {serverError && (
                <div style={{ marginTop:10, padding:'11px 14px', borderRadius:12, background:'#fff5f5', border:'1px solid #fecdd3', fontSize:12, color:'#f43f5e', fontWeight:500, display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  {serverError}
                </div>
              )}

            </form>
          </div>

          {/* ── Footer ── */}
          <div style={{
            display:'flex', gap:10,
            padding: isMobile ? '14px 20px 20px' : '16px 32px',
            borderTop:'1px solid #f3f4f6', flexShrink:0, background:'#fff',
          }}>
            <button type="button" onClick={handleClose} style={{
              flex:1, padding:'12px', borderRadius:50, border:'1.5px solid #e5e7eb',
              background:'transparent', fontSize:13, fontWeight:600, color:'#6b7280', cursor:'pointer',
            }}>Cancelar</button>
            <button type="submit" form="coordinador-form" disabled={saving} style={{
              flex:3, padding:'12px', borderRadius:50, border:'none',
              background:  saving ? '#e5e7eb' : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
              color:       saving ? '#9ca3af' : '#fff',
              fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow:   saving ? 'none' : '0 8px 24px rgba(245,158,11,.35)',
              transition:  'all .2s',
            }}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear coordinador'}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes fadeInDown{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {cropFile && <CropModal file={cropFile} onConfirm={handleCropConfirm} onCancel={() => setCropFile(null)} />}
    </>
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
