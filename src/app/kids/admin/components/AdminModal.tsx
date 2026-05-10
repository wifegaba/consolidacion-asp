'use client'

import { useState, useRef, useEffect } from 'react'
import CropModal from './CropModal'

export interface KidsAdmin {
  id: string
  cedula: string
  nombre: string
  apellido: string
  telefono: string | null
  foto_url: string | null
  activo: boolean
  creado_en: string
}

interface Props {
  admin: KidsAdmin | null     // null = crear, object = editar
  onClose: () => void
  onSave:  () => Promise<void>
}

export default function AdminModal({ admin, onClose, onSave }: Props) {
  const isEdit = !!admin
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    cedula:   admin?.cedula   ?? '',
    nombre:   admin?.nombre   ?? '',
    apellido: admin?.apellido ?? '',
    telefono: admin?.telefono ?? '',
    activo:   admin?.activo   ?? true,
  })
  const [foto,         setFoto]         = useState<File | null>(null)
  const [fotoPreview,  setFotoPreview]  = useState<string>(admin?.foto_url ?? '')
  const [cropFile,     setCropFile]     = useState<File | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [compressing,  setCompressing]  = useState(false)
  const [removingBg,   setRemovingBg]   = useState(false)
  const [bgProgress,   setBgProgress]   = useState(0)    // 0-100
  const [bgPhase,      setBgPhase]      = useState('')    // main label
  const [bgDetail,     setBgDetail]     = useState('')    // secondary label (size, %)
  const inferenceTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error,        setError]        = useState('')
  const [visible,      setVisible]      = useState(false)
  const [isMobile,     setIsMobile]     = useState(false)

  // Verificación de cédula contra servidores
  const originalCedula = admin?.cedula ?? ''   // cédula original al abrir el modal
  type CedulaStatus = 'idle' | 'checking' | 'found' | 'not_found' | 'inactive'
  const [cedulaStatus,   setCedulaStatus]   = useState<CedulaStatus>('idle')
  const [cedulaNombre,   setCedulaNombre]   = useState('')
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Responsive detection ─────────────────────────────────────────────── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Clear inference animation timer on unmount
  useEffect(() => () => {
    if (inferenceTimer.current) clearInterval(inferenceTimer.current)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  /* ── Cédula verification (creation mode only) ─────────────────────────────
     Debounced lookup against the `servidores` table so the admin knows if
     the person is already registered in the main system.
  ─────────────────────────────────────────────────────────────────────── */
  function handleCedulaChange(val: string) {
    setForm(f => ({ ...f, cedula: val }))

    setCedulaStatus('idle')
    setCedulaNombre('')

    // En edición: si la cédula vuelve al valor original, no verificar
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
          setCedulaStatus('found')
          setCedulaNombre(json.nombre ?? '')
          // Pre-fill nombre if fields are still empty
          if (json.nombre) {
            const parts   = (json.nombre as string).trim().split(' ')
            const nombre  = parts[0] ?? ''
            const apellido = parts.slice(1).join(' ')
            setForm(f => ({
              ...f,
              nombre:   f.nombre   || nombre,
              apellido: f.apellido || apellido,
            }))
          }
        } else if (json.inactivo) {
          setCedulaStatus('inactive')
          setCedulaNombre(json.nombre ?? '')
        } else {
          setCedulaStatus('not_found')
        }
      } catch {
        setCedulaStatus('idle')
      }
    }, 600)
  }

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  /* ── Client-side image compression ───────────────────────────────────────
     Reduces phone photos (8-15 MB) to ~200-400 KB before upload.
     Max dimension: 1200 px · JPEG 85 % quality · no extra dependencies.
  ─────────────────────────────────────────────────────────────────────── */
  function compressImage(file: File, maxPx = 1200, quality = 0.85): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image()
      const blobUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(blobUrl)
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          if (width >= height) {
            height = Math.round((height * maxPx) / width)
            width  = maxPx
          } else {
            width  = Math.round((width * maxPx) / height)
            height = maxPx
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob => resolve(blob
            ? new File([blob], 'foto.jpg', { type: 'image/jpeg' })
            : file           // fallback: original if canvas fails
          ),
          'image/jpeg',
          quality,
        )
      }
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file) }
      img.src = blobUrl
    })
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCropFile(file)
  }
  async function handleCropConfirm(cropped: File) {
    setCropFile(null)
    setFotoPreview(URL.createObjectURL(cropped))
    setCompressing(true)
    try {
      const final = await compressImage(cropped, 400, 0.92)
      setFoto(final)
    } catch {
      setFoto(cropped)
    } finally {
      setCompressing(false)
    }
  }

  /* ── Background removal ───────────────────────────────────────────────────
     Barra de progreso en 3 fases reales:
       0 – 70 %  → descarga de archivos del modelo (bytes reales del callback)
       70 – 96 % → inferencia IA (la lib no emite eventos → animación suave)
       96 – 100% → aplicar fondo blanco
  ─────────────────────────────────────────────────────────────────────── */
  async function handleRemoveBg() {
    if (!fotoPreview || removingBg) return
    setRemovingBg(true)
    setBgProgress(2)
    setBgPhase('Iniciando…')
    setBgDetail('')
    setError('')

    // Acumula bytes de todos los archivos descargados
    const dlMap = new Map<string, { c: number; t: number }>()
    let inferenciaIniciada = false
    let fakeVal = 70

    function startInferenceAnim() {
      if (inferenceTimer.current) clearInterval(inferenceTimer.current)
      inferenceTimer.current = setInterval(() => {
        fakeVal = Math.min(96, fakeVal + Math.random() * 1.6)
        setBgProgress(Math.round(fakeVal))
      }, 380)
    }

    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const src = foto ?? await fetch(fotoPreview).then(r => r.blob())

      const resultBlob = await removeBackground(src, {
        model:      'isnet_quint8',
        publicPath: `${window.location.origin}/bg-removal/`,
        output:     { format: 'image/png' },
        progress: (key: string, current: number, total: number) => {
          if (total <= 0) return

          if (current < total) {
            // ── Fase 1: descarga (bytes reales) ─────────────────────────
            dlMap.set(key, { c: current, t: total })

            let totalB = 0, loadedB = 0
            dlMap.forEach(d => { totalB += d.t; loadedB += d.c })

            const loadedMB  = (loadedB / 1_048_576).toFixed(1)
            const totalMB   = (totalB  / 1_048_576).toFixed(1)
            const archivoPct = Math.round((current / total) * 100)
            // Descarga = 0→70 % de la barra global
            const globalPct = Math.max(2, Math.round((loadedB / totalB) * 70))

            setBgPhase('Descargando modelo de IA')
            setBgDetail(`${loadedMB} de ${totalMB} MB  ·  archivo actual ${archivoPct}%`)
            setBgProgress(globalPct)

          } else if (!inferenciaIniciada) {
            // ── Fase 2: inferencia (empieza cuando current === total) ───
            inferenciaIniciada = true
            let totalB = 0
            dlMap.forEach(d => { totalB += d.t })
            const totalMB = (totalB / 1_048_576).toFixed(1)

            setBgPhase('Eliminando el fondo con IA')
            setBgDetail(totalB > 0
              ? `Modelo listo (${totalMB} MB)  ·  analizando imagen…`
              : 'Analizando imagen…')
            setBgProgress(70)
            startInferenceAnim()
          }
        },
      })

      // ── Fase 3: fondo blanco ──────────────────────────────────────────
      if (inferenceTimer.current) { clearInterval(inferenceTimer.current); inferenceTimer.current = null }
      setBgProgress(96)
      setBgPhase('Aplicando fondo blanco')
      setBgDetail('')

      const img    = new Image()
      const tmpUrl = URL.createObjectURL(resultBlob)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = tmpUrl })
      URL.revokeObjectURL(tmpUrl)

      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth  || 400
      canvas.height = img.naturalHeight || 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      setBgProgress(99)
      await new Promise<void>(resolve => {
        canvas.toBlob(b => {
          if (!b) return resolve()
          setFoto(new File([b], 'foto.jpg', { type: 'image/jpeg' }))
          setFotoPreview(URL.createObjectURL(b))
          resolve()
        }, 'image/jpeg', 0.93)
      })
      setBgProgress(100)

    } catch (e: any) {
      console.error('[REMOVE BG]', e)
      setError('No se pudo quitar el fondo. Intenta de nuevo.')
    } finally {
      if (inferenceTimer.current) { clearInterval(inferenceTimer.current); inferenceTimer.current = null }
      setTimeout(() => {
        setRemovingBg(false)
        setBgProgress(0)
        setBgPhase('')
        setBgDetail('')
      }, 700)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (compressing) return   // wait until compression finishes
    if (!form.cedula.trim() || !form.nombre.trim() || !form.apellido.trim()) {
      setError('Cédula, nombre y apellido son obligatorios.')
      return
    }
    // La cédula debe existir en servidores:
    //   - Siempre en modo CREACIÓN
    //   - En EDICIÓN solo si cambió respecto al valor original
    const cedulaCambio = isEdit && form.cedula.trim() !== originalCedula
    if (!isEdit || cedulaCambio) {
      if (cedulaStatus !== 'found') {
        setError(
          cedulaStatus === 'checking'
            ? 'Verificando cédula... espera un momento.'
            : cedulaStatus === 'inactive'
            ? 'Este servidor está inactivo en el sistema principal.'
            : 'La cédula no está registrada en el sistema. El administrador no podría iniciar sesión.',
        )
        return
      }
    }
    setSaving(true)
    setError('')

    try {
      // ── Upload foto if selected ─────────────────────────────────────────
      let foto_url: string | null = admin?.foto_url ?? null
      if (foto) {
        const fd = new FormData()
        fd.append('file', foto)
        fd.append('folder', 'administradores')
        const upRes  = await fetch('/api/kids/upload', { method: 'POST', body: fd })
        const upJson = await upRes.json()
        if (!upRes.ok) throw new Error(upJson.error ?? 'Error al subir la foto.')
        foto_url = upJson.url
      }

      // ── Create or Update ────────────────────────────────────────────────
      const body: Record<string, any> = {
        nombre:   form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim() || null,
        activo:   form.activo,
        foto_url,
      }
      // Incluir cédula siempre (en creación es obligatoria, en edición solo si cambió)
      body.cedula = form.cedula.trim()

      const url    = isEdit ? `/api/kids/administradores/${admin!.id}` : '/api/kids/administradores'
      const method = isEdit ? 'PUT' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar.')

      await onSave()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  /* ── Derived responsive styles ──────────────────────────────────────────
     Desktop: slide-in panel from right (480px wide)
     Mobile:  slide-up sheet from bottom (full width, 90vh max)
  ─────────────────────────────────────────────────────────────────────── */
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position:      'fixed',
        left:          0,
        right:         0,
        bottom:        0,
        top:           'auto',
        width:         '100%',
        maxHeight:     '92dvh',
        background:    '#fff',
        boxShadow:     '0 -24px 72px rgba(0,0,0,.16)',
        borderRadius:  '24px 24px 0 0',
        transform:     visible ? 'translateY(0)' : 'translateY(100%)',
        transition:    'transform .25s cubic-bezier(.4,0,.2,1)',
        zIndex:        50,
        display:       'flex',
        flexDirection: 'column',
        overflowY:     'auto',
      }
    : {
        position:      'fixed',
        top:           0,
        right:         0,
        bottom:        0,
        width:         480,
        maxWidth:      '100vw',
        background:    '#fff',
        boxShadow:     '-24px 0 72px rgba(0,0,0,.14)',
        transform:     visible ? 'translateX(0)' : 'translateX(100%)',
        transition:    'transform .22s cubic-bezier(.4,0,.2,1)',
        zIndex:        50,
        display:       'flex',
        flexDirection: 'column',
        overflowY:     'auto',
      }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: visible ? 'rgba(0,0,0,.40)' : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(2px)' : 'none',
          transition: 'background .22s, backdrop-filter .22s',
          zIndex:     40,
        }}
      />

      {/* Panel */}
      <div style={panelStyle}>

        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'#e5e7eb' }} />
          </div>
        )}

        {/* ── Header ── */}
        <div style={{
          padding:      isMobile ? '16px 24px 16px' : '28px 32px 22px',
          borderBottom: '1px solid #f3f4f6',
          flexShrink:   0,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div style={{
                fontSize:      10,
                fontWeight:    600,
                color:         '#0d9488',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom:  4,
              }}>
                {isEdit ? 'Editar registro' : 'Nuevo registro'}
              </div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight:800, color:'#111827', letterSpacing:'-0.5px' }}>
                {isEdit ? `${admin!.nombre} ${admin!.apellido}` : 'Nuevo Administrador'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: '1px solid #e5e7eb', background: '#f9fafb',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body / Form ── */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex:    1,
            padding: isMobile ? '20px 24px' : '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap:     18,
            overflowY: isMobile ? 'auto' : 'visible',
          }}
        >

          {/* Photo upload */}
          <div style={{ display:'flex', alignItems:'center', gap:isMobile ? 16 : 20 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: isMobile ? 70 : 80,
                height: isMobile ? 70 : 80,
                borderRadius: 20, overflow: 'hidden', flexShrink: 0,
                background: fotoPreview ? 'transparent' : 'linear-gradient(135deg,#0d9488,#0891b2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(13,148,136,.25)',
              }}
            >
              {fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="preview"
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:4 }}>Foto de perfil</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:10 }}>JPG o PNG · desde la galería o cámara</div>

              {/* Action buttons row */}
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:7 }}>
                {/* Upload / change */}
                <button
                  type="button"
                  onClick={() => !compressing && !removingBg && fileRef.current?.click()}
                  disabled={compressing || removingBg}
                  style={{
                    padding:'7px 14px', borderRadius:50, fontSize:11, fontWeight:600,
                    border:`1.5px solid ${compressing ? '#9ca3af' : '#0d9488'}`,
                    color: compressing ? '#9ca3af' : '#0d9488',
                    background:'transparent',
                    cursor: compressing || removingBg ? 'not-allowed' : 'pointer',
                    transition:'all .15s',
                  }}
                >
                  {compressing ? 'Procesando...' : fotoPreview ? 'Cambiar foto' : 'Subir foto'}
                </button>

                {/* Remove background — only when photo is selected */}
                {fotoPreview && !compressing && (
                  <button
                    type="button"
                    onClick={handleRemoveBg}
                    disabled={removingBg}
                    style={{
                      padding:'7px 14px', borderRadius:50, fontSize:11, fontWeight:600,
                      border:'1.5px solid #7c3aed',
                      color:      removingBg ? '#9ca3af' : '#7c3aed',
                      borderColor:removingBg ? '#d1d5db' : '#7c3aed',
                      background: 'transparent',
                      cursor:     removingBg ? 'not-allowed' : 'pointer',
                      display:    'flex', alignItems:'center', gap:5,
                      transition: 'all .15s',
                    }}
                  >
                    {!removingBg && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                      </svg>
                    )}
                    {removingBg ? bgPhase || 'Trabajando…' : 'Quitar fondo'}
                  </button>
                )}
              </div>

              {/* Progress block — only while removing background */}
              {removingBg && (
                <div style={{
                  marginTop:10, padding:'12px 14px', borderRadius:12,
                  background:'linear-gradient(135deg,#faf5ff,#f3e8ff)',
                  border:'1px solid rgba(124,58,237,.15)',
                }}>
                  {/* Phase + percentage */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      {/* Spinner dot */}
                      <div style={{
                        width:7, height:7, borderRadius:'50%',
                        background:'#7c3aed',
                        animation:'pulse 1.2s ease-in-out infinite',
                      }} />
                      <span style={{ fontSize:12, fontWeight:700, color:'#6d28d9' }}>
                        {bgPhase}
                      </span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:'#7c3aed' }}>
                      {bgProgress}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height:6, borderRadius:50, overflow:'hidden', background:'rgba(124,58,237,.12)' }}>
                    <div style={{
                      height:'100%', borderRadius:50,
                      background:  bgProgress < 70
                        ? 'linear-gradient(90deg,#7c3aed,#a855f7)'   // descarga: morado
                        : bgProgress < 96
                        ? 'linear-gradient(90deg,#0d9488,#0891b2)'   // inferencia: teal
                        : 'linear-gradient(90deg,#10b981,#34d399)',  // final: verde
                      width:`${bgProgress}%`,
                      transition:'width .35s ease, background .5s ease',
                    }} />
                  </div>

                  {/* Detail line */}
                  {bgDetail && (
                    <div style={{ fontSize:10, color:'#7c3aed', marginTop:6, opacity:.8 }}>
                      {bgDetail}
                    </div>
                  )}

                  {/* First-time hint */}
                  {bgProgress <= 10 && (
                    <div style={{ fontSize:10, color:'#a78bfa', marginTop:4 }}>
                      El modelo se carga desde el servidor · no requiere internet externo
                    </div>
                  )}
                </div>
              )}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display:'none' }}
                onChange={handleFotoChange}
              />
            </div>
          </div>

          {/* Cedula + verificación en tiempo real */}
          <div>
            <Field
              label="Número de cédula"
              value={form.cedula}
              placeholder="Ej: 12345678"
              onChange={handleCedulaChange}
            />
            {/* Badge de estado (solo en modo creación) */}
            {!isEdit && cedulaStatus !== 'idle' && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 10,
                display:   'flex', alignItems: 'center', gap: 8,
                fontSize:  11, fontWeight: 600,
                ...(cedulaStatus === 'checking' ? {
                  background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb',
                } : cedulaStatus === 'found' ? {
                  background: '#f0fdfa', color: '#0d9488', border: '1px solid rgba(13,148,136,.25)',
                } : {
                  background: '#fff5f5', color: '#f43f5e', border: '1px solid #fecdd3',
                }),
              }}>
                {cedulaStatus === 'checking' && (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    Verificando en el sistema...
                  </>
                )}
                {cedulaStatus === 'found' && (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Servidor encontrado: <strong>{cedulaNombre}</strong>
                  </>
                )}
                {cedulaStatus === 'not_found' && (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                    </svg>
                    No encontrado en el sistema principal
                  </>
                )}
                {cedulaStatus === 'inactive' && (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                    </svg>
                    Servidor inactivo: {cedulaNombre}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Nombre + Apellido */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field
              label="Nombre"
              value={form.nombre}
              placeholder="Nombre"
              onChange={v => setForm(f => ({ ...f, nombre: v }))}
            />
            <Field
              label="Apellido"
              value={form.apellido}
              placeholder="Apellido"
              onChange={v => setForm(f => ({ ...f, apellido: v }))}
            />
          </div>

          {/* Telefono */}
          <Field
            label="Teléfono (opcional)"
            value={form.telefono}
            placeholder="Ej: 300 123 4567"
            required={false}
            onChange={v => setForm(f => ({ ...f, telefono: v }))}
          />

          {/* Estado — solo en edición */}
          {isEdit && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>
                Estado
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {([true, false] as const).map(val => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, activo: val }))}
                    style={{
                      padding:     '8px 20px',
                      borderRadius: 50,
                      fontSize:    12,
                      fontWeight:  600,
                      border:      '1.5px solid',
                      cursor:      'pointer',
                      background:  form.activo === val ? (val ? '#0d9488' : '#f43f5e') : 'transparent',
                      color:       form.activo === val ? '#fff' : '#9ca3af',
                      borderColor: form.activo === val ? (val ? '#0d9488' : '#f43f5e') : '#e5e7eb',
                      transition:  'all .15s',
                    }}
                  >
                    {val ? 'Activo' : 'Inactivo'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fecdd3', borderRadius: 12,
              padding: '12px 16px', fontSize: 12, color: '#f43f5e', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              {error}
            </div>
          )}

          {/* Spacer (desktop only) */}
          {!isMobile && <div style={{ flex:1 }} />}

          {/* Actions */}
          <div style={{
            display:'flex', gap:10,
            paddingTop:  16,
            borderTop:   '1px solid #f3f4f6',
            flexShrink:  0,
            marginTop:   isMobile ? 4 : 0,
          }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                flex: 1, padding: '13px', borderRadius: 50,
                border: '1.5px solid #e5e7eb', background: 'transparent',
                fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2, padding: '13px', borderRadius: 50, border: 'none',
                background:  saving ? '#e5e7eb' : 'linear-gradient(135deg,#0d9488,#0891b2)',
                color:       saving ? '#9ca3af' : '#fff',
                fontSize:    13,
                fontWeight:  700,
                cursor:      saving ? 'not-allowed' : 'pointer',
                boxShadow:   saving ? 'none' : '0 8px 24px rgba(13,148,136,.32)',
                transition:  'all .2s',
                letterSpacing: '0.2px',
              }}
            >
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear administrador'}
            </button>
          </div>

          {/* Bottom safe area for mobile */}
          {isMobile && <div style={{ height: 8 }} />}
        </form>
      </div>

      {cropFile && <CropModal file={cropFile} onConfirm={handleCropConfirm} onCancel={() => setCropFile(null)} />}
    </>
  )
}

/* ── Reusable field ─────────────────────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder = '', disabled = false, required = true,
}: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  disabled?:   boolean
  required?:   boolean
}) {
  return (
    <div>
      <label style={{
        fontSize:      11,
        fontWeight:    600,
        color:         '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        display:       'block',
        marginBottom:  7,
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        style={{
          width:        '100%',
          padding:      '12px 16px',
          borderRadius: 12,
          border:       '1.5px solid #e5e7eb',
          fontSize:     14,
          color:        '#111827',
          background:   disabled ? '#f9fafb' : '#fff',
          outline:      'none',
          boxSizing:    'border-box',
          opacity:      disabled ? .65 : 1,
          transition:   'border .15s',
        }}
        onFocus={e  => { if (!disabled) e.currentTarget.style.borderColor = '#0d9488' }}
        onBlur={e   => { e.currentTarget.style.borderColor = '#e5e7eb' }}
      />
    </div>
  )
}
