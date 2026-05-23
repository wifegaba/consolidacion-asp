'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { extractFaceDescriptor, type FaceStatus } from '@/lib/faceRecognition'

/* ── Types ─────────────────────────────────────────────────────────────── */
export interface KidsNino {
  id: string
  nombre: string
  apellido: string | null
  edad: number | null
  // Columnas reales NOT NULL en la tabla
  nombre_acudiente:   string | null
  telefono_acudiente: string | null
  // Columnas alias nullable (pueden coexistir en la tabla)
  acudiente:       string | null
  telefono:        string | null
  grupo:           string | null
  observaciones:   string | null
  foto_url:        string | null
  face_descriptor: number[] | null   // vector de 128 dimensiones para reconocimiento facial
  activo:          boolean
  creado_en:       string
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const GRUPO_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Exploradores':  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'Pequeños Luz':  { bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' },
  'Constructores': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  'Semillitas':    { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  'Promesas':      { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
}

const CHILD_GRADIENTS = [
  'linear-gradient(135deg,#60a5fa 0%,#93c5fd 100%)',
  'linear-gradient(135deg,#f472b6 0%,#fda4af 100%)',
  'linear-gradient(135deg,#34d399 0%,#6ee7b7 100%)',
  'linear-gradient(135deg,#a78bfa 0%,#c4b5fd 100%)',
  'linear-gradient(135deg,#fb923c 0%,#fde68a 100%)',
  'linear-gradient(135deg,#38bdf8 0%,#7dd3fc 100%)',
  'linear-gradient(135deg,#f87171 0%,#fca5a5 100%)',
  'linear-gradient(135deg,#4ade80 0%,#86efac 100%)',
]

const GRUPOS_DISPONIBLES = ['Semillitas', 'Exploradores', 'Junior']
const VISIBLE_COUNT = 8

/* ════════════════════════════════════════════════════════════════════════
   NinosSection — Panel principal de niños
════════════════════════════════════════════════════════════════════════ */
interface Props {
  usuario: { nombre: string; apellido: string; foto_url: string | null } | null
  logoNavOpen?: boolean
}

export default function NinosSection({ usuario, logoNavOpen = false }: Props) {
  const [ninos,       setNinos]      = useState<KidsNino[]>([])
  const [loading,     setLoading]    = useState(true)
  const [saving,      setSaving]     = useState(false)
  const [search,      setSearch]     = useState('')
  const [sortBy,      setSortBy]     = useState<'recientes' | 'nombre' | 'grupo'>('recientes')
  const [sortOpen,    setSortOpen]   = useState(false)
  const [filterGrupo, setFilterGrupo]= useState('todos')
  const [filterOpen,  setFilterOpen] = useState(false)
  const [showMore,    setShowMore]   = useState(false)
  const [formErr,     setFormErr]    = useState('')
  const [successMsg,  setSuccessMsg] = useState('')
  const [editNino,         setEditNino]         = useState<KidsNino | null>(null)
  const [photoFile,        setPhotoFile]        = useState<File | null>(null)   // archivo a subir
  const [photoPreview,     setPhotoPreview]     = useState<string | null>(null) // blob URL para mostrar
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null) // URL ya guardada en DB
  const [photoRemoved,     setPhotoRemoved]     = useState(false)               // usuario quitó la foto
  const [photoErr,         setPhotoErr]         = useState('')
  const [faceStatus,       setFaceStatus]       = useState<FaceStatus>('idle')
  const [faceDescriptor,   setFaceDescriptor]   = useState<number[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Responsive ── */
  const [isMobile,        setIsMobile]        = useState(false)
  const [showMobileForm,  setShowMobileForm]  = useState(false)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [form, setForm] = useState({
    nombreCompleto: '',   // campo único — se divide al guardar
    edad: '',
    acudiente: '', telefono: '', grupo: '', observaciones: '',
  })
  const sortRef   = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── Fetch ── */
  const fetchNinos = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/kids/ninos')
      const json = await res.json()
      if (json.ok) setNinos(json.data ?? [])
    } catch { /* silently ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchNinos() }, [fetchNinos])

  /* ── Filtered & sorted ── */
  const filtered = ninos
    .filter(n => {
      const q = search.toLowerCase().trim()
      const matchSearch = !q ||
        n.nombre.toLowerCase().includes(q) ||
        (n.apellido ?? '').toLowerCase().includes(q) ||
        (n.grupo ?? '').toLowerCase().includes(q) ||
        (n.nombre_acudiente ?? n.acudiente ?? '').toLowerCase().includes(q)
      const matchGrupo = filterGrupo === 'todos' || n.grupo === filterGrupo
      return matchSearch && matchGrupo
    })
    .sort((a, b) => {
      if (sortBy === 'nombre') return a.nombre.localeCompare(b.nombre)
      if (sortBy === 'grupo')  return (a.grupo ?? '').localeCompare(b.grupo ?? '')
      return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    })

  const displayed = showMore ? filtered : filtered.slice(0, VISIBLE_COUNT)

  /* ── Stats ── */
  const now = new Date()
  const mesCount = ninos.filter(n => {
    const d = new Date(n.creado_en)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const semanaCount = ninos.filter(n => {
    const d = new Date(n.creado_en)
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length
  const gruposActivos = new Set(ninos.filter(n => n.grupo && n.activo).map(n => n.grupo)).size
  const activosCount  = ninos.filter(n => n.activo).length

  /* ── Save ── */
  async function handleSave() {
    const partes   = form.nombreCompleto.trim().split(/\s+/)
    const nombre   = partes[0] ?? ''
    const apellido = partes.slice(1).join(' ') || null
    if (!nombre) { setFormErr('El nombre es obligatorio'); return }
    setSaving(true)
    setFormErr('')
    try {
      // ── 1. Subir foto si hay archivo nuevo (igual que AdminModal) ──────────
      let foto_url: string | undefined | null = undefined
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        fd.append('folder', 'ninos')
        const upRes  = await fetch('/api/kids/upload', { method: 'POST', body: fd })
        const upJson = await upRes.json()
        if (!upRes.ok) throw new Error(upJson.error ?? 'Error al subir la foto.')
        foto_url = upJson.url   // proxy URL: /api/kids/foto?f=ninos/xxx.jpg
      } else if (photoRemoved) {
        foto_url = null          // quitar foto explícitamente
      }
      // Si foto_url es undefined → no se incluye en el body → DB conserva el valor actual

      // ── 2. Guardar registro ────────────────────────────────────────────────
      const url    = editNino ? `/api/kids/ninos/${editNino.id}` : '/api/kids/ninos'
      const method = editNino ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          edad:          form.edad ? parseInt(form.edad) : null,
          acudiente:     form.acudiente.trim() || null,
          telefono:      form.telefono.trim() || null,
          grupo:         form.grupo || null,
          observaciones: form.observaciones.trim() || null,
          ...(foto_url !== undefined ? { foto_url } : {}),
          // Incluir descriptor solo si se detectó una cara en la nueva foto
          ...(faceDescriptor ? { face_descriptor: faceDescriptor } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setFormErr(json.error ?? 'Error al guardar'); return }

      if (editNino) {
        setNinos(prev => prev.map(n => n.id === editNino.id ? json.data : n))
        setEditNino(null)
      } else {
        setNinos(prev => [json.data, ...prev])
      }
      resetPhotoState()
      setForm({ nombreCompleto:'', edad:'', acudiente:'', telefono:'', grupo:'', observaciones:'' })
      setSuccessMsg(editNino ? '¡Niño actualizado!' : '¡Niño registrado exitosamente!')
      setTimeout(() => setSuccessMsg(''), 3000)
      setShowMobileForm(false)
    } catch (err: any) {
      setFormErr(err.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  function resetPhotoState() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    setExistingPhotoUrl(null)
    setPhotoRemoved(false)
    setPhotoErr('')
    setFaceStatus('idle')
    setFaceDescriptor(null)
  }

  function startEdit(n: KidsNino) {
    setEditNino(n)
    resetPhotoState()
    setExistingPhotoUrl(n.foto_url ?? null)
    setForm({
      nombreCompleto: `${n.nombre}${n.apellido ? ' ' + n.apellido : ''}`,
      edad:           n.edad != null ? String(n.edad) : '',
      acudiente:      n.nombre_acudiente ?? n.acudiente ?? '',
      telefono:       n.telefono_acudiente ?? n.telefono ?? '',
      grupo:          n.grupo ?? '',
      observaciones:  n.observaciones ?? '',
    })
    setFormErr('')
    setShowMobileForm(true)
  }

  function cancelEdit() {
    setEditNino(null)
    resetPhotoState()
    setForm({ nombreCompleto:'', edad:'', acudiente:'', telefono:'', grupo:'', observaciones:'' })
    setFormErr('')
    setShowMobileForm(false)
  }

  /* ── Selección de foto (mismo patrón que AdminModal) ── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setPhotoErr('Solo se permiten imágenes.'); return }
    if (file.size > 15 * 1024 * 1024)   { setPhotoErr('La imagen no puede superar 15 MB.'); return }

    setPhotoErr('')
    setPhotoFile(file)
    setPhotoRemoved(false)
    setExistingPhotoUrl(null)
    setFaceDescriptor(null)
    setFaceStatus('idle')
    // Preview con blob URL (no genera problemas de canvas/CORS)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(URL.createObjectURL(file))
    e.target.value = ''

    // ── Extraer descriptor facial en background ──────────────────────────
    extractFaceDescriptor(file, setFaceStatus).then(descriptor => {
      // Convertir Float32Array → number[] para serialización JSON correcta
      setFaceDescriptor(descriptor ? Array.from(descriptor) : null)
    })
  }

  /* ── Activar IA: re-extraer descriptor desde la foto ya guardada ── */
  async function handleActivateAI(n: KidsNino): Promise<'ok' | 'not_found' | 'error'> {
    if (!n.foto_url) return 'error'
    try {
      // 1. Descargar la foto existente como blob → File
      const res  = await fetch(n.foto_url)
      if (!res.ok) return 'error'
      const blob = await res.blob()
      const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })

      // 2. Extraer descriptor (face-api.js en el browser)
      const descriptor = await extractFaceDescriptor(file)
      if (!descriptor) return 'not_found'

      // 3. Guardar en la base de datos
      const patch = await fetch(`/api/kids/ninos/${n.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ face_descriptor: Array.from(descriptor) }),
      })
      const pj = await patch.json()
      if (!patch.ok || !pj.ok) return 'error'

      // 4. Actualizar lista local
      setNinos(prev => prev.map(x => x.id === n.id ? pj.data : x))
      return 'ok'
    } catch {
      return 'error'
    }
  }

  async function handleToggleActive(n: KidsNino) {
    try {
      const res = await fetch(`/api/kids/ninos/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !n.activo }),
      })
      const json = await res.json()
      if (json.ok) setNinos(prev => prev.map(x => x.id === n.id ? json.data : x))
    } catch { /* silently ignore */ }
  }

  async function handleDelete(n: KidsNino) {
    try {
      const res = await fetch(`/api/kids/ninos/${n.id}`, { method: 'DELETE' })
      if (res.ok) setNinos(prev => prev.filter(x => x.id !== n.id))
    } catch { /* silently ignore */ }
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{
      display:        'flex',
      flex:           1,
      minHeight:      0,
      overflow:       'hidden',
      background:     'linear-gradient(145deg,#f5f3ff 0%,#ede9fe 60%,#e0f2fe 100%)',
      position:       'relative',
    }}>

      {/* ═══════════════════════════════════
          LEFT — Main content
      ═══════════════════════════════════ */}
      <div style={{
        flex:          1,
        minWidth:      0,
        display:       'flex',
        flexDirection: 'column',
        padding:       isMobile ? '16px 14px 0 14px' : '24px 20px 0 28px',
        overflow:      'hidden',
      }}>

        {/* ── Header row ── */}
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          marginBottom:   isMobile ? 14 : 22,
          flexShrink:     0,
          gap:            10,
          flexWrap:       'wrap',
        }}>
          {/* Title */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight:900, color:'#111827', margin:0, letterSpacing:'-0.6px', lineHeight:1 }}>
                Niños
              </h1>
              <span style={{ fontSize: isMobile ? 18 : 22, lineHeight:1 }}>⭐</span>
            </div>
            {!isMobile && (
              <div style={{ fontSize:12, color:'#6b7280', marginTop:4, fontWeight:400 }}>
                Administra y conoce a todos los niños registrados
              </div>
            )}
          </div>

          {/* Right: search + user */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flex: isMobile ? 1 : 'none', minWidth: 0 }}>
            {/* Search */}
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              background:'rgba(255,255,255,.90)',
              border:'1px solid rgba(0,0,0,.07)',
              borderRadius:50,
              padding:'9px 14px',
              boxShadow:'0 2px 10px rgba(0,0,0,.06)',
              flex: isMobile ? 1 : 'none',
              minWidth: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar niño..."
                style={{
                  border:'none', background:'transparent', outline:'none',
                  fontSize:12, color:'#374151', width: isMobile ? '100%' : 130,
                  fontFamily:'inherit', minWidth: 0,
                }}
              />
            </div>

            {/* Notification bell — solo desktop */}
            {!isMobile && (
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{
                  width:38, height:38, borderRadius:12,
                  background:'rgba(255,255,255,.85)',
                  border:'1px solid rgba(0,0,0,.07)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,.05)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
              </div>
            )}

            {/* User avatar — solo desktop */}
            {!isMobile && usuario && (
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0,
                background:'rgba(255,255,255,.85)', border:'1px solid rgba(0,0,0,.07)',
                borderRadius:50, padding:'4px 12px 4px 4px',
                boxShadow:'0 2px 8px rgba(0,0,0,.05)',
              }}>
                <UserAvatar usuario={usuario} />
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#111827', lineHeight:1 }}>
                    Hola, {usuario.nombre.split(' ')[0]}
                  </div>
                  <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>Administrador</div>
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row — 4 cards (2 en móvil) ── */}
        <div style={{
          display:'grid',
          gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
          gap: isMobile ? 10 : 12,
          marginBottom: isMobile ? 14 : 20,
          flexShrink:0,
        }}>
          <StatCard
            iconBg="linear-gradient(135deg,#3b82f6,#60a5fa)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            label="Niños registrados"
            value={ninos.length}
            sub={`+${mesCount} este mes`}
          />
          <StatCard
            iconBg="linear-gradient(135deg,#22c55e,#4ade80)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            label="Asistencia hoy"
            value={activosCount}
            sub={`${ninos.length ? Math.round((activosCount/ninos.length)*100) : 0}% del total`}
          />
          <StatCard
            iconBg="linear-gradient(135deg,#8b5cf6,#a78bfa)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            label="Nuevos este mes"
            value={mesCount}
            sub={`+${semanaCount} esta semana`}
          />
          <StatCard
            iconBg="linear-gradient(135deg,#f59e0b,#fbbf24)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
            label="Grupos activos"
            value={gruposActivos}
            sub="Todos funcionando"
          />
        </div>

        {/* ── List header + filter/sort ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:14, flexShrink:0,
        }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:'#111827', margin:0 }}>
            Listado de niños
          </h2>
          <div style={{ display:'flex', gap:8 }}>
            {/* Filter dropdown */}
            <div ref={filterRef} style={{ position:'relative' }}>
              <button
                onClick={() => setFilterOpen(v => !v)}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'8px 14px', borderRadius:50,
                  border:'1px solid rgba(0,0,0,.08)',
                  background:'rgba(255,255,255,.85)',
                  fontSize:12, fontWeight:600, color:'#374151', cursor:'pointer',
                  boxShadow:'0 1px 4px rgba(0,0,0,.05)',
                  transition:'all .15s',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filtrar
                {filterGrupo !== 'todos' && (
                  <span style={{
                    background:'#7c3aed', color:'#fff',
                    borderRadius:'50%', width:16, height:16,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:8, fontWeight:800,
                  }}>1</span>
                )}
              </button>
              {filterOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0,
                  background:'#fff', borderRadius:14, padding:6,
                  boxShadow:'0 10px 36px rgba(0,0,0,.12)',
                  border:'1px solid rgba(0,0,0,.06)',
                  zIndex:20, minWidth:170,
                }}>
                  {['todos', ...GRUPOS_DISPONIBLES].map(g => (
                    <button
                      key={g}
                      onClick={() => { setFilterGrupo(g); setFilterOpen(false) }}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        width:'100%', textAlign:'left',
                        padding:'8px 12px', borderRadius:9, border:'none',
                        fontSize:12, fontWeight: filterGrupo === g ? 700 : 500,
                        background: filterGrupo === g ? '#f3f0ff' : 'transparent',
                        color: filterGrupo === g ? '#7c3aed' : '#374151',
                        cursor:'pointer', transition:'all .12s',
                      }}
                    >
                      {filterGrupo === g && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.8" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {g === 'todos' ? 'Todos los grupos' : g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort dropdown */}
            <div ref={sortRef} style={{ position:'relative' }}>
              <button
                onClick={() => setSortOpen(v => !v)}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'8px 14px', borderRadius:50,
                  border:'1px solid rgba(0,0,0,.08)',
                  background:'rgba(255,255,255,.85)',
                  fontSize:12, fontWeight:600, color:'#374151', cursor:'pointer',
                  boxShadow:'0 1px 4px rgba(0,0,0,.05)',
                  transition:'all .15s',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
                {sortBy === 'recientes' ? 'Más recientes' : sortBy === 'nombre' ? 'Por nombre' : 'Por grupo'}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                  <polyline points={sortOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                </svg>
              </button>
              {sortOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0,
                  background:'#fff', borderRadius:14, padding:6,
                  boxShadow:'0 10px 36px rgba(0,0,0,.12)',
                  border:'1px solid rgba(0,0,0,.06)',
                  zIndex:20, minWidth:155,
                }}>
                  {([
                    { key:'recientes', label:'Más recientes' },
                    { key:'nombre',    label:'Por nombre'    },
                    { key:'grupo',     label:'Por grupo'     },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortBy(opt.key); setSortOpen(false) }}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        width:'100%', textAlign:'left',
                        padding:'8px 12px', borderRadius:9, border:'none',
                        fontSize:12, fontWeight: sortBy === opt.key ? 700 : 500,
                        background: sortBy === opt.key ? '#f3f0ff' : 'transparent',
                        color: sortBy === opt.key ? '#7c3aed' : '#374151',
                        cursor:'pointer', transition:'all .12s',
                      }}
                    >
                      {sortBy === opt.key && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.8" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable children grid ── */}
        <div style={{ flex:1, minHeight:0, overflowY:'auto', paddingRight:4, paddingBottom: isMobile ? 90 : 28 }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:13, fontWeight:500 }}>
              Cargando niños…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>👶</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#374151', marginBottom:6 }}>
                {search ? 'Sin resultados para esa búsqueda' : 'No hay niños registrados'}
              </div>
              <div style={{ fontSize:11, color:'#9ca3af' }}>
                {search ? 'Prueba con otro nombre o grupo.' : 'Agrega el primer niño con el formulario.'}
              </div>
            </div>
          ) : (
            <>
              <div style={{
                display:'grid',
                gridTemplateColumns: isMobile
                  ? 'repeat(2,minmax(0,1fr))'
                  : 'repeat(4,minmax(0,1fr))',
                gap: isMobile ? 10 : 14,
              }}>
                {displayed.map((n, idx) => (
                  <NinoCard
                    key={n.id}
                    nino={n}
                    idx={idx}
                    onEdit={() => startEdit(n)}
                    onToggle={() => handleToggleActive(n)}
                    onDelete={() => handleDelete(n)}
                    onActivateAI={() => handleActivateAI(n)}
                  />
                ))}
              </div>

              {filtered.length > VISIBLE_COUNT && (
                <button
                  onClick={() => setShowMore(v => !v)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    width:'100%', marginTop:16,
                    padding:'12px 0', borderRadius:12,
                    border:'1px solid rgba(0,0,0,.07)',
                    background:'rgba(255,255,255,.75)',
                    fontSize:12, fontWeight:600, color:'#6b7280',
                    cursor:'pointer', transition:'all .18s',
                    backdropFilter:'blur(8px)',
                  }}
                >
                  {showMore
                    ? 'Ver menos'
                    : `Ver más niños (${filtered.length - VISIBLE_COUNT} más)`}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                    <polyline points={showMore ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
        {/* ── FAB: Agregar niño (solo móvil) ── */}
        {isMobile && !showMobileForm && !logoNavOpen && (
          <button
            onClick={() => { setEditNino(null); resetPhotoState(); setForm({ nombreCompleto:'', edad:'', acudiente:'', telefono:'', grupo:'', observaciones:'' }); setFormErr(''); setShowMobileForm(true) }}
            style={{
              position:   'fixed',
              top:        16,
              right:      16,
              zIndex:     50,
              width:      44,
              height:     44,
              borderRadius: '50%',
              border:     'none',
              background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
              color:      '#fff',
              fontSize:   26,
              fontWeight: 700,
              lineHeight: 1,
              cursor:     'pointer',
              boxShadow:  '0 4px 16px rgba(124,58,237,.5)',
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Agregar niño"
          >
            +
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════
          RIGHT — Form panel
          Desktop: sidebar fija
          Mobile: bottom-sheet overlay
      ═══════════════════════════════════ */}

      {/* Backdrop móvil */}
      {isMobile && showMobileForm && (
        <div
          onClick={cancelEdit}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,.45)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <div style={
        isMobile
          ? {
              position:             'fixed',
              top:                  0,
              left:                 0,
              right:                0,
              zIndex:               70,
              maxHeight:            '94dvh',
              borderRadius:         '0 0 28px 28px',
              /* ── GLASS PREMIUM ── */
              background:           'linear-gradient(170deg,rgba(245,242,255,0.97) 0%,rgba(255,255,255,0.98) 55%,rgba(240,249,255,0.97) 100%)',
              backdropFilter:       'blur(40px) saturate(220%) brightness(1.04)',
              WebkitBackdropFilter: 'blur(40px) saturate(220%) brightness(1.04)',
              border:               '1px solid rgba(255,255,255,0.9)',
              borderTop:            'none',
              /* ────────── */
              display:              showMobileForm ? 'flex' : 'none',
              flexDirection:        'column',
              overflowY:            'auto',
              padding:              'max(env(safe-area-inset-top,0px),14px) 22px 32px',
              boxShadow:            '0 18px 60px rgba(109,40,217,.22), 0 4px 24px rgba(0,0,0,.08), 0 0 0 0.5px rgba(124,58,237,.12)',
            } as React.CSSProperties
          : {
              width:                290,
              flexShrink:           0,
              /* ── GLASS ── */
              background:           'rgba(255,255,255,0.72)',
              backdropFilter:       'blur(28px) saturate(200%)',
              WebkitBackdropFilter: 'blur(28px) saturate(200%)',
              borderLeft:           '1px solid rgba(255,255,255,0.6)',
              /* ────────── */
              display:              'flex',
              flexDirection:        'column',
              overflowY:            'auto',
              padding:              '28px 20px 24px',
              boxShadow:            '-8px 0 40px rgba(109,40,217,.10), inset 1px 0 0 rgba(255,255,255,.85)',
              position:             'relative',
            } as React.CSSProperties
      }>

        {/* ── Acento glass (brillo premium) ── */}
        {!isMobile && (
          <div style={{
            position:     'absolute',
            top:          0,
            left:         0,
            right:        0,
            height:       2,
            background:   'linear-gradient(90deg, rgba(167,139,250,0.8) 0%, rgba(139,92,246,1) 40%, rgba(99,102,241,0.7) 80%, rgba(167,139,250,0.4) 100%)',
            pointerEvents:'none',
            zIndex:       1,
          }} />
        )}

        {/* Drag handle + acento inferior — solo móvil, siempre al final del scroll */}
        {isMobile && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginTop:18, order:99, flexShrink:0 }}>
            <div style={{ width:44, height:5, borderRadius:99, background:'rgba(124,58,237,0.2)' }} />
            <div style={{
              width:'calc(100% + 44px)', height:3,
              borderRadius:'0 0 28px 28px',
              background:'linear-gradient(90deg, rgba(167,139,250,0.8) 0%, rgba(139,92,246,1) 40%, rgba(99,102,241,0.7) 80%, rgba(167,139,250,0.4) 100%)',
              pointerEvents:'none',
            }} />
          </div>
        )}

        {/* Form title */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:'2px', textTransform:'uppercase' as const,
              background:'linear-gradient(90deg,#7c3aed,#6366f1)', WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent', marginBottom:3 }}>
              {editNino ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}
            </div>
            <h3 style={{ fontSize:22, fontWeight:900, margin:0, lineHeight:1.1, letterSpacing:'-0.5px',
              background:'linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#2e1065 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {editNino ? editNino.nombre : 'Agregar niño'}
            </h3>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:22, filter:'drop-shadow(0 2px 6px rgba(124,58,237,.4))' }}>
              {editNino ? '✏️' : '✨'}
            </span>
            {(editNino || isMobile) && (
              <button
                onClick={cancelEdit}
                style={{
                  width:36, height:36, borderRadius:12,
                  border:'1.5px solid rgba(124,58,237,.18)',
                  background:'rgba(255,255,255,0.7)',
                  backdropFilter:'blur(12px)',
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,.08)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Photo upload */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:22 }}>

          {/* Input oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display:'none' }}
            onChange={handleFileChange}
          />

          {photoPreview ? (
            /* ── Nueva foto seleccionada: arrastrar para ajustar ── */
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
              <DraggablePhotoCircle
                src={photoPreview}
                size={90}
                onCrop={(croppedDataUrl) => {
                  // Convertir el canvas recortado → File y actualizar photoFile
                  // para que handleSave suba la versión ajustada, no el original
                  fetch(croppedDataUrl)
                    .then(r => r.blob())
                    .then(blob => {
                      setPhotoFile(new File([blob], 'photo-cropped.jpg', { type: 'image/jpeg' }))
                    })
                    .catch(() => { /* silencioso — photoFile original se conserva */ })
                }}
              />
              <span style={{ fontSize:9, color:'#7c3aed', fontWeight:700, marginTop:6, letterSpacing:'0.3px' }}>
                ✦ Arrastra para ajustar
              </span>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background:'none', border:'1px solid #d1d5db',
                    borderRadius:8, padding:'4px 10px',
                    fontSize:10, color:'#6b7280', cursor:'pointer', fontWeight:600,
                  }}
                >
                  📷 Cambiar
                </button>
                <button
                  onClick={() => {
                    resetPhotoState()
                    if (editNino) setExistingPhotoUrl(editNino.foto_url ?? null)
                  }}
                  style={{
                    background:'none', border:'1px solid #fecaca',
                    borderRadius:8, padding:'4px 10px',
                    fontSize:10, color:'#f43f5e', cursor:'pointer', fontWeight:600,
                  }}
                >
                  ✕ Quitar
                </button>
              </div>
            </div>

          ) : existingPhotoUrl ? (
            /* ── Foto ya guardada (modo edición sin nueva foto seleccionada) ── */
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
              <div style={{
                width:90, height:90, borderRadius:'50%',
                overflow:'hidden', border:'3px solid #7c3aed',
                boxShadow:'0 4px 14px rgba(124,58,237,.3)',
              }}>
                <img
                  src={existingPhotoUrl}
                  alt="foto actual"
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                />
              </div>
              <span style={{ fontSize:9, color:'#6b7280', fontWeight:600, marginTop:6 }}>
                Foto actual
              </span>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background:'none', border:'1px solid #d1d5db',
                    borderRadius:8, padding:'4px 10px',
                    fontSize:10, color:'#6b7280', cursor:'pointer', fontWeight:600,
                  }}
                >
                  📷 Cambiar
                </button>
                <button
                  onClick={() => { setExistingPhotoUrl(null); setPhotoRemoved(true) }}
                  style={{
                    background:'none', border:'1px solid #fecaca',
                    borderRadius:8, padding:'4px 10px',
                    fontSize:10, color:'#f43f5e', cursor:'pointer', fontWeight:600,
                  }}
                >
                  ✕ Quitar foto
                </button>
              </div>
            </div>

          ) : (
            /* ── Modo vacío: clic para subir ── */
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width:96, height:96, borderRadius:'50%',
                background:['linear-gradient(rgba(245,243,255,.9),rgba(245,243,255,.9)) padding-box',
                            'linear-gradient(135deg,#7c3aed,#6366f1,#a78bfa,#7c3aed) border-box'].join(','),
                border:'2px solid transparent',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                cursor:'pointer', marginBottom:6,
                boxShadow:'0 4px 20px rgba(124,58,237,.18), inset 0 1px 0 rgba(255,255,255,.9)',
                transition:'all .2s',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#uploadGrad)" strokeWidth="1.8" strokeLinecap="round">
                <defs>
                  <linearGradient id="uploadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c3aed"/>
                    <stop offset="100%" stopColor="#6366f1"/>
                  </linearGradient>
                </defs>
                <polyline points="16 16 12 12 8 16"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.8px', marginTop:5,
                background:'linear-gradient(90deg,#7c3aed,#6366f1)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                SUBIR FOTO
              </span>
            </div>
          )}

          {!photoPreview && (
            <span style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>JPG, PNG máximo 5MB</span>
          )}

          {photoErr && (
            <div style={{ fontSize:10, color:'#f43f5e', marginTop:5, fontWeight:600, textAlign:'center' }}>
              {photoErr}
            </div>
          )}

          {/* ── Face detection status badge ── */}
          <FaceStatusBadge status={faceStatus} />
        </div>

        {/* Messages */}
        {successMsg && (
          <div style={{
            background:'#f0fdf4', border:'1px solid #bbf7d0',
            borderRadius:10, padding:'10px 14px', marginBottom:14,
            fontSize:11, fontWeight:600, color:'#16a34a',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {successMsg}
          </div>
        )}
        {formErr && (
          <div style={{
            background:'#fef2f2', border:'1px solid #fecaca',
            borderRadius:10, padding:'10px 14px', marginBottom:14,
            fontSize:11, fontWeight:600, color:'#dc2626',
          }}>
            {formErr}
          </div>
        )}

        {/* Divider */}
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(124,58,237,.15) 30%,rgba(99,102,241,.15) 70%,transparent)', margin:'4px 0 16px' }} />

        {/* Form fields */}
        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>

          {/* Nombre completo */}
          <NinoField
            label="Nombre completo"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            placeholder="Ej. Samuel Rodríguez"
            value={form.nombreCompleto}
            onChange={v => setForm(f => ({ ...f, nombreCompleto: v }))}
          />

          {/* Edad */}
          <NinoField
            label="Edad"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            placeholder="Ej. 7"
            value={form.edad}
            onChange={v => setForm(f => ({ ...f, edad: v.replace(/\D/g,'') }))}
            type="text"
            inputMode="numeric"
          />

          {/* Acudiente */}
          <NinoField
            label="Acudiente / Tutor"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            placeholder="Nombre del acudiente"
            value={form.acudiente}
            onChange={v => setForm(f => ({ ...f, acudiente: v }))}
          />

          {/* Teléfono */}
          <NinoField
            label="Teléfono"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
            placeholder="Ej. 300 123 4567"
            value={form.telefono}
            onChange={v => setForm(f => ({ ...f, telefono: v }))}
          />

          {/* Grupo / Curso — SELECT */}
          <GrupoSelect
            value={form.grupo}
            onChange={v => setForm(f => ({ ...f, grupo: v }))}
            grupos={GRUPOS_DISPONIBLES}
          />

          {/* Observaciones — TEXTAREA */}
          <ObsTextarea
            value={form.observaciones}
            onChange={v => setForm(f => ({ ...f, observaciones: v }))}
            isMobile={isMobile}
          />
        </div>

        {/* Save button — 3D animado */}
        <Button3DGreen
          onClick={handleSave}
          disabled={saving}
          saving={saving}
          label={editNino ? 'Actualizar' : 'Guardar'}
          compact={isMobile}
        />

      </div>
    </div>
    </>
  )
}

/* ── StatCard ────────────────────────────────────────────────────────────── */
function StatCard({
  iconBg, icon, label, value, sub,
}: {
  iconBg: string
  icon:   React.ReactNode
  label:  string
  value:  number
  sub:    string
}) {
  return (
    <div style={{
      /* ── Liquid Glass — idéntico a los otros paneles ── */
      background: [
        'linear-gradient(rgba(255,255,255,.94),rgba(255,255,255,.94)) padding-box',
        'linear-gradient(135deg,#60a5fa 0%,#a78bfa 35%,#f472b6 65%,#67e8f9 100%) border-box',
      ].join(','),
      backdropFilter:       'blur(40px) saturate(200%)',
      WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      border:      '2px solid transparent',
      borderRadius: 20,
      boxShadow: [
        '-4px 0 16px rgba(96,165,250,.28)',
        '4px 0 16px rgba(244,114,182,.26)',
        '0 10px 32px rgba(167,139,250,.18)',
        '0 3px 12px rgba(0,0,0,.06)',
        'inset 0 1.5px 0 rgba(255,255,255,1)',
      ].join(', '),
      display:'flex', alignItems:'center', gap:12,
      padding:'14px 14px',
      minWidth: 0,
    }}>
      {/* Icon */}
      <div style={{
        width:42, height:42, borderRadius:12, flexShrink:0,
        background: iconBg,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 16px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.25)',
      }}>
        {icon}
      </div>
      {/* Text */}
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{
          fontSize:9, fontWeight:700, letterSpacing:'1.6px',
          textTransform:'uppercase', color:'rgba(0,0,0,.38)',
          marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {label}
        </div>
        <div style={{
          fontSize:26, fontWeight:900, color:'#0f172a',
          lineHeight:1, letterSpacing:'-1px', marginBottom:4,
        }}>
          {value}
        </div>
        <div style={{
          fontSize:9, fontWeight:600, color:'#6366f1',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

/* ── NinoCard ────────────────────────────────────────────────────────────── */
function NinoCard({
  nino, idx, onEdit, onToggle, onDelete, onActivateAI,
}: {
  nino:          KidsNino
  idx:           number
  onEdit:        () => void
  onToggle:      () => void
  onDelete:      () => void
  onActivateAI:  () => Promise<'ok' | 'not_found' | 'error'>
}) {
  const [hov,         setHov]        = useState(false)
  const [menuOpen,    setMenuOpen]   = useState(false)
  const [imgBroken,   setImgBroken]  = useState(false)
  const [aiState,     setAiState]    = useState<'idle'|'processing'|'not_found'|'error'>('idle')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const ini   = `${nino.nombre.charAt(0)}${(nino.apellido ?? '').charAt(0)}`.toUpperCase()
  const grad  = CHILD_GRADIENTS[idx % CHILD_GRADIENTS.length]
  const grupo = nino.grupo ? (GRUPO_COLORS[nino.grupo] ?? { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb' }) : null

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:   '#fff',
        borderRadius: 20,
        padding:      '16px 14px 14px',
        boxShadow:    hov
          ? '0 8px 28px rgba(0,0,0,.12)'
          : '0 2px 12px rgba(0,0,0,.07)',
        border:     `1px solid ${hov ? 'rgba(124,58,237,.12)' : 'rgba(0,0,0,.04)'}`,
        transform:  hov ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all .2s cubic-bezier(.4,0,.2,1)',
        display:    'flex', flexDirection:'column', alignItems:'center',
        position:   'relative',
        opacity:    nino.activo ? 1 : 0.6,
      }}
    >
      {/* ··· Menu */}
      <div ref={menuRef} style={{ position:'absolute', top:12, right:12 }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            width:26, height:26, borderRadius:8, border:'none',
            background: menuOpen ? '#f3f0ff' : 'transparent',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .15s',
          }}
        >
          <span style={{ fontSize:14, color:'#9ca3af', letterSpacing:'1px', lineHeight:0.8 }}>···</span>
        </button>
        {menuOpen && (
          <div style={{
            position:'absolute', top:'100%', right:0, marginTop:4,
            background:'#fff', borderRadius:12, padding:5,
            boxShadow:'0 8px 24px rgba(0,0,0,.12)',
            border:'1px solid rgba(0,0,0,.06)',
            zIndex:30, minWidth:130,
          }}>
            <MenuOption icon="✏️" label="Editar" onClick={() => { setMenuOpen(false); onEdit() }} />
            <MenuOption
              icon={nino.activo ? '⏸️' : '▶️'}
              label={nino.activo ? 'Desactivar' : 'Activar'}
              onClick={() => { setMenuOpen(false); onToggle() }}
            />
            <div style={{ height:1, background:'#f3f4f6', margin:'4px 0' }} />
            <MenuOption icon="🗑️" label="Eliminar" onClick={() => { setMenuOpen(false); onDelete() }} danger />
          </div>
        )}
      </div>

      {/* Avatar — aro premium */}
      <div style={{
        /* ── Aro de color (ring externo) ── */
        padding:      3,
        borderRadius: '50%',
        background:   grad,
        marginBottom: 12,
        flexShrink:   0,
        boxShadow:    hov
          ? `0 0 0 2.5px rgba(255,255,255,.95), 0 6px 26px rgba(0,0,0,.16), 0 0 18px rgba(124,58,237,.28)`
          : `0 0 0 2.5px rgba(255,255,255,.88), 0 4px 16px rgba(0,0,0,.11)`,
        transition:   'box-shadow .2s cubic-bezier(.4,0,.2,1)',
        filter:       hov ? 'drop-shadow(0 0 7px rgba(124,58,237,.35))' : 'none',
      }}>
        {/* ── Separador blanco (gap) ── */}
        <div style={{
          padding:      2,
          borderRadius: '50%',
          background:   '#fff',
          display:      'flex', alignItems:'center', justifyContent:'center',
        }}>
          {/* ── Foto / iniciales ── */}
          <div style={{
            width:68, height:68, borderRadius:'50%',
            background: nino.foto_url && !imgBroken ? 'transparent' : grad,
            overflow:'hidden',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, fontWeight:800, color:'#fff',
          }}>
            {nino.foto_url && !imgBroken
              ? <img src={nino.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={() => setImgBroken(true)} />
              : ini
            }
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{
        fontSize:13, fontWeight:700, color:'#111827',
        textAlign:'center', lineHeight:1.3, marginBottom:2,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        width:'100%',
      }}>
        {nino.nombre}{nino.apellido ? ` ${nino.apellido}` : ''}
      </div>

      {/* Age */}
      {nino.edad != null && (
        <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>
          {nino.edad} {nino.edad === 1 ? 'año' : 'años'}
        </div>
      )}

      {/* Group badge — azul premium */}
      {nino.grupo && (
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         5,
          padding:     '4px 12px',
          borderRadius: 50,
          background:  'linear-gradient(135deg,rgba(59,130,246,.13) 0%,rgba(99,102,241,.10) 100%)',
          border:      '1px solid rgba(99,102,241,.30)',
          boxShadow:   '0 2px 10px rgba(99,102,241,.14), inset 0 1px 0 rgba(255,255,255,.75)',
          fontSize:    10,
          fontWeight:  700,
          color:       '#4338ca',
          marginBottom: 8,
          whiteSpace:  'nowrap',
          backdropFilter: 'blur(6px)',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="#6366f1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          {nino.grupo}
        </div>
      )}

      {/* Face descriptor indicator */}
      {nino.face_descriptor && nino.face_descriptor.length === 128 ? (
        <div style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'3px 9px', borderRadius:50, marginBottom:6,
          background:'#f0f9ff', border:'1px solid #bae6fd',
          fontSize:9, fontWeight:700, color:'#0369a1',
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          Reconocimiento IA listo
        </div>
      ) : nino.foto_url && !imgBroken ? (
        /* ── Botón "Activar IA" para niños con foto pero sin descriptor ── */
        <button
          disabled={aiState === 'processing'}
          onClick={async () => {
            setAiState('processing')
            const result = await onActivateAI()
            if (result !== 'ok') setAiState(result)
            // Si 'ok', el padre actualiza nino y este bloque desaparece solo
          }}
          style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'4px 10px', borderRadius:50, marginBottom:6,
            border:'1px solid rgba(124,58,237,.35)',
            background: aiState === 'processing'
              ? 'rgba(124,58,237,.08)'
              : aiState === 'not_found'
              ? '#fffbeb'
              : aiState === 'error'
              ? '#fef2f2'
              : 'linear-gradient(135deg,rgba(124,58,237,.10),rgba(99,102,241,.08))',
            fontSize:9, fontWeight:700,
            color: aiState === 'not_found' ? '#d97706' : aiState === 'error' ? '#dc2626' : '#7c3aed',
            cursor: aiState === 'processing' ? 'default' : 'pointer',
            transition:'all .18s',
          }}
        >
          {aiState === 'processing' ? (
            <>
              <span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⏳</span>
              Procesando…
            </>
          ) : aiState === 'not_found' ? (
            <>⚠️ Sin rostro detectado</>
          ) : aiState === 'error' ? (
            <>❌ Error — reintentar</>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Activar IA
            </>
          )}
        </button>
      ) : null}

    </div>
  )
}

/* ── MenuOption ─────────────────────────────────────────────────────────── */
function MenuOption({ icon, label, onClick, danger }: { icon:string; label:string; onClick:()=>void; danger?:boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:8,
        width:'100%', textAlign:'left',
        padding:'7px 10px', borderRadius:8, border:'none',
        fontSize:11, fontWeight:600,
        background: hov ? (danger ? '#fff1f2' : '#f9fafb') : 'transparent',
        color: danger ? '#dc2626' : '#374151',
        cursor:'pointer', transition:'all .12s',
      }}
    >
      <span style={{ fontSize:12 }}>{icon}</span>
      {label}
    </button>
  )
}

/* ── GrupoSelect — premium select ─────────────────────────────────────── */
function GrupoSelect({ value, onChange, grupos }: { value:string; onChange:(v:string)=>void; grupos:string[] }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize:9, fontWeight:800, color: focused ? '#7c3aed' : '#6b7280',
        display:'flex', alignItems:'center', gap:5, marginBottom:6,
        letterSpacing:'1px', textTransform:'uppercase' as const, transition:'color .15s' }}>
        <span style={{ width:4, height:4, borderRadius:'50%',
          background: focused ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : '#d1d5db',
          display:'inline-block', transition:'background .15s', flexShrink:0 }} />
        Grupo / Curso
      </label>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', opacity: focused ? 1 : 0.55, transition:'opacity .15s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={focused ? '#7c3aed' : '#9ca3af'} strokeWidth="2" strokeLinecap="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width:'100%', boxSizing:'border-box' as const,
            padding:'11px 36px 11px 34px',
            border: focused ? '1.5px solid rgba(124,58,237,.6)' : '1.5px solid rgba(0,0,0,.08)',
            borderRadius:12, fontSize:13, fontFamily:'inherit', outline:'none',
            background: focused ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.7)',
            backdropFilter:'blur(12px)',
            color: value ? '#111827' : '#9ca3af',
            appearance:'none' as const, cursor:'pointer', fontWeight: 500,
            boxShadow: focused
              ? '0 0 0 3.5px rgba(124,58,237,.12), 0 4px 12px rgba(0,0,0,.06)'
              : '0 1px 4px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.9)',
            transition:'border-color .18s, box-shadow .18s, background .18s',
          }}
        >
          <option value="">Seleccionar grupo</option>
          {grupos.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <div style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', opacity: focused ? 1 : 0.5, transition:'opacity .15s' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={focused ? '#7c3aed' : '#9ca3af'} strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

/* ── ObsTextarea — premium textarea ────────────────────────────────────── */
function ObsTextarea({ value, onChange, isMobile }: { value:string; onChange:(v:string)=>void; isMobile:boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize:9, fontWeight:800, color: focused ? '#7c3aed' : '#6b7280',
        display:'flex', alignItems:'center', gap:5, marginBottom:6,
        letterSpacing:'1px', textTransform:'uppercase' as const, transition:'color .15s' }}>
        <span style={{ width:4, height:4, borderRadius:'50%',
          background: focused ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : '#d1d5db',
          display:'inline-block', transition:'background .15s', flexShrink:0 }} />
        Observaciones
      </label>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:13, top:13, pointerEvents:'none', opacity: focused ? 1 : 0.55, transition:'opacity .15s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={focused ? '#7c3aed' : '#9ca3af'} strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <textarea
          placeholder="Información adicional..."
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={isMobile ? 2 : 3}
          style={{
            width:'100%', boxSizing:'border-box' as const,
            padding:'11px 14px 11px 34px',
            border: focused ? '1.5px solid rgba(124,58,237,.6)' : '1.5px solid rgba(0,0,0,.08)',
            borderRadius:12, fontSize:13, fontFamily:'inherit', outline:'none',
            background: focused ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.7)',
            backdropFilter:'blur(12px)',
            resize:'vertical' as const, lineHeight:1.6, fontWeight:500,
            boxShadow: focused
              ? '0 0 0 3.5px rgba(124,58,237,.12), 0 4px 12px rgba(0,0,0,.06)'
              : '0 1px 4px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.9)',
            transition:'border-color .18s, box-shadow .18s, background .18s',
            color:'#111827',
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

/* ── NinoField — text input with icon ──────────────────────────────────── */
function NinoField({
  label, icon, placeholder, value, onChange, type, inputMode,
}: {
  label:       string
  icon:        React.ReactNode
  placeholder: string
  value:       string
  onChange:    (v: string) => void
  type?:       string
  inputMode?:  React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize:9, fontWeight:800, color: focused ? '#7c3aed' : '#6b7280',
        display:'flex', alignItems:'center', gap:5, marginBottom:6,
        letterSpacing:'1px', textTransform:'uppercase' as const,
        transition:'color .15s' }}>
        <span style={{ width:4, height:4, borderRadius:'50%',
          background: focused ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : '#d1d5db',
          display:'inline-block', transition:'background .15s', flexShrink:0 }} />
        {label}
      </label>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none',
          opacity: focused ? 1 : 0.55, transition:'opacity .15s' }}>
          {icon}
        </div>
        <input
          type={type ?? 'text'}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={()  => setFocused(false)}
          style={{
            width:'100%', boxSizing:'border-box' as const,
            padding:'11px 14px 11px 34px',
            border: focused
              ? '1.5px solid rgba(124,58,237,.6)'
              : '1.5px solid rgba(0,0,0,.08)',
            borderRadius:12, fontSize:13,
            fontFamily:'inherit', outline:'none',
            background: focused ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(12px)',
            boxShadow: focused
              ? '0 0 0 3.5px rgba(124,58,237,.12), 0 4px 12px rgba(0,0,0,.06)'
              : '0 1px 4px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.9)',
            transition:'border-color .18s, box-shadow .18s, background .18s',
            color: '#111827',
            fontWeight: 500,
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

/* ── UserAvatar ─────────────────────────────────────────────────────────── */
function UserAvatar({ usuario }: { usuario: { nombre:string; apellido:string; foto_url:string|null } }) {
  const [broken, setBroken] = useState(false)
  const ini = `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
  const showImg = usuario.foto_url && !broken
  return (
    <div style={{
      width:28, height:28, borderRadius:'50%',
      background: showImg ? 'transparent' : 'linear-gradient(135deg,#0d9488,#0891b2)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:10, fontWeight:800, color:'#fff',
      overflow:'hidden', flexShrink:0,
    }}>
      {showImg
        ? <img src={usuario.foto_url!} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
            onError={() => setBroken(true)} />
        : ini
      }
    </div>
  )
}

/* ── Button3DGreen — Botón animado tipo 3D con efecto "hundido" al presionar ── */
function Button3DGreen({
  onClick, disabled, saving, label, compact,
}: {
  onClick:  () => void
  disabled: boolean
  saving:   boolean
  label:    string
  compact?: boolean
}) {
  const [pressed, setPressed] = useState(false)
  const isDown = pressed && !disabled

  return (
    <div
      style={{ marginTop: compact ? 12 : 18, userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={()   => setPressed(false)}
      onMouseLeave={()=> setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={()  => setPressed(false)}
      onClick={!disabled ? onClick : undefined}
    >
      {/* ── Anillo metálico exterior ── */}
      <div style={{
        borderRadius:  50,
        padding:       compact ? 3 : 5,
        background:    saving
          ? 'linear-gradient(180deg,#d1d5db 0%,#9ca3af 50%,#c4c4c4 100%)'
          : 'linear-gradient(175deg,#e8e8e8 0%,#a8a8a8 42%,#bebebe 58%,#e0e0e0 100%)',
        boxShadow:     isDown
          ? '0 2px 6px rgba(0,0,0,.4), inset 0 3px 6px rgba(0,0,0,.25)'
          : '0 10px 26px rgba(0,0,0,.32), 0 4px 8px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.9)',
        transform:     isDown ? 'translateY(5px) scale(0.985)' : 'translateY(0) scale(1)',
        transition:    'transform .09s ease, box-shadow .09s ease',
        cursor:        disabled ? 'default' : 'pointer',
      }}>
        {/* ── Domo verde interior ── */}
        <div style={{
          borderRadius: compact ? 40 : 44,
          padding:      compact ? '9px 0' : '15px 0',
          background:   saving
            ? 'linear-gradient(180deg,#9ca3af 0%,#6b7280 100%)'
            : isDown
              ? 'linear-gradient(180deg,#14532d 0%,#166534 30%,#15803d 70%,#16a34a 100%)'
              : 'linear-gradient(175deg,#4ade80 0%,#22c55e 18%,#16a34a 55%,#15803d 80%,#14532d 100%)',
          position:     'relative',
          overflow:     'hidden',
          boxShadow:    isDown
            ? 'inset 0 8px 20px rgba(0,0,0,.45), inset 0 3px 6px rgba(0,0,0,.3)'
            : 'inset 0 -8px 18px rgba(0,0,0,.22), inset 0 3px 6px rgba(255,255,255,.18)',
          display:      'flex',
          alignItems:   'center',
          justifyContent:'center',
          gap:           8,
          transition:   'background .09s, box-shadow .09s',
        }}>

          {/* Reflejo superior (brillo domo) */}
          {!isDown && !saving && (
            <div style={{
              position:     'absolute',
              top:           4,
              left:          '8%',
              width:         '84%',
              height:        '48%',
              borderRadius: '50%',
              background:   'linear-gradient(180deg,rgba(255,255,255,.60) 0%,rgba(255,255,255,.03) 100%)',
              pointerEvents:'none',
            }} />
          )}

          {/* Reflejo inferior sutil */}
          {!isDown && !saving && (
            <div style={{
              position:     'absolute',
              bottom:        5,
              left:          '22%',
              width:         '56%',
              height:        '18%',
              borderRadius: '50%',
              background:   'radial-gradient(ellipse,rgba(255,255,255,.28) 0%,rgba(255,255,255,0) 100%)',
              pointerEvents:'none',
            }} />
          )}

          {/* Ícono guardar */}
          {!saving && (
            <svg
              width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 24 24"
              fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
              style={{ position:'relative', zIndex:1, filter:'drop-shadow(0 1px 3px rgba(0,0,0,.35))',
                       transform: isDown ? 'translateY(1px)' : 'none', transition:'transform .09s' }}
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          )}

          {/* Texto */}
          <span style={{
            fontSize:    compact ? 11 : 14,
            fontWeight:  800,
            color:       '#fff',
            letterSpacing: compact ? '0.3px' : '0.6px',
            textShadow: '0 1px 5px rgba(0,0,0,.45)',
            position:    'relative',
            zIndex:       1,
            transform:   isDown ? 'translateY(1px)' : 'translateY(0)',
            transition:  'transform .09s',
            textTransform:'uppercase' as const,
          }}>
            {saving ? 'Guardando…' : label}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── FaceStatusBadge ────────────────────────────────────────────────────── */
function FaceStatusBadge({ status }: { status: FaceStatus }) {
  if (status === 'idle') return null

  const configs: Record<FaceStatus, { icon: string; text: string; bg: string; color: string; border: string }> = {
    idle:           { icon: '',   text: '',                            bg: 'transparent', color: '#9ca3af', border: 'transparent' },
    loading_models: { icon: '⏳', text: 'Cargando modelos de IA…',    bg: '#f0f9ff',     color: '#0369a1', border: '#bae6fd' },
    detecting:      { icon: '🔍', text: 'Detectando rostro…',         bg: '#faf5ff',     color: '#7c3aed', border: '#ddd6fe' },
    found:          { icon: '✅', text: 'Rostro detectado',            bg: '#f0fdf4',     color: '#16a34a', border: '#bbf7d0' },
    not_found:      { icon: '⚠️', text: 'No se detectó un rostro',    bg: '#fffbeb',     color: '#d97706', border: '#fde68a' },
    error:          { icon: '❌', text: 'Error al procesar la foto',   bg: '#fef2f2',     color: '#dc2626', border: '#fecaca' },
  }

  const cfg = configs[status]
  if (!cfg.text) return null

  return (
    <div style={{
      marginTop: 8,
      padding: '6px 12px',
      borderRadius: 50,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      letterSpacing: '0.2px',
    }}>
      <span>{cfg.icon}</span>
      {cfg.text}
    </div>
  )
}

/* ── DraggablePhotoCircle ───────────────────────────────────────────────── */
function DraggablePhotoCircle({
  src,
  size,
  onCrop,
}: {
  src:    string
  size:   number
  onCrop: (url: string) => void
}) {
  const imgRef    = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  // Display dimensions: scaled so the shorter side fills the circle exactly
  const [imgSize, setImgSize] = useState({ w: size, h: size })
  // Current drag offset (top-left corner of the image relative to circle origin)
  const [offset, setOffset]   = useState({ x: 0, y: 0 })

  // Recalculate scale when src changes
  useEffect(() => {
    setOffset({ x: 0, y: 0 })
    setImgSize({ w: size, h: size })
  }, [src, size])

  function handleLoad() {
    const img = imgRef.current
    if (!img) return
    const { naturalWidth: nw, naturalHeight: nh } = img
    const scale = Math.max(size / nw, size / nh)
    const w = Math.round(nw * scale)
    const h = Math.round(nh * scale)
    const ox = -Math.round((w - size) / 2)
    const oy = -Math.round((h - size) / 2)
    setImgSize({ w, h })
    setOffset({ x: ox, y: oy })
    cropAndEmit(ox, oy, w, h)  // actualiza preview visual del círculo
  }

  function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val))
  }

  // Renderiza el crop en alta resolución (400×400) aunque el círculo sea de 90px
  function cropAndEmit(ox: number, oy: number, iw: number, ih: number) {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img) return
    const OUT    = 400                    // resolución de salida
    const ratio  = OUT / size             // factor de escala display→salida
    canvas.width  = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, ox * ratio, oy * ratio, iw * ratio, ih * ratio)
    onCrop(canvas.toDataURL('image/jpeg', 0.88))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    const { px, py, ox, oy } = dragStart.current
    const newX = clamp(ox + (e.clientX - px), -(imgSize.w - size), 0)
    const newY = clamp(oy + (e.clientY - py), -(imgSize.h - size), 0)
    setOffset({ x: newX, y: newY })
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    const { px, py, ox, oy } = dragStart.current
    dragStart.current = null
    const finalX = clamp(ox + (e.clientX - px), -(imgSize.w - size), 0)
    const finalY = clamp(oy + (e.clientY - py), -(imgSize.h - size), 0)
    setOffset({ x: finalX, y: finalY })
    cropAndEmit(finalX, finalY, imgSize.w, imgSize.h)
  }

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          overflow:     'hidden',
          position:     'relative',
          cursor:       'grab',
          userSelect:   'none',
          touchAction:  'none',
          border:       '3px solid #7c3aed',
          boxShadow:    '0 4px 14px rgba(124,58,237,.35)',
          flexShrink:   0,
        } as React.CSSProperties}
      >
        <img
          ref={imgRef}
          src={src}
          alt="preview"
          onLoad={handleLoad}
          draggable={false}
          style={{
            position:      'absolute',
            left:          offset.x,
            top:           offset.y,
            width:         imgSize.w,
            height:        imgSize.h,
            pointerEvents: 'none',
            userSelect:    'none',
          } as React.CSSProperties}
        />
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}
