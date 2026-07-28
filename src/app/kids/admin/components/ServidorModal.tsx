'use client'

import { useState, useRef, useEffect } from 'react'
import CropModal from './CropModal'

/* ── Types ───────────────────────────────────────────────────────────────── */
export interface KidsServidor {
  id:                  string
  cedula:              string
  nombre:              string
  apellido:            string
  telefono:            string | null
  foto_url:            string | null
  roles:               string[]
  direccion:           string | null
  edad:                number | null
  estudios:            string | null
  profesion:           string | null
  estado_civil:        string | null
  hijos:               string | null
  grupo_asignado:      string | null
  grupo?:              string | null
  grupo_timoteos_asignado: string | null
  puede_dirigir:       boolean
  sirve_entre_semana:  boolean
  horario_servicio:    string | null
  grupo_servicio:      string | null
  cumpleanos?:         string | null
  disponibilidad_domingo_7?:  boolean
  disponibilidad_domingo_9?:  boolean
  disponibilidad_domingo_11?: boolean
  activo:              boolean
  creado_en:           string
}

interface Props {
  servidor: KidsServidor | null
  onClose: () => void
  onSave?:  () => Promise<void>
  onSaved?: () => Promise<void>
  launchOrigin?: {
    dx: number
    dy: number
    scaleX?: number
    scaleY?: number
  } | null
}

/* ── Opciones ────────────────────────────────────────────────────────────── */
const OPT_ROLES = [
  'ADMINISTRADOR',
  'COORDINADOR DE CLASE',
  'COORDINADOR DE ALBORADA',
  'COORDINADOR DE VISITACION',
  'COORDINADOR DE FONDOS Y EVENTOS',
  'COORDINADOR DE TIMOTEOS',
  'COORDINADOR DE MAESTRA AUXILIAR',
  'MAESTRO',
  'MAESTRO AUXILIAR',
  'INTERSESORES',
  'TIMOTEOS'
]

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'ADMINISTRADOR':                    'Administrador',
  'COORDINADOR DE CLASE':            'Coordinador de Clase',
  'COORDINADOR DE ALBORADA':         'Coordinador de Alborada',
  'COORDINADOR DE VISITACION':        'Coordinador de Visitación',
  'COORDINADOR DE FONDOS Y EVENTOS':  'Coordinador de Fondos y Eventos',
  'COORDINADOR DE TIMOTEOS':         'Coordinador de Timoteos',
  'COORDINADOR DE MAESTRA AUXILIAR':  'Coordinador de Maestra Aux.',
  'MAESTRO':                         'Maestro',
  'MAESTRO AUXILIAR':                'Maestro Auxiliar',
  'INTERSESORES':                    'Intercesores',
  'TIMOTEOS':                        'Timoteos'
}

const OPT_ESTUDIOS       = ['Primaria','Bachiller','Técnico/a','Tecnólogo/a','Universitario/a','Postgrado']
const OPT_ESTADO_CIVIL   = ['Soltero/a','Casado/a','Unión libre','Divorciado/a','Viudo/a']
const OPT_HORARIO        = ['Domingo 7:00am','Domingo 9:00am','Domingo 11:00am','Miércoles 7:00pm','Viernes 7:00pm']
const OPT_GRUPO_SERVICIO = ['Semillitas','Exploradores','Junior']
const OPT_GRUPO          = ['Grupo 1','Grupo 2','Grupo 3','Grupo 4','Grupo 5','Grupo 6']

/* ══════════════════════════════════════════════════════════════════════════ */
export default function ServidorModal({ servidor, onClose, onSave, onSaved, launchOrigin }: Props) {
  const isEdit  = !!servidor
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    cedula:                  servidor?.cedula                  ?? '',
    nombre:                  servidor?.nombre                  ?? '',
    apellido:                servidor?.apellido                ?? '',
    telefono:                servidor?.telefono                ?? '',
    roles:                   servidor?.roles                   ?? [],
    direccion:               servidor?.direccion               ?? '',
    edad:                    servidor?.edad?.toString()        ?? '',
    estudios:                servidor?.estudios                ?? '',
    profesion:               servidor?.profesion               ?? '',
    estado_civil:            servidor?.estado_civil            ?? '',
    hijos:                   servidor?.hijos                   ?? '',
    grupo_asignado:          servidor?.grupo_asignado          ?? '',
    grupo_timoteos_asignado: servidor?.grupo_timoteos_asignado ?? '',
    puede_dirigir:           servidor?.puede_dirigir           ?? false,
    sirve_entre_semana:      servidor?.sirve_entre_semana      ?? false,
    horario_servicio:        servidor?.horario_servicio        ?? '',
    grupo_servicio:          servidor?.grupo_servicio          ?? '',
    cumpleanos:               servidor?.cumpleanos              ?? '',
    disponibilidad_domingo_7:  servidor?.disponibilidad_domingo_7  ?? false,
    disponibilidad_domingo_9:  servidor?.disponibilidad_domingo_9  ?? false,
    disponibilidad_domingo_11: servidor?.disponibilidad_domingo_11 ?? false,
    activo:                  servidor?.activo                  ?? true,
  })

  const [foto,        setFoto]        = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>(servidor?.foto_url ?? '')
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
  const originalCedula = servidor?.cedula ?? ''
  type CedulaStatus = 'idle' | 'checking' | 'found' | 'not_found' | 'inactive'
  const [cedulaStatus, setCedulaStatus] = useState<CedulaStatus>('idle')
  const [cedulaNombre, setCedulaNombre] = useState('')
  const checkTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rolesOpen,         setRolesOpen]         = useState(false)
  const [coordSubmenuOpen,  setCoordSubmenuOpen]  = useState(false)
  const rolesDropdownRef                          = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(e.target as Node)) {
        setRolesOpen(false)
        setCoordSubmenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => {
    const openTimer = window.setTimeout(() => setVisible(true), 10)
    return () => window.clearTimeout(openTimer)
  }, [launchOrigin?.dx, launchOrigin?.dy, isEdit])

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

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, launchOrigin ? 620 : 260)
  }

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

  /* ── Submit ──────────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (compressing) return

    /* Validar todos los campos requeridos básicos */
    const errs: Record<string, string> = {}
    const isTimoteoProfile = form.roles.includes('TIMOTEOS')
    if (!isTimoteoProfile && !form.cedula.trim()) errs.cedula = 'La cédula es requerida'
    if (!form.nombre.trim())           errs.nombre           = 'El nombre es requerido'
    if (!form.apellido.trim())         errs.apellido         = 'El apellido es requerido'
    if (form.roles.length === 0)       errs.roles            = 'Debe seleccionar al menos un rol'

    if (isTimoteoProfile) {
      if (!form.telefono.trim()) errs.telefono = 'El celular es requerido'
      if (!form.cumpleanos.trim()) {
        errs.cumpleanos = 'El cumpleaños es requerido'
      } else if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(form.cumpleanos.trim())) {
        errs.cumpleanos = 'Usa el formato MM-DD'
      }
    }
    
    // Validación de campos condicionales
    const isMaestro = form.roles.includes('MAESTRO') || form.roles.includes('MAESTRO AUXILIAR')
    const isCoordinador = form.roles.some(r => r.startsWith('COORDINADOR'))
    const isCualquierRolKids = isMaestro || isCoordinador || form.roles.includes('TIMOTEOS') || form.roles.includes('INTERSESORES')
    
    if (isCualquierRolKids && !isTimoteoProfile) {
      if (!form.telefono.trim()) errs.telefono = 'El teléfono es requerido'
      if (!form.direccion.trim()) errs.direccion = 'La dirección es requerida'
    }

    if (form.roles.includes('COORDINADOR DE ALBORADA')) {
      if (!form.grupo_asignado.trim()) errs.grupo_asignado = 'El grupo de alborada es requerido'
    }

    if (form.roles.includes('COORDINADOR DE TIMOTEOS')) {
      if (!form.grupo_timoteos_asignado.trim()) errs.grupo_timoteos_asignado = 'El grupo de timoteos es requerido'
    }

    const isAdulto = !form.edad || parseInt(form.edad) >= 20
    if (!isTimoteoProfile && !form.estudios) errs.estudios = 'Selecciona el nivel de estudios'
    if (!isTimoteoProfile && !form.profesion.trim()) errs.profesion = 'La profesión es requerida'
    
    if (!isTimoteoProfile && isAdulto) {
      if (!form.estado_civil) errs.estado_civil = 'Selecciona el estado civil'
    }

    const cedulaCambio = isEdit && form.cedula.trim() !== originalCedula
    if ((!isEdit || cedulaCambio) && form.cedula.trim()) {
      if (cedulaStatus === 'checking') errs.cedula = 'Espera, verificando cédula...'
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setTimeout(() => {
        const firstErr = document.querySelector('[data-field-error]')
        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }

    setFieldErrors({}); setServerError(''); setSaving(true)
    try {
      let foto_url: string | null = servidor?.foto_url ?? null
      if (foto) {
        const fd = new FormData(); fd.append('file', foto); fd.append('folder', 'servidores')
        const up = await fetch('/api/kids/upload', { method: 'POST', body: fd }), uj = await up.json()
        if (!up.ok) throw new Error(uj.error ?? 'Error al subir foto.')
        foto_url = uj.url
      }
      const body = {
        cedula: form.cedula.trim(), nombre: form.nombre.trim(), apellido: form.apellido.trim(),
        telefono: form.telefono.trim() || null, foto_url, roles: form.roles,
        grupo_asignado: form.grupo_asignado.trim() || null,
        grupo_timoteos_asignado: form.grupo_timoteos_asignado.trim() || null,
        puede_dirigir: form.puede_dirigir,
        direccion: form.direccion.trim() || null, estudios: form.estudios || null,
        profesion: form.profesion.trim() || null, estado_civil: form.estado_civil || null,
        edad: parseInt(form.edad) || null,
        hijos: form.hijos?.trim() || null, sirve_entre_semana: form.sirve_entre_semana,
        horario_servicio: form.horario_servicio.trim() || null,
        grupo_servicio: form.grupo_servicio.trim() || null, activo: form.activo,
        cumpleanos: form.cumpleanos.trim() || null,
        disponibilidad_domingo_7: form.disponibilidad_domingo_7,
        disponibilidad_domingo_9: form.disponibilidad_domingo_9,
        disponibilidad_domingo_11: form.disponibilidad_domingo_11,
      }
      const url = isEdit ? `/api/kids/servidores/${servidor!.id}` : '/api/kids/servidores'
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar.')
      const fn = onSave || onSaved; if (fn) await fn()
    } catch (e: any) { setServerError(e.message); setSaving(false) }
  }

  const toggleRole = (rol: string) => {
    if (rol === 'TIMOTEOS') setRolesOpen(false)
    setForm(prev => {
      const roles = rol === 'TIMOTEOS'
        ? (prev.roles.includes('TIMOTEOS') ? [] : ['TIMOTEOS'])
        : prev.roles.includes(rol)
          ? prev.roles.filter(r => r !== rol)
          : [...prev.roles.filter(r => r !== 'TIMOTEOS'), rol]
      clearFieldError('roles')
      return { ...prev, roles }
    })
  }
  const isTimoteoProfile = form.roles.includes('TIMOTEOS')
  const overlayStyle: React.CSSProperties = {
    position:'fixed', inset:0, zIndex:9999,
    background: visible ? 'rgba(0,0,0,.50)' : 'rgba(0,0,0,0)',
    backdropFilter: visible ? 'blur(3px)' : 'none',
    transition:'background .22s, backdrop-filter .22s',
    display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center',
    padding: isMobile ? 0 : '12px',
  }
  const launchTransform = launchOrigin
    ? `translate3d(${launchOrigin.dx}px, ${launchOrigin.dy}px, 0) scale(${launchOrigin.scaleX ?? .1}, ${launchOrigin.scaleY ?? .1}) rotateY(-58deg)`
    : isMobile
      ? 'translateY(100%)'
      : 'scale(.97) translateY(12px)'

  const settledTransform = isMobile
    ? 'translateY(0)'
    : 'scale(1) translateY(0)'

  const dialogStyle: React.CSSProperties = isMobile ? {
    width:'100%', minHeight: isTimoteoProfile ? 400 : 480, maxHeight:'96dvh', background:'#fff',
    borderRadius:'16px 16px 0 0', boxShadow:'0 -16px 48px rgba(0,0,0,.18)',
    transform: visible ? settledTransform : launchTransform,
    transition:'transform .62s cubic-bezier(.2,.78,.2,1)',
    transformOrigin:'center center', transformStyle:'preserve-3d',
    willChange:'transform, opacity',
    display:'flex', flexDirection:'column', overflow:'hidden',
  } : {
    width:'100%', maxWidth:680,
    height: isTimoteoProfile ? 410 : 530,
    minHeight: isTimoteoProfile ? 410 : 530,
    maxHeight: '90vh',
    background:'#fff', borderRadius:14,
    boxShadow:'0 20px 50px rgba(0,0,0,.18)',
    transform: visible ? settledTransform : launchTransform,
    opacity: visible ? 1 : 0,
    transition:'transform .62s cubic-bezier(.2,.78,.2,1), opacity .3s ease',
    transformOrigin:'center center', transformStyle:'preserve-3d',
    willChange:'transform, opacity',
    display:'flex', flexDirection:'column', overflow:'hidden',
  }

  const liveNombre  = `${form.nombre} ${form.apellido}`.trim()
  const displayName = liveNombre || (isTimoteoProfile ? 'Ficha especializada' : 'Nuevo Servidor')

  // Dinámicas
  const isMaestro = form.roles.includes('MAESTRO') || form.roles.includes('MAESTRO AUXILIAR')
  const isCoordinador = form.roles.some(r => r.startsWith('COORDINADOR'))
  const isCualquierRolKids = isMaestro || isCoordinador || form.roles.includes('TIMOTEOS') || form.roles.includes('INTERSESORES')

  return (
    <>
      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget && !saving) handleClose() }}>
        <div style={dialogStyle} onClick={e => e.stopPropagation()}>
          
          {/* HEADER - Azul difuminado con blanco y negro suave ultra elegante */}
          <div style={{
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'sticky', top: 0, zIndex: 10,
            background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,58,138,0.85) 45%, rgba(2,132,199,0.75) 100%)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            borderBottom: '1px solid rgba(255,255,255,0.18)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 20px rgba(15,23,42,0.18)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
                border: '1px solid rgba(255,255,255,0.35)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff'
              }}>
                {isEdit 
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                }
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  {isTimoteoProfile
                    ? (isEdit ? 'Editar Timoteo' : 'Nuevo Timoteo')
                    : (isEdit ? 'Editar Servidor' : 'Nuevo Servidor')}
                </h3>
                <p style={{ margin: 0, fontSize: 9.5, color: 'rgba(224,242,254,0.85)', lineHeight: 1.1, fontWeight: 600 }}>{displayName}</p>
              </div>
            </div>
            <button
              onClick={handleClose} disabled={saving}
              style={{
                width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', cursor: 'pointer', transition: 'all 0.18s ease'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', boxSizing:'border-box' }}>
            <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:14, flex:1, overflowY:'auto', boxSizing:'border-box' }}>

              {/* FOTO Y ROLES EN UNA FILA HORIZONTAL */}
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                gap: 14,
              }}>
                {/* FOTO: el perfil TIMOTEOS utiliza exclusivamente los campos de su ficha */}
                {!isTimoteoProfile && (
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <div style={{ position:'relative' }}>
                    {fotoPreview ? (
                      <img src={fotoPreview} alt="Foto" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', boxShadow:'0 2px 6px rgba(0,0,0,0.08)', border:'1.5px solid #fff' }} />
                    ) : (
                      <div style={{ width:42, height:42, borderRadius:'50%', background:'#f8fafc', border:'1px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      </div>
                    )}
                    <button type="button" onClick={() => fileRef.current?.click()} style={{ position:'absolute', bottom:-2, right:-2, width:16, height:16, borderRadius:'50%', background:'#fff', border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#0f172a', cursor:'pointer' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </button>
                  </div>
                  <input type="file" ref={fileRef} accept="image/*" onChange={handleFotoChange} style={{ display:'none' }} />
                  <span style={{ fontSize:9.5, color:'#64748b', fontWeight:600 }}>Foto perfil</span>
                </div>
                )}

                {/* ROLES SELECT ITEM */}
                <div style={{ flex:1, minWidth:0, position: 'relative' }} ref={rolesDropdownRef}>
                  <MGroupLabel label="Roles Asignados" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
                  
                  {/* Select Item Trigger */}
                  <div
                    onClick={() => setRolesOpen(v => !v)}
                    style={{
                      marginTop: 4,
                      height: 28,
                      borderRadius: 30,
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      background: 'linear-gradient(145deg, rgba(255,255,255,.95), rgba(241,245,249,.85))',
                      border: rolesOpen ? '1px solid rgba(56,189,248,.65)' : '1px solid rgba(226,232,240,.9)',
                      boxShadow: rolesOpen
                        ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 3px 10px rgba(14,165,233,.15)'
                        : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.10), 0 2px 6px rgba(96,116,147,.08)',
                      backdropFilter: 'blur(17px) saturate(135%)',
                      WebkitBackdropFilter: 'blur(17px) saturate(135%)',
                      transition: 'all .20s cubic-bezier(0.25,0.46,0.45,0.94)',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#283449" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rolesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    
                    <span style={{ fontSize: 10, fontWeight: 700, color: form.roles.length > 0 ? '#1e293b' : '#94a3b8', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.2px' }}>
                      {form.roles.length === 0
                        ? 'Seleccionar roles...'
                        : form.roles.map(r => ROLE_DISPLAY_NAMES[r] || r).join(', ')}
                    </span>

                    {form.roles.length > 0 && (
                      <span style={{
                        fontSize: 8.5, fontWeight: 800,
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        color: '#fff', padding: '1px 6px', borderRadius: 30,
                        boxShadow: '0 1.5px 4px rgba(2,132,199,0.3)'
                      }}>
                        {form.roles.length}
                      </span>
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {rolesOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(241,245,249,.95))',
                      backdropFilter: 'blur(20px) saturate(140%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                      border: '1px solid rgba(255,255,255,.95)',
                      borderRadius: 14,
                      boxShadow: '0 12px 32px rgba(54,69,95,.20), inset 0 1px 0 #fff',
                      padding: 8,
                      zIndex: 50,
                      display: 'flex', flexDirection: 'column', gap: 6,
                      maxHeight: 220, overflowY: 'auto'
                    }}>
                      <style>{`
                        .role-btn-tab {
                          transition: all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                        }
                        .role-btn-tab:not(.active):hover {
                          transform: translateY(1.5px) scale(0.975) !important;
                          box-shadow: inset 0 2px 5px rgba(81,105,139,0.25), inset 0 1px 2px rgba(0,0,0,0.12) !important;
                          background: linear-gradient(145deg, rgba(225,232,240,.9), rgba(210,220,232,.75)) !important;
                          border-color: rgba(180,195,215,0.85) !important;
                        }
                      `}</style>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(() => {
                          const active = form.roles.includes('ADMINISTRADOR')
                          return (
                            <button
                              type="button" onClick={() => toggleRole('ADMINISTRADOR')}
                              className={`role-btn-tab ${active ? 'active' : ''}`}
                              style={{
                                padding: '4px 10px', borderRadius: 30, fontSize: 10, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
                                background: active
                                  ? 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(224,242,254,.85))'
                                  : 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))',
                                color: active ? '#0284c7' : '#334155',
                                border: active ? '1px solid rgba(56,189,248,.75)' : '1px solid rgba(255,255,255,.87)',
                                boxShadow: active
                                  ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 3px 10px rgba(14,165,233,.18)'
                                  : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.18), 0 2px 5px rgba(96,116,147,.08)',
                                letterSpacing: '-0.1px',
                              }}
                            >
                              {active ? '✓ ' : ''}Administrador
                            </button>
                          )
                        })()}

                        {(() => {
                          const activeCoordCount = form.roles.filter(r => r.startsWith('COORDINADOR')).length
                          const isHighlighted = activeCoordCount > 0 || coordSubmenuOpen
                          return (
                            <button
                              type="button"
                              onClick={() => setCoordSubmenuOpen(v => !v)}
                              className={`role-btn-tab ${isHighlighted ? 'active' : ''}`}
                              style={{
                                padding: '4px 10px', borderRadius: 30, fontSize: 10, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
                                background: isHighlighted
                                  ? 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(224,242,254,.85))'
                                  : 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))',
                                color: isHighlighted ? '#0284c7' : '#334155',
                                border: isHighlighted ? '1px solid rgba(56,189,248,.75)' : '1px solid rgba(255,255,255,.87)',
                                boxShadow: isHighlighted
                                  ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 3px 10px rgba(14,165,233,.18)'
                                  : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.18), 0 2px 5px rgba(96,116,147,.08)',
                                letterSpacing: '-0.1px',
                                display: 'inline-flex', alignItems: 'center', gap: 4
                              }}
                            >
                              <span>Coordinadores</span>
                              {activeCoordCount > 0 && (
                                <span style={{ fontSize: 8.5, fontWeight: 800, background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: 20 }}>
                                  {activeCoordCount}
                                </span>
                              )}
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: coordSubmenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                          )
                        })()}

                        {['MAESTRO', 'MAESTRO AUXILIAR', 'INTERSESORES', 'TIMOTEOS'].map(rol => {
                          const active = form.roles.includes(rol)
                          const label  = ROLE_DISPLAY_NAMES[rol] || rol
                          return (
                            <button
                              key={rol} type="button" onClick={() => toggleRole(rol)}
                              className={`role-btn-tab ${active ? 'active' : ''}`}
                              style={{
                                padding: '4px 10px', borderRadius: 30, fontSize: 10, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
                                background: active
                                  ? 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(224,242,254,.85))'
                                  : 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))',
                                color: active ? '#0284c7' : '#334155',
                                border: active ? '1px solid rgba(56,189,248,.75)' : '1px solid rgba(255,255,255,.87)',
                                boxShadow: active
                                  ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 3px 10px rgba(14,165,233,.18)'
                                  : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.18), 0 2px 5px rgba(96,116,147,.08)',
                                letterSpacing: '-0.1px',
                              }}
                            >
                              {active ? '✓ ' : ''}{label}
                            </button>
                          )
                        })}
                      </div>

                      {coordSubmenuOpen && (
                        <div style={{
                          background: 'linear-gradient(145deg, rgba(240,249,255,0.85), rgba(224,242,254,0.65))',
                          border: '1px solid rgba(186,230,253,0.9)',
                          borderRadius: 10,
                          padding: 6,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 4,
                          boxShadow: 'inset 0 1px 0 #fff, 0 3px 10px rgba(2,132,199,0.06)'
                        }}>
                          <div style={{ width: '100%', fontSize: 8.5, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                            Opciones de Coordinación:
                          </div>
                          {[
                            'COORDINADOR DE CLASE',
                            'COORDINADOR DE ALBORADA',
                            'COORDINADOR DE VISITACION',
                            'COORDINADOR DE FONDOS Y EVENTOS',
                            'COORDINADOR DE TIMOTEOS',
                            'COORDINADOR DE MAESTRA AUXILIAR',
                          ].map(rol => {
                            const active = form.roles.includes(rol)
                            const label  = ROLE_DISPLAY_NAMES[rol] || rol
                            return (
                              <button
                                key={rol} type="button" onClick={() => toggleRole(rol)}
                                className={`role-btn-tab ${active ? 'active' : ''}`}
                                style={{
                                  padding: '3px 8px', borderRadius: 30, fontSize: 9.5, fontWeight: 700,
                                  cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
                                  background: active
                                    ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(186,230,253,.90))'
                                    : 'linear-gradient(145deg, rgba(255,255,255,.90), rgba(241,245,249,.70))',
                                  color: active ? '#0284c7' : '#334155',
                                  border: active ? '1px solid rgba(56,189,248,.85)' : '1px solid rgba(226,232,240,.9)',
                                  boxShadow: active
                                    ? 'inset 0 1px 0 #fff, 0 0 0 1.5px rgba(56,189,248,.35), 0 3px 10px rgba(14,165,233,.2)'
                                    : 'inset 0 1px 0 #fff, 0 2px 5px rgba(0,0,0,.05)',
                                  letterSpacing: '-0.1px',
                                }}
                              >
                                {active ? '✓ ' : ''}{label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Roles Chips (solo se muestran cuando el desplegable está cerrado) */}
                  {!rolesOpen && form.roles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {form.roles.map(rol => (
                        <span
                          key={rol}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '1.5px 6px', borderRadius: 20, fontSize: 8.5, fontWeight: 700,
                            background: 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(224,242,254,.80))',
                            color: '#0284c7',
                            border: '1px solid rgba(56,189,248,.6)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 1px 3px rgba(14,165,233,.10)',
                            letterSpacing: '-0.1px',
                          }}
                        >
                          {ROLE_DISPLAY_NAMES[rol] || rol}
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleRole(rol) }}
                            style={{ cursor: 'pointer', color: '#0284c7', fontWeight: 800, fontSize: 9, marginLeft: 1, lineHeight: 1 }}
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {fieldErrors.roles && <ErrMsg msg={fieldErrors.roles} />}
                </div>
              </div>

              {isTimoteoProfile ? (
                <div style={{
                  display:'flex',
                  flexDirection:'column',
                  gap:16,
                  padding:'4px 2px 2px',
                }}>
                  <div>
                    <MGroupLabel label="Ficha del Timoteo" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>} />
                    <div style={{
                      display:'grid',
                      gridTemplateColumns:isMobile ? '1fr' : '1fr 1fr',
                      gap:10,
                      marginTop:8,
                    }}>
                      <Input label="Nombres" val={form.nombre} onChange={v => { setForm(f=>({...f, nombre:v})); clearFieldError('nombre') }} err={fieldErrors.nombre} />
                      <Input label="Apellidos" val={form.apellido} onChange={v => { setForm(f=>({...f, apellido:v})); clearFieldError('apellido') }} err={fieldErrors.apellido} />
                      <Input label="Cumpleaños (MM-DD)" val={form.cumpleanos} onChange={v => { setForm(f=>({...f, cumpleanos:v})); clearFieldError('cumpleanos') }} err={fieldErrors.cumpleanos} />
                      <Input label="Edad (años)" type="number" val={form.edad} onChange={v => setForm(f=>({...f, edad:v}))} />
                      <div style={{ gridColumn:isMobile ? 'auto' : '1 / -1' }}>
                        <Input label="Celular" type="tel" val={form.telefono} onChange={v => { setForm(f=>({...f, telefono:v})); clearFieldError('telefono') }} err={fieldErrors.telefono} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <MGroupLabel label="Horarios disponibles · Domingo" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>} />
                    <div style={{
                      display:'grid',
                      gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
                      gap:10,
                      marginTop:8,
                    }}>
                      <TimoteoScheduleToggle
                        label="7:00 AM"
                        checked={form.disponibilidad_domingo_7}
                        onChange={checked => setForm(f => ({ ...f, disponibilidad_domingo_7: checked }))}
                      />
                      <TimoteoScheduleToggle
                        label="9:00 AM"
                        checked={form.disponibilidad_domingo_9}
                        onChange={checked => setForm(f => ({ ...f, disponibilidad_domingo_9: checked }))}
                      />
                      <TimoteoScheduleToggle
                        label="11:00 AM"
                        checked={form.disponibilidad_domingo_11}
                        onChange={checked => setForm(f => ({ ...f, disponibilidad_domingo_11: checked }))}
                      />
                    </div>
                  </div>
                </div>
              ) : (
              <>
              {/* IDENTIDAD Y DATOS PERSONALES */}
              <div>
                <MGroupLabel label="Identidad y Datos Personales" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 6,
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  {/* Fila 1: Nombres, Apellidos, Cédula */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 2fr 1.3fr', gap: 8 }}>
                    <Input label="Nombres" val={form.nombre} onChange={v => { setForm(f=>({...f, nombre:v})); clearFieldError('nombre') }} err={fieldErrors.nombre} />
                    <Input label="Apellidos" val={form.apellido} onChange={v => { setForm(f=>({...f, apellido:v})); clearFieldError('apellido') }} err={fieldErrors.apellido} />
                    <Input label="Cédula" val={form.cedula} onChange={handleCedulaChange} err={fieldErrors.cedula} />
                  </div>
                  {/* Fila 2: Edad, Teléfono, Dirección */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isCualquierRolKids ? '0.8fr 1.5fr 2fr' : '1fr 2fr', gap: 8 }}>
                    <Input label="Edad" type="number" val={form.edad} onChange={v => setForm(f=>({...f, edad:v}))} />
                    <Input label="Teléfono" val={form.telefono} onChange={v => { setForm(f=>({...f, telefono:v})); clearFieldError('telefono') }} err={fieldErrors.telefono} />
                    {isCualquierRolKids && (
                      <Input label="Dirección" val={form.direccion} onChange={v => { setForm(f=>({...f, direccion:v})); clearFieldError('direccion') }} err={fieldErrors.direccion} />
                    )}
                  </div>
                </div>
              </div>

              {/* DATOS DE SERVICIO (SOLO COORDINADOR DE ALBORADA) */}
              {form.roles.includes('COORDINADOR DE ALBORADA') && (
                <div>
                  <MGroupLabel label="Asignación de Servicio (Alborada)" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
                  <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:8, marginTop:4 }}>
                    <Select label="Grupo de Alborada Asignado" val={form.grupo_asignado} opts={OPT_GRUPO} onChange={v => { setForm(f=>({...f, grupo_asignado:v})); clearFieldError('grupo_asignado') }} err={fieldErrors.grupo_asignado} />
                  </div>
                </div>
              )}

              {/* DATOS DE SERVICIO (SOLO COORDINADOR DE TIMOTEOS) */}
              {form.roles.includes('COORDINADOR DE TIMOTEOS') && (
                <div>
                  <MGroupLabel label="Asignación de Timoteos" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
                  <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:8, marginTop:4 }}>
                    <Select label="Grupo de Timoteos Asignado" val={form.grupo_timoteos_asignado} opts={OPT_GRUPO} onChange={v => { setForm(f=>({...f, grupo_timoteos_asignado:v})); clearFieldError('grupo_timoteos_asignado') }} err={fieldErrors.grupo_timoteos_asignado} />
                  </div>
                </div>
              )}

              {/* CAMPOS ADICIONALES (TODOS LOS ADULTOS/SERVIDORES) */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14 }}>
                <div>
                  <MGroupLabel label="Datos Personales Adicionales" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:6 }}>
                    <Input label="Profesión" val={form.profesion} onChange={v => { setForm(f=>({...f, profesion:v})); clearFieldError('profesion') }} err={fieldErrors.profesion} />
                    {(!form.edad || parseInt(form.edad) >= 18) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Input label="Número de Hijos" type="number" val={form.hijos} onChange={v => setForm(f=>({...f, hijos:v}))} />
                        <Select label="Estado Civil" val={form.estado_civil} opts={OPT_ESTADO_CIVIL} onChange={v => { setForm(f=>({...f, estado_civil:v})); clearFieldError('estado_civil') }} err={fieldErrors.estado_civil} />
                      </div>
                    )}
                    <Select label="Nivel de Estudios" val={form.estudios} opts={OPT_ESTUDIOS} onChange={v => { setForm(f=>({...f, estudios:v})); clearFieldError('estudios') }} err={fieldErrors.estudios} />
                  </div>
                </div>
                <div>
                  <MGroupLabel label="Disponibilidad" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14, padding: '4px 0' }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:9.5, color:'#334155', fontWeight: 600 }}>
                        <input type="checkbox" checked={form.sirve_entre_semana} onChange={e => setForm(f=>({...f, sirve_entre_semana: e.target.checked}))} style={{ width:13, height:13, accentColor:'#0ea5e9' }} />
                        Sirve entre semana
                      </label>
                      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:9.5, color:'#334155', fontWeight: 600 }}>
                        <input type="checkbox" checked={form.puede_dirigir} onChange={e => setForm(f=>({...f, puede_dirigir: e.target.checked}))} style={{ width:13, height:13, accentColor:'#0ea5e9' }} />
                        Puede dirigir alabanza
                      </label>
                    </div>
                    <Select label="Horario de Servicio" val={form.horario_servicio} opts={OPT_HORARIO} onChange={v => setForm(f=>({...f, horario_servicio:v}))} />
                    <Select label="Grupo de Servicio" val={form.grupo_servicio} opts={OPT_GRUPO_SERVICIO} onChange={v => setForm(f=>({...f, grupo_servicio:v}))} />
                  </div>
                </div>
              </div>

              {/* EXTRAS */}
              {isEdit && (
                <div style={{ display:'flex', gap:12 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:9.5, color:'#334155', marginTop:2 }}>
                    <input type="checkbox" checked={form.activo} onChange={e => setForm(f=>({...f, activo:e.target.checked}))} style={{ width:12, height:12, accentColor:'#0ea5e9' }} />
                    Servidor activo en el sistema
                  </label>
                </div>
              )}
              </>
              )}

              {serverError && (
                <div style={{ padding:6, borderRadius:6, background:'#fef2f2', color:'#b91c1c', fontSize:10.5, display:'flex', alignItems:'center', gap:6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {serverError}
                </div>
              )}

            </div>

            {/* FOOTER Liquid Glass */}
            <div style={{
              padding: '8px 14px', borderTop: '1px solid rgba(241,245,249,0.8)',
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.85))',
              position: 'sticky', bottom: 0, borderRadius: '0 0 14px 14px',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}>
              {/* Botón Cancelar Liquid Glass */}
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                style={{
                  position: 'relative', overflow: 'hidden',
                  padding: '0 16px', height: 30, borderRadius: 48,
                  border: '1px solid rgba(255,255,255,.90)',
                  background: 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(226,232,240,.55))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.12), 0 3px 8px rgba(96,116,147,.10)',
                  backdropFilter: 'blur(16px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(140%)',
                  color: '#475569',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '-0.1px',
                  transition: 'all .20s cubic-bezier(0.25,0.46,0.45,0.94)',
                }}
                onMouseEnter={e => {
                  const btn = e.currentTarget as HTMLButtonElement
                  btn.style.transform = 'translateY(-1px)'
                  btn.style.borderColor = 'rgba(203,213,225,1)'
                  btn.style.color = '#1e293b'
                  btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1), 0 4px 12px rgba(96,116,147,.15)'
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget as HTMLButtonElement
                  btn.style.transform = 'none'
                  btn.style.borderColor = 'rgba(255,255,255,.90)'
                  btn.style.color = '#475569'
                  btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.12), 0 3px 8px rgba(96,116,147,.10)'
                }}
              >
                Cancelar
              </button>

              {/* Botón Guardar Servidor Primary Liquid Glass */}
              <button
                type="submit"
                disabled={saving || compressing}
                style={{
                  position: 'relative', overflow: 'hidden',
                  padding: '0 18px', height: 30, borderRadius: 48,
                  border: '1px solid rgba(255,255,255,.60)',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), 0 4px 14px rgba(14,165,233,.38)',
                  backdropFilter: 'blur(20px) saturate(150%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                  color: '#ffffff',
                  fontSize: 11, fontWeight: 800,
                  cursor: (saving || compressing) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: (saving || compressing) ? 0.7 : 1,
                  letterSpacing: '-0.2px',
                  transition: 'all .22s cubic-bezier(0.25,0.46,0.45,0.94)',
                }}
                onMouseEnter={e => {
                  if (!saving && !compressing) {
                    const btn = e.currentTarget as HTMLButtonElement
                    btn.style.transform = 'translateY(-1.5px) scale(1.015)'
                    btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.6), 0 0 0 2px rgba(56,189,248,.35), 0 6px 18px rgba(14,165,233,.45)'
                  }
                }}
                onMouseLeave={e => {
                  if (!saving && !compressing) {
                    const btn = e.currentTarget as HTMLButtonElement
                    btn.style.transform = 'none'
                    btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.45), 0 4px 14px rgba(14,165,233,.38)'
                  }
                }}
              >
                {/* Glossy sheen overlay */}
                <div style={{
                  position: 'absolute', inset: 1, pointerEvents: 'none', borderRadius: 48,
                  background: 'linear-gradient(110deg, rgba(255,255,255,.35), transparent 30%, transparent 75%, rgba(255,255,255,.20))',
                  opacity: 0.8
                }} />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'relative', zIndex: 2 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ position: 'relative', zIndex: 2 }}>
                  {saving
                    ? 'Guardando...'
                    : compressing
                      ? 'Procesando...'
                      : isTimoteoProfile
                        ? 'Guardar Timoteo'
                        : 'Guardar Servidor'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      {cropFile && <CropModal file={cropFile} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} aspect={1} />}
    </>
  )
}

/* ── UI Helpers ──────────────────────────────────────────────────────────── */
function Input({ label, val, onChange, type = 'text', err }: { label: string, val: string, onChange: (v:string)=>void, type?: string, err?: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }} data-field-error={err ? true : undefined}>
      <label style={{ fontSize:9.5, fontWeight:600, color:'#475569' }}>{label}</label>
      <input
        type={type} value={val} onChange={e => onChange(e.target.value)}
        style={{
          height:28, padding:'0 8px', borderRadius:6,
          border:`1px solid ${err ? '#ef4444' : '#cbd5e1'}`,
          fontSize:10.5, outline:'none', transition:'border .2s',
          background: '#fff', width: '100%', boxSizing: 'border-box'
        }}
        onFocus={e => { if(!err) e.target.style.borderColor = '#0ea5e9' }}
        onBlur={e => { if(!err) e.target.style.borderColor = '#cbd5e1' }}
      />
      {err && <ErrMsg msg={err} />}
    </div>
  )
}

function TimoteoScheduleToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label style={{
      minHeight:52,
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      gap:7,
      borderRadius:14,
      border:checked ? '1px solid rgba(37,99,235,.55)' : '1px solid rgba(148,163,184,.28)',
      background:checked
        ? 'linear-gradient(145deg, rgba(219,234,254,.98), rgba(147,197,253,.76))'
        : 'linear-gradient(145deg, rgba(255,255,255,.94), rgba(241,245,249,.8))',
      boxShadow:checked
        ? 'inset 0 1px 0 rgba(255,255,255,.95), 0 7px 18px rgba(37,99,235,.18), 0 0 0 2px rgba(96,165,250,.12)'
        : 'inset 0 1px 0 #fff, 0 5px 14px rgba(71,85,105,.08)',
      color:checked ? '#1456b8' : '#64748b',
      cursor:'pointer',
      transition:'transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease, background .22s ease',
      fontSize:11,
      fontWeight:800,
      userSelect:'none',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        style={{ width:14, height:14, accentColor:'#2563eb' }}
      />
      {label}
    </label>
  )
}

function Select({ label, val, opts, onChange, err }: { label: string, val: string, opts: string[], onChange: (v:string)=>void, err?: string }) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 220)
    }
    setOpen(v => !v)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }} data-field-error={err ? true : undefined}>
      {label && <label style={{ fontSize:9.5, fontWeight:600, color:'#475569' }}>{label}</label>}
      <div style={{ position:'relative' }} ref={ref}>
        <div
          onClick={handleToggle}
          style={{
            width: '100%',
            height: 28,
            borderRadius: 30,
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            cursor: 'pointer',
            background: 'linear-gradient(145deg, rgba(255,255,255,.95), rgba(241,245,249,.85))',
            border: err
              ? '1px solid #ef4444'
              : open
                ? '1px solid rgba(56,189,248,.65)'
                : '1px solid rgba(226,232,240,.9)',
            boxShadow: open
              ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 3px 10px rgba(14,165,233,.15)'
              : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(81,105,139,.10), 0 2px 6px rgba(96,116,147,.08)',
            backdropFilter: 'blur(17px) saturate(135%)',
            WebkitBackdropFilter: 'blur(17px) saturate(135%)',
            transition: 'all .20s cubic-bezier(0.25,0.46,0.45,0.94)',
            boxSizing: 'border-box'
          }}
        >
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: val ? '#1e293b' : '#94a3b8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.2px'
          }}>
            {val || 'Seleccione...'}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {open && (
          <div style={{
            position: 'absolute',
            top: openUp ? 'auto' : 'calc(100% + 4px)',
            bottom: openUp ? 'calc(100% + 4px)' : 'auto',
            left: 0, right: 0,
            background: 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(241,245,249,.95))',
            backdropFilter: 'blur(20px) saturate(140%)',
            WebkitBackdropFilter: 'blur(20px) saturate(140%)',
            border: '1px solid rgba(255,255,255,.95)',
            borderRadius: 12,
            boxShadow: openUp
              ? '0 -10px 24px rgba(54,69,95,.20), inset 0 1px 0 #fff'
              : '0 10px 24px rgba(54,69,95,.20), inset 0 1px 0 #fff',
            padding: 4,
            zIndex: 60,
            maxHeight: 240,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            {opts.map(o => {
              const active = val === o
              return (
                <div
                  key={o}
                  onClick={() => { onChange(o); setOpen(false) }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: active ? 800 : 600,
                    color: active ? '#0284c7' : '#334155',
                    background: active
                      ? 'linear-gradient(145deg, rgba(224,242,254,.95), rgba(186,230,253,.8))'
                      : 'transparent',
                    border: active ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.14s cubic-bezier(0.25,0.46,0.45,0.94)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(1.5px) scale(0.982)'
                    el.style.boxShadow = 'inset 0 2px 4px rgba(81,105,139,0.22), inset 0 1px 2px rgba(0,0,0,0.10)'
                    if (!active) {
                      el.style.background = 'linear-gradient(145deg, rgba(225,232,240,.9), rgba(210,220,232,.75))'
                      el.style.borderColor = 'rgba(180,195,215,0.85)'
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'none'
                    el.style.boxShadow = active ? 'inset 0 1px 0 #fff, 0 2px 6px rgba(14,165,233,0.15)' : 'none'
                    if (!active) {
                      el.style.background = 'transparent'
                      el.style.borderColor = 'transparent'
                    }
                  }}
                >
                  <span>{o}</span>
                  {active && <span style={{ fontSize: 10, fontWeight: 800, color: '#0284c7' }}>✓</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {err && <ErrMsg msg={err} />}
    </div>
  )
}

function MGroupLabel({ label, icon }: { label: string, icon: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, paddingBottom:3, borderBottom:'1px solid #f1f5f9' }}>
      <div style={{ width:16, height:16, borderRadius:4, background:'#eff6ff', color:'#0ea5e9', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <span style={{ fontSize:9.5, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'0.4px' }}>{label}</span>
    </div>
  )
}

function ErrMsg({ msg }: { msg: string }) {
  return <span style={{ color:'#ef4444', fontSize:9.5, marginTop:1 }}>{msg}</span>
}
