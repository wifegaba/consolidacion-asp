'use client'

import { useState, useRef, useEffect } from 'react'
import CropModal from './CropModal'

/* ── Types ───────────────────────────────────────────────────────────────── */
export interface KidsMaestro {
  id:                  string
  cedula:              string
  nombre:              string
  apellido:            string
  telefono:            string | null
  foto_url:            string | null
  grupo:               string
  puede_dirigir:       boolean
  direccion:           string | null
  estudios:            string | null
  profesion:           string | null
  estado_civil:        string | null
  hijos:               number
  sirve_entre_semana:  boolean
  horario_servicio:    string | null
  grupo_servicio:      string | null
  activo:              boolean
  creado_en:           string
}

interface Props {
  maestro: KidsMaestro | null
  onClose: () => void
  onSave:  () => Promise<void>
}

/* ── Opciones ────────────────────────────────────────────────────────────── */
const OPT_ESTUDIOS       = ['Primaria','Bachiller','Técnico/a','Tecnólogo/a','Universitario/a','Postgrado']
const OPT_ESTADO_CIVIL   = ['Soltero/a','Casado/a','Unión libre','Divorciado/a','Viudo/a']
const OPT_HORARIO        = ['Domingo 7:00am','Domingo 9:00am','Domingo 11:00am','Miércoles 7:00pm','Viernes 7:00pm']
const OPT_GRUPO_SERVICIO = ['Semillitas','Exploradores','Aventureros','Conquistadores','Pre-teens','Grupo A','Grupo B','Grupo C']
const OPT_GRUPO          = ['Grupo 1','Grupo 2','Grupo 3','Grupo 4','Grupo 5','Grupo 6']

/* ══════════════════════════════════════════════════════════════════════════ */
export default function MaestroModal({ maestro, onClose, onSave }: Props) {
  const isEdit  = !!maestro
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    cedula:             maestro?.cedula             ?? '',
    nombre:             maestro?.nombre             ?? '',
    apellido:           maestro?.apellido           ?? '',
    telefono:           maestro?.telefono           ?? '',
    grupo:              maestro?.grupo              ?? '',
    puede_dirigir:      maestro?.puede_dirigir      ?? false,
    direccion:          maestro?.direccion          ?? '',
    estudios:           maestro?.estudios           ?? '',
    profesion:          maestro?.profesion          ?? '',
    estado_civil:       maestro?.estado_civil       ?? '',
    hijos:              String(maestro?.hijos       ?? 0),
    sirve_entre_semana: maestro?.sirve_entre_semana ?? false,
    horario_servicio:   maestro?.horario_servicio   ?? '',
    grupo_servicio:     maestro?.grupo_servicio     ?? '',
    activo:             maestro?.activo             ?? true,
  })

  const [foto,        setFoto]        = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>(maestro?.foto_url ?? '')
  const [cropFile,    setCropFile]    = useState<File | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [visible,     setVisible]     = useState(false)
  const [isMobile,    setIsMobile]    = useState(false)

  /* Limpia el error de un campo cuando el usuario lo llena */
  function clearFieldError(field: string) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  /* Cédula verification */
  const originalCedula = maestro?.cedula ?? ''
  type CedulaStatus = 'idle' | 'checking' | 'found' | 'not_found' | 'inactive'
  const [cedulaStatus, setCedulaStatus] = useState<CedulaStatus>('idle')
  const [cedulaNombre, setCedulaNombre] = useState('')
  const checkTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Background removal */
  const [removingBg, setRemovingBg] = useState(false)
  const [bgProgress, setBgProgress] = useState(0)
  const [bgPhase,    setBgPhase]    = useState('')
  const [bgDetail,   setBgDetail]   = useState('')
  const inferenceTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => () => { if (inferenceTimer.current) clearInterval(inferenceTimer.current) }, [])
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  /* ── Cédula ──────────────────────────────────────────────────────────── */
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

  /* ── Compresión ──────────────────────────────────────────────────────── */
  function compressImage(file: File, maxPx = 1200, quality = 0.85): Promise<File> {
    return new Promise(resolve => {
      const img = new Image(), url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx }
          else                 { width  = Math.round(width  * maxPx / height); height = maxPx }
        }
        const c = document.createElement('canvas')
        c.width = width; c.height = height
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
      inferenceTimer.current = setInterval(() => { fakeVal = Math.min(96, fakeVal + Math.random() * 1.6); setBgProgress(Math.round(fakeVal)) }, 380)
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
      await new Promise<void>(resolve => canvas.toBlob(b => { if (!b) return resolve(); setFoto(new File([b],'foto.jpg',{type:'image/jpeg'})); setFotoPreview(URL.createObjectURL(b)); resolve() }, 'image/jpeg', 0.93))
      setBgProgress(100)
    } catch (e: any) { setServerError('No se pudo quitar el fondo.') }
    finally {
      if (inferenceTimer.current) { clearInterval(inferenceTimer.current); inferenceTimer.current = null }
      setTimeout(() => { setRemovingBg(false); setBgProgress(0); setBgPhase(''); setBgDetail('') }, 700)
    }
  }

  /* ── Submit ──────────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (compressing) return

    /* Validar todos los campos requeridos (excepto hijos) */
    const errs: Record<string, string> = {}
    if (!form.cedula.trim())           errs.cedula           = 'La cédula es requerida'
    if (!form.nombre.trim())           errs.nombre           = 'El nombre es requerido'
    if (!form.apellido.trim())         errs.apellido         = 'El apellido es requerido'
    if (!form.telefono.trim())         errs.telefono         = 'El teléfono es requerido'
    if (!form.grupo.trim())            errs.grupo            = 'El grupo asignado es requerido'
    if (!form.direccion.trim())        errs.direccion        = 'La dirección es requerida'
    if (!form.estudios)                errs.estudios         = 'Selecciona el nivel de estudios'
    if (!form.profesion.trim())        errs.profesion        = 'La profesión es requerida'
    if (!form.estado_civil)            errs.estado_civil     = 'Selecciona el estado civil'
    if (!form.horario_servicio.trim()) errs.horario_servicio = 'El horario de servicio es requerido'
    if (!form.grupo_servicio.trim())   errs.grupo_servicio   = 'El grupo de servicio es requerido'

    /* Verificación de cédula — solo bloquea si está en proceso de consulta */
    const cedulaCambio = isEdit && form.cedula.trim() !== originalCedula
    if ((!isEdit || cedulaCambio) && form.cedula.trim()) {
      if (cedulaStatus === 'checking') errs.cedula = 'Espera, verificando cédula...'
      // not_found e inactive: se permite crear — solo es informativo
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      /* Hacer scroll al primer error visible */
      setTimeout(() => {
        const firstErr = document.querySelector('[data-field-error]')
        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }

    setFieldErrors({}); setServerError(''); setSaving(true)
    try {
      let foto_url: string | null = maestro?.foto_url ?? null
      if (foto) {
        const fd = new FormData(); fd.append('file', foto); fd.append('folder', 'maestros')
        const up = await fetch('/api/kids/upload', { method: 'POST', body: fd }), uj = await up.json()
        if (!up.ok) throw new Error(uj.error ?? 'Error al subir foto.')
        foto_url = uj.url
      }
      const body = {
        cedula: form.cedula.trim(), nombre: form.nombre.trim(), apellido: form.apellido.trim(),
        telefono: form.telefono.trim() || null, foto_url,
        grupo: form.grupo.trim(), puede_dirigir: form.puede_dirigir,
        direccion: form.direccion.trim() || null, estudios: form.estudios || null,
        profesion: form.profesion.trim() || null, estado_civil: form.estado_civil || null,
        hijos: parseInt(form.hijos) || 0, sirve_entre_semana: form.sirve_entre_semana,
        horario_servicio: form.horario_servicio.trim() || null,
        grupo_servicio: form.grupo_servicio.trim() || null, activo: form.activo,
      }
      const url = isEdit ? `/api/kids/maestros/${maestro!.id}` : '/api/kids/maestros'
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar.')
      await onSave()
    } catch (e: any) { setServerError(e.message); setSaving(false) }
  }

  /* ── Layout ── */
  const overlayStyle: React.CSSProperties = {
    position:'fixed', inset:0, zIndex:40,
    background: visible ? 'rgba(0,0,0,.50)' : 'rgba(0,0,0,0)',
    backdropFilter: visible ? 'blur(3px)' : 'none',
    transition:'background .22s, backdrop-filter .22s',
    display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center',
    padding: isMobile ? 0 : '16px',
  }
  const dialogStyle: React.CSSProperties = isMobile ? {
    width:'100%', maxHeight:'96dvh', background:'#fff',
    borderRadius:'24px 24px 0 0', boxShadow:'0 -24px 72px rgba(0,0,0,.2)',
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    transition:'transform .25s cubic-bezier(.4,0,.2,1)',
    display:'flex', flexDirection:'column', overflowY:'auto',
  } : {
    width:'100%', maxWidth:880, maxHeight:'calc(100dvh - 32px)',
    background:'#fff', borderRadius:24,
    boxShadow:'0 32px 80px rgba(0,0,0,.22)',
    transform: visible ? 'scale(1) translateY(0)' : 'scale(.97) translateY(12px)',
    opacity: visible ? 1 : 0,
    transition:'transform .22s cubic-bezier(.4,0,.2,1), opacity .22s',
    display:'flex', flexDirection:'column', overflow:'hidden',
  }

  const liveNombre  = `${form.nombre} ${form.apellido}`.trim()
  const GRAD_M      = 'linear-gradient(145deg,#134e4a 0%,#0d9488 50%,#0891b2 100%)'
  const hasErrors   = Object.keys(fieldErrors).length > 0

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes fadeInDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes maestroIn{from{opacity:0;transform:scale(.97) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .m-row-input{border:none;outline:none;background:transparent;font-size:13px;color:#111827;width:100%;font-family:inherit;}
        .m-row-input::placeholder{color:#c4c9d4;}
        .m-row:focus-within{background:rgba(13,148,136,.03)!important;}
        .m-row:focus-within .m-row-label{color:#0d9488!important;}
      `}</style>

      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
        <div style={{ ...dialogStyle, animation:'maestroIn .28s cubic-bezier(.34,1.2,.64,1) both' }}>

          {isMobile && (
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 6px', flexShrink:0 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,.35)' }} />
            </div>
          )}

          {/* ══ HEADER ══ */}
          <div style={{
            background: GRAD_M,
            padding: isMobile ? '20px 20px 18px' : '24px 28px 20px',
            display:'flex', alignItems:'center', gap:18,
            position:'relative', flexShrink:0,
            borderBottom:'1px solid rgba(255,255,255,.12)',
          }}>
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

            {/* Avatar */}
            <div
              onClick={() => !compressing && !removingBg && fileRef.current?.click()}
              style={{
                position:'relative', width:76, height:76, borderRadius:'50%', flexShrink:0,
                border:'3px solid rgba(255,255,255,.85)',
                boxShadow:'0 0 0 3px rgba(251,191,36,.55), 0 6px 22px rgba(0,0,0,.3)',
                overflow:'hidden', cursor:'pointer',
                background: fotoPreview ? 'transparent' : 'linear-gradient(135deg,#0d9488,#0891b2)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
              {fotoPreview
                ? <img src={fotoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.currentTarget.style.display='none' }} />
                : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
              <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,.45)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity .18s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity='1')}
                onMouseLeave={e => (e.currentTarget.style.opacity='0')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFotoChange} />

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.55)', letterSpacing:'2.5px', textTransform:'uppercase', marginBottom:4 }}>
                {isEdit ? 'Editando perfil' : 'Nuevo registro'}
              </div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight:800, color:'#fff', letterSpacing:'-.4px', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {liveNombre || 'Maestro Kids'}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:7, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.85)', background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.28)', padding:'2px 9px', borderRadius:50 }}>
                  Maestro/a
                </span>
                {form.grupo && (
                  <span style={{ fontSize:9, fontWeight:700, color:'#ccfbf1', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', padding:'2px 9px', borderRadius:50 }}>
                    {form.grupo}
                  </span>
                )}
                {form.horario_servicio && (
                  <span style={{ fontSize:9, fontWeight:700, color:'#ccfbf1', background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', padding:'2px 9px', borderRadius:50 }}>
                    {form.horario_servicio}
                  </span>
                )}
              </div>
            </div>

            {(fotoPreview || removingBg) && !compressing && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                {fotoPreview && !removingBg && (
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

          {/* ══ BODY ══ */}
          <div style={{ flex:1, overflowY:'auto', background:'#f0f2f8', padding: isMobile ? '14px 14px 20px' : '18px 22px 24px' }}>
            <form onSubmit={handleSubmit} id="maestro-form">

              {/* ── IDENTIDAD ── */}
              <MGroupLabel label="Identidad" icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>}/>
              <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)' }}>
                {[
                  { key:'cedula',   label:'Cédula *',   ph:'Ej: 12345678',   val: form.cedula,   special:'cedula' },
                  { key:'nombre',   label:'Nombre *',   ph:'Nombre',         val: form.nombre,   special:'' },
                  { key:'apellido', label:'Apellido *', ph:'Apellido',       val: form.apellido, special:'' },
                  { key:'telefono', label:'Teléfono *', ph:'300 123 4567',   val: form.telefono, special:'' },
                ].map((f, i, arr) => (
                  <div key={f.key} className="m-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i < arr.length-1 ? '1px solid #f1f5f9' : 'none', transition:'background .15s' }}>
                    <MRowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                      {f.key==='cedula'   && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h1M6 14h1M9 10h1M9 14h1"/></svg>}
                      {f.key==='nombre'   && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                      {f.key==='apellido' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                      {f.key==='telefono' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                    </MRowIcon>
                    <span className="m-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:74, flexShrink:0, transition:'color .15s' }}>{f.label}</span>
                    <div style={{ flex:1 }}>
                      <input className="m-row-input" value={f.val}
                        onChange={e => {
                          if (f.key === 'cedula') { handleCedulaChange(e.target.value) }
                          else { setForm(prev => ({ ...prev, [f.key]: e.target.value })); if (e.target.value.trim()) clearFieldError(f.key) }
                        }}
                        placeholder={f.ph}
                        style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors[f.key] ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }}
                      />
                      {f.key === 'cedula' && cedulaStatus !== 'idle' && !fieldErrors.cedula && (
                        <div style={{ fontSize:9, fontWeight:600, marginTop:2, animation:'fadeInDown .18s ease',
                          color: cedulaStatus==='found' ? '#0d9488' : cedulaStatus==='checking' ? '#9ca3af' : '#d97706' }}>
                          {cedulaStatus==='checking' && '🔍 Verificando…'}
                          {cedulaStatus==='found'    && `✅ ${cedulaNombre}`}
                          {cedulaStatus==='not_found'&& '⚠️ No está en el sistema — puedes continuar'}
                          {cedulaStatus==='inactive' && `⚠️ Inactivo: ${cedulaNombre}`}
                        </div>
                      )}
                      {fieldErrors[f.key] && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors[f.key]}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── PERSONAL ── */}
              <MGroupLabel label="Datos personales" icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}/>
              <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)' }}>
                {/* Dirección */}
                <div className="m-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                  <MRowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </MRowIcon>
                  <span className="m-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:74, flexShrink:0, transition:'color .15s' }}>Dirección *</span>
                  <div style={{ flex:1 }}>
                    <input className="m-row-input" value={form.direccion} onChange={e => { setForm(f => ({ ...f, direccion: e.target.value })); if (e.target.value.trim()) clearFieldError('direccion') }} placeholder="Barrio, ciudad..." style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.direccion ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {fieldErrors.direccion && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.direccion}</div>}
                  </div>
                </div>
                {/* Profesión */}
                <div className="m-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                  <MRowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  </MRowIcon>
                  <span className="m-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:74, flexShrink:0, transition:'color .15s' }}>Profesión *</span>
                  <div style={{ flex:1 }}>
                    <input className="m-row-input" value={form.profesion} onChange={e => { setForm(f => ({ ...f, profesion: e.target.value })); if (e.target.value.trim()) clearFieldError('profesion') }} placeholder="Ej: Ingeniero" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color: fieldErrors.profesion ? '#ef4444' : '#111827', width:'100%', fontFamily:'inherit' }} />
                    {fieldErrors.profesion && <div style={{ fontSize:9, color:'#ef4444', marginTop:2 }}>{fieldErrors.profesion}</div>}
                  </div>
                </div>
                {/* Hijos */}
                <div className="m-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', transition:'background .15s' }}>
                  <MRowIcon color="#0d9488" bg="rgba(13,148,136,.1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </MRowIcon>
                  <span className="m-row-label" style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:74, flexShrink:0, transition:'color .15s' }}>Hijos</span>
                  <div style={{ display:'flex', alignItems:'center', gap:0, background:'#f8fafc', borderRadius:10, overflow:'hidden', height:32, border:'1px solid #e5e7eb' }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, hijos: String(Math.max(0, parseInt(f.hijos||'0')-1)) }))} style={{ width:30, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                    <span style={{ fontSize:13, fontWeight:700, color:'#111827', minWidth:28, textAlign:'center' }}>{form.hijos||'0'}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, hijos: String(parseInt(f.hijos||'0')+1) }))} style={{ width:30, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                </div>
              </div>

              {/* Estudios — pills */}
              <MGroupLabel label="Nivel de estudios" icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><path d="M20 10v4a8 8 0 0 1-16 0v-4"/></svg>}/>
              <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${fieldErrors.estudios ? 'rgba(239,68,68,.3)' : 'rgba(0,0,0,.05)'}` }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {OPT_ESTUDIOS.map(o => (
                    <button key={o} type="button" onClick={() => { setForm(f => ({ ...f, estudios: o })); clearFieldError('estudios') }}
                      style={{ padding:'6px 14px', borderRadius:50, cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .18s cubic-bezier(.34,1.56,.64,1)',
                        border: form.estudios===o ? 'none' : '1.5px solid #e2e8f0',
                        background: form.estudios===o ? GRAD_M : '#f8fafc',
                        color: form.estudios===o ? '#fff' : '#64748b',
                        boxShadow: form.estudios===o ? '0 4px 12px rgba(13,148,136,.38)' : 'none',
                        transform: form.estudios===o ? 'scale(1.04)' : 'scale(1)',
                      }}>{o}</button>
                  ))}
                </div>
                {fieldErrors.estudios && <div style={{ fontSize:10, color:'#ef4444', marginTop:8 }}>{fieldErrors.estudios}</div>}
              </div>

              {/* Estado civil — pills */}
              <MGroupLabel label="Estado civil" icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>}/>
              <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${fieldErrors.estado_civil ? 'rgba(239,68,68,.3)' : 'rgba(0,0,0,.05)'}` }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {OPT_ESTADO_CIVIL.map(o => (
                    <button key={o} type="button" onClick={() => { setForm(f => ({ ...f, estado_civil: o })); clearFieldError('estado_civil') }}
                      style={{ padding:'6px 14px', borderRadius:50, cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .18s cubic-bezier(.34,1.56,.64,1)',
                        border: form.estado_civil===o ? 'none' : '1.5px solid #e2e8f0',
                        background: form.estado_civil===o ? GRAD_M : '#f8fafc',
                        color: form.estado_civil===o ? '#fff' : '#64748b',
                        boxShadow: form.estado_civil===o ? '0 4px 12px rgba(13,148,136,.38)' : 'none',
                        transform: form.estado_civil===o ? 'scale(1.04)' : 'scale(1)',
                      }}>{o}</button>
                  ))}
                </div>
                {fieldErrors.estado_civil && <div style={{ fontSize:10, color:'#ef4444', marginTop:8 }}>{fieldErrors.estado_civil}</div>}
              </div>

              {/* ── SERVICIO ── */}
              <MGroupLabel label="Servicio" icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><path d="M20 10v4a8 8 0 0 1-16 0v-4"/></svg>}/>

              {/* Grupo asignado */}
              <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${fieldErrors.grupo ? 'rgba(239,68,68,.3)' : 'rgba(0,0,0,.05)'}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Grupo asignado *</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {OPT_GRUPO.map(o => (
                    <button key={o} type="button" onClick={() => { setForm(f => ({ ...f, grupo: o })); clearFieldError('grupo') }}
                      style={{ padding:'6px 14px', borderRadius:50, cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .18s cubic-bezier(.34,1.56,.64,1)',
                        border: form.grupo===o ? 'none' : '1.5px solid #e2e8f0',
                        background: form.grupo===o ? GRAD_M : '#f8fafc',
                        color: form.grupo===o ? '#fff' : '#64748b',
                        boxShadow: form.grupo===o ? '0 4px 12px rgba(13,148,136,.38)' : 'none',
                        transform: form.grupo===o ? 'scale(1.04)' : 'scale(1)',
                      }}>{o}</button>
                  ))}
                </div>
                {fieldErrors.grupo && <div style={{ fontSize:10, color:'#ef4444', marginTop:8 }}>{fieldErrors.grupo}</div>}
              </div>

              {/* Horario */}
              <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${fieldErrors.horario_servicio ? 'rgba(239,68,68,.3)' : 'rgba(0,0,0,.05)'}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Horario de servicio *</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {OPT_HORARIO.map(o => (
                    <button key={o} type="button" onClick={() => { setForm(f => ({ ...f, horario_servicio: o })); clearFieldError('horario_servicio') }}
                      style={{ padding:'6px 14px', borderRadius:50, cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .18s cubic-bezier(.34,1.56,.64,1)',
                        border: form.horario_servicio===o ? 'none' : '1.5px solid #e2e8f0',
                        background: form.horario_servicio===o ? GRAD_M : '#f8fafc',
                        color: form.horario_servicio===o ? '#fff' : '#64748b',
                        boxShadow: form.horario_servicio===o ? '0 4px 12px rgba(13,148,136,.38)' : 'none',
                        transform: form.horario_servicio===o ? 'scale(1.04)' : 'scale(1)',
                      }}>{o}</button>
                  ))}
                </div>
                {fieldErrors.horario_servicio && <div style={{ fontSize:10, color:'#ef4444', marginTop:8 }}>{fieldErrors.horario_servicio}</div>}
              </div>

              {/* Grupo de servicio */}
              <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${fieldErrors.grupo_servicio ? 'rgba(239,68,68,.3)' : 'rgba(0,0,0,.05)'}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Grupo de servicio *</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {OPT_GRUPO_SERVICIO.map(o => (
                    <button key={o} type="button" onClick={() => { setForm(f => ({ ...f, grupo_servicio: o })); clearFieldError('grupo_servicio') }}
                      style={{ padding:'6px 14px', borderRadius:50, cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .18s cubic-bezier(.34,1.56,.64,1)',
                        border: form.grupo_servicio===o ? 'none' : '1.5px solid #e2e8f0',
                        background: form.grupo_servicio===o ? GRAD_M : '#f8fafc',
                        color: form.grupo_servicio===o ? '#fff' : '#64748b',
                        boxShadow: form.grupo_servicio===o ? '0 4px 12px rgba(13,148,136,.38)' : 'none',
                        transform: form.grupo_servicio===o ? 'scale(1.04)' : 'scale(1)',
                      }}>{o}</button>
                  ))}
                </div>
                {fieldErrors.grupo_servicio && <div style={{ fontSize:10, color:'#ef4444', marginTop:8 }}>{fieldErrors.grupo_servicio}</div>}
              </div>

              {/* Toggles */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:8, marginBottom:12 }}>
                {/* Sirve entre semana */}
                <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Entre semana</div>
                  <div style={{ display:'flex', gap:7 }}>
                    {([true, false] as const).map(val => (
                      <button key={String(val)} type="button" onClick={() => setForm(f => ({ ...f, sirve_entre_semana: val }))}
                        style={{ flex:1, padding:'8px', borderRadius:10, fontSize:12, fontWeight:600, border:'1.5px solid', cursor:'pointer', transition:'all .15s',
                          background: form.sirve_entre_semana===val ? (val ? GRAD_M : '#64748b') : '#f8fafc',
                          color: form.sirve_entre_semana===val ? '#fff' : '#94a3b8',
                          borderColor: form.sirve_entre_semana===val ? 'transparent' : '#e2e8f0',
                          boxShadow: form.sirve_entre_semana===val ? '0 3px 10px rgba(13,148,136,.3)' : 'none',
                        }}>
                        {val ? '✓ Sí' : '✗ No'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Puede dirigir */}
                <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>¿Puede dirigir?</div>
                  <div style={{ display:'flex', gap:7 }}>
                    {([true, false] as const).map(val => (
                      <button key={String(val)} type="button" onClick={() => setForm(f => ({ ...f, puede_dirigir: val }))}
                        style={{ flex:1, padding:'8px', borderRadius:10, fontSize:12, fontWeight:600, border:'1.5px solid', cursor:'pointer', transition:'all .15s',
                          background: form.puede_dirigir===val ? (val ? GRAD_M : '#64748b') : '#f8fafc',
                          color: form.puede_dirigir===val ? '#fff' : '#94a3b8',
                          borderColor: form.puede_dirigir===val ? 'transparent' : '#e2e8f0',
                          boxShadow: form.puede_dirigir===val ? '0 3px 10px rgba(13,148,136,.3)' : 'none',
                        }}>
                        {val ? '✓ Sí' : 'Solo apoya'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estado (solo edición) */}
              {isEdit && (
                <>
                  <MGroupLabel label="Estado" icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}/>
                  <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.05)', display:'flex', gap:8 }}>
                    {([true, false] as const).map(val => (
                      <button key={String(val)} type="button" onClick={() => setForm(f => ({ ...f, activo: val }))}
                        style={{ flex:1, padding:'9px', borderRadius:10, fontSize:12, fontWeight:600, border:'1.5px solid', cursor:'pointer', transition:'all .15s',
                          background:  form.activo===val ? (val ? '#0d9488' : '#f43f5e') : '#fff',
                          color:       form.activo===val ? '#fff' : '#9ca3af',
                          borderColor: form.activo===val ? (val ? '#0d9488' : '#f43f5e') : '#e5e7eb',
                          boxShadow:   form.activo===val ? (val ? '0 4px 12px rgba(13,148,136,.3)' : '0 4px 12px rgba(244,63,94,.3)') : 'none',
                        }}>
                        {val ? '✓ Activo' : '○ Inactivo'}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Errores */}
              {hasErrors && (
                <div style={{ padding:'10px 14px', borderRadius:12, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', marginBottom:8, display:'flex', alignItems:'center', gap:8, animation:'fadeInDown .18s ease' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>
                    {Object.values(fieldErrors).filter(Boolean).slice(0,3).join(' · ')}
                    {Object.keys(fieldErrors).length > 3 ? ` · +${Object.keys(fieldErrors).length - 3} más` : ''}
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

          {/* ══ FOOTER ══ */}
          <div style={{ display:'flex', gap:10, padding: isMobile ? '12px 16px 20px' : '14px 22px', borderTop:'1px solid #f1f5f9', flexShrink:0, background:'#fff' }}>
            <button type="button" onClick={handleClose} style={{
              flex:1, padding:'13px', borderRadius:50, border:'1.5px solid #e2e8f0', background:'#f8fafc',
              fontSize:13, fontWeight:600, color:'#64748b', cursor:'pointer',
            }}>Cancelar</button>
            <button type="submit" form="maestro-form" disabled={saving} style={{
              flex:3, padding:'13px', borderRadius:50, border:'none',
              background: saving ? 'rgba(13,148,136,.4)' : GRAD_M,
              color:'#fff', fontSize:13, fontWeight:700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 6px 22px rgba(13,148,136,.42)',
              transition:'all .2s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              {saving
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-9-9"/></svg>Guardando…</>
                : isEdit ? '✓ Guardar cambios' : '✦ Crear maestro'
              }
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

/* ── MGroupLabel ─────────────────────────────────────────────────────────── */
function MGroupLabel({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, paddingLeft:2 }}>
      <span style={{ color:'#94a3b8', display:'flex', alignItems:'center' }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1.5px' }}>{label}</span>
    </div>
  )
}

/* ── MRowIcon ────────────────────────────────────────────────────────────── */
function MRowIcon({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
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
  textTransform:'uppercase', letterSpacing:'1px',
  display:'block', marginBottom:6,
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'10px 13px', borderRadius:11,
  border:'1.5px solid #e5e7eb', fontSize:13, color:'#111827',
  background:'#fff', outline:'none', boxSizing:'border-box', transition:'border .15s',
}

function SectionLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
      <div style={{ width:3, height:13, borderRadius:2, background:accent, flexShrink:0 }} />
      <span style={{ fontSize:10, fontWeight:700, color:accent, textTransform:'uppercase', letterSpacing:'2px' }}>{label}</span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder='', required=true, disabled=false, error }:
  { label:string; value:string; onChange:(v:string)=>void; placeholder?:string; required?:boolean; disabled?:boolean; error?:string }) {
  const hasError = !!error
  return (
    <div data-field-error={hasError ? 'true' : undefined}>
      <label style={{ ...labelStyle, color: hasError ? '#dc2626' : '#6b7280' }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{
          ...inputStyle,
          background:   disabled ? '#f9fafb' : '#fff',
          opacity:      disabled ? .65 : 1,
          borderColor:  hasError ? '#fca5a5' : '#e5e7eb',
          boxShadow:    hasError ? '0 0 0 3px rgba(239,68,68,.08)' : 'none',
        }}
        onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#7c3aed' }}
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
            if (allowCustom && e.target.value==='__custom__') { setCustom(true); onChange('') }
            else onChange(e.target.value)
          }} style={{
            ...inputStyle, appearance:'none', paddingRight:28, cursor:'pointer',
            borderColor: hasError ? '#fca5a5' : '#e5e7eb',
            boxShadow:   hasError ? '0 0 0 3px rgba(239,68,68,.08)' : 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#7c3aed' }}
          onBlur={e  => { e.currentTarget.style.borderColor = hasError ? '#fca5a5' : '#e5e7eb' }}
          >
            <option value="">— Seleccionar —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
            {allowCustom && <option value="__custom__">✏️ Otro...</option>}
          </select>
          <svg style={{ position:'absolute', right:10, top: hasError ? 'calc(50% - 2px)' : '50%', transform:'translateY(-50%)', pointerEvents:'none' }}
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      ) : (
        <div style={{ display:'flex', gap:6 }}>
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder="Escribir..." autoFocus
            style={{
              ...inputStyle, flex:1,
              borderColor: hasError ? '#fca5a5' : '#e5e7eb',
              boxShadow:   hasError ? '0 0 0 3px rgba(239,68,68,.08)' : 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#7c3aed' }}
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
