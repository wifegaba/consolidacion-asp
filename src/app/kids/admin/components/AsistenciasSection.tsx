'use client'

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import {
  loadFaceModels,
  faceDistance,
  detectFacesRobust,
  prepareFaceImage,
  FACE_MATCH_THRESHOLD,
  FACE_MATCH_STRICT_THRESHOLD,
  FACE_MATCH_MIN_MARGIN,
} from '@/lib/faceRecognition'
import { type KidsNino } from './NinosSection'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AsistenciaRecord {
  id:             string
  nino_id:        string
  fecha:          string
  hora:           string
  metodo:         string
  registrado_por: string | null
  nino: KidsNino
}

type Mode    = 'camera' | 'processing' | 'matched' | 'no_match' | 'already'
type TabView = 'registrar' | 'latest' | 'historial'
type RecognitionSource = 'camera' | 'upload'
type NinoWithDescriptor = KidsNino & { face_descriptor: number[] }

/* ── Helpers de zona horaria Colombia (UTC-5) ── */
function getColombiaTodayDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
function formatColombiaTime(fechaStr: string, horaStr: string): { hora12: string; esMismoDia: boolean; fechaLabel: string } {
  // horaStr viene como "HH:MM:SS" desde la DB (ya guardada en Colombia)
  const raw = (horaStr ?? '').slice(0, 5)
  const hora12 = (() => {
    if (!raw) return ''
    const [h, m] = raw.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  })()
  const hoy = getColombiaTodayDate()
  const esMismoDia = fechaStr === hoy
  const fechaLabel = esMismoDia ? 'Hoy' : new Intl.DateTimeFormat('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota',
  }).format(new Date(fechaStr + 'T12:00:00'))
  return { hora12, esMismoDia, fechaLabel }
}

interface FaceMatch {
  nino:    NinoWithDescriptor
  dist:    number
  already: boolean
}

const GRUPO_COLORS: Record<string, string> = {
  'Semillitas':  '#f59e0b',
  'Exploradores':'#3b82f6',
  'Junior':      '#8b5cf6',
}
const GRUPOS = ['Semillitas', 'Exploradores', 'Junior']

/* ════════════════════════════════════════════════════════════════════════
   AsistenciasSection
════════════════════════════════════════════════════════════════════════ */
export default function AsistenciasSection({
  usuario,
}: {
  usuario: { nombre: string; apellido: string } | null
}) {
  /* ── refs ── */
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const cameraRequestRef = useRef(0)
  const imageInputRef = useRef<HTMLInputElement>(null)

  /* ── state ── */
  const [activeTab,      setActiveTab]     = useState<TabView>('registrar')
  const [mode,           setMode]          = useState<Mode>('camera')
  const [capturedUrl,    setCapturedUrl]   = useState<string | null>(null)
  const [multiMatches,   setMultiMatches]  = useState<FaceMatch[]>([])
  const [allNinos,       setAllNinos]      = useState<NinoWithDescriptor[]>([])
  const [todayRecords,   setTodayRecords]  = useState<AsistenciaRecord[]>([])
  const [statusMsg,      setStatusMsg]     = useState('')
  const [saving,         setSaving]        = useState(false)
  const [saveError,      setSaveError]     = useState('')
  const [cameraErr,      setCameraErr]     = useState('')
  const [modelsReady,    setModelsReady]   = useState(false)
  const [recognitionSource, setRecognitionSource] = useState<RecognitionSource>('camera')
  const [imageError,     setImageError]     = useState('')
  const [isMobile,       setIsMobile]      = useState(false)
  const [facingMode,     setFacingMode]    = useState<'user' | 'environment'>('environment')
  const [cameraFullscreen, setCameraFullscreen] = useState(false)
  const [successMsg,     setSuccessMsg]    = useState('')
  const [isCompact,      setIsCompact]     = useState(false)
  /* ── Historial state ── */
  const [histDate,       setHistDate]      = useState('')   // vacío = mostrar últimas
  const [histGrupo,      setHistGrupo]     = useState('')
  const [histRecords,    setHistRecords]   = useState<AsistenciaRecord[]>([])
  const [histLoading,    setHistLoading]   = useState(false)
  /* ── Últimas asistencias (panel derecho) ── */
  const [latestRecords,  setLatestRecords] = useState<AsistenciaRecord[]>([])
  const [latestLoading,  setLatestLoading] = useState(false)

  /* ── responsive ── */
  useEffect(() => {
    const check = () => {
      const width = window.innerWidth
      setIsMobile(width < 980)
      setIsCompact(width < 1600)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── cargar modelos ── */
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsReady(false))
  }, [])

  /* ── cargar niños con descriptor ── */
  useEffect(() => {
    fetch('/api/kids/ninos')
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          const withDesc = (j.data as KidsNino[]).filter(n => n.face_descriptor && Array.isArray(n.face_descriptor) && n.face_descriptor.length > 0) as NinoWithDescriptor[]
          setAllNinos(withDesc)
        }
      })
      .catch(() => {})
  }, [])

  /* ── cargar asistencias de hoy (para verificar duplicados en reconocimiento) ── */
  const loadToday = useCallback(async () => {
    try {
      const res  = await fetch('/api/kids/asistencias')
      const json = await res.json()
      if (json.ok) setTodayRecords(json.data)
    } catch {}
  }, [])

  /* ── cargar últimas asistencias (panel lateral + historial sin fecha) ── */
  const loadLatest = useCallback(async (grupo = '') => {
    setLatestLoading(true)
    try {
      const params = new URLSearchParams({ latest: '60' })
      if (grupo) params.set('grupo', grupo)
      const res  = await fetch(`/api/kids/asistencias?${params}`)
      const json = await res.json()
      if (json.ok) setLatestRecords(json.data)
    } catch {}
    setLatestLoading(false)
  }, [])

  useEffect(() => { loadToday(); loadLatest() }, [loadToday, loadLatest])

  /* ── cargar historial por fecha específica ── */
  const loadHistorial = useCallback(async (fecha: string, grupo: string) => {
    setHistLoading(true)
    try {
      const params = new URLSearchParams({ fecha })
      if (grupo) params.set('grupo', grupo)
      const res  = await fetch(`/api/kids/asistencias?${params}`)
      const json = await res.json()
      if (json.ok) setHistRecords(json.data)
    } catch {}
    setHistLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab !== 'historial') return
    if (histDate) loadHistorial(histDate, histGrupo)
    else          loadLatest(histGrupo)
  }, [activeTab, histDate, histGrupo, loadHistorial, loadLatest])

  /* ── iniciar cámara ── */
  const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    const requestId = ++cameraRequestRef.current
    setCameraErr('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraErr('La cámara no está disponible en este navegador.')
      return
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: facing } }, audio: false },
      { video: true, audio: false },
    ]

    let lastError: unknown
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (requestId !== cameraRequestRef.current) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        return
      } catch (error) {
        lastError = error
      }
    }

    if (requestId !== cameraRequestRef.current) return
    const reason = lastError instanceof DOMException && lastError.name === 'NotAllowedError'
      ? 'Permite el acceso a la cámara desde el navegador y vuelve a intentarlo.'
      : 'No se pudo abrir la cámara. Verifica los permisos e inténtalo de nuevo.'
    setCameraErr(reason)
  }, [facingMode])

  useEffect(() => {
    if (mode === 'camera' && activeTab === 'registrar') startCamera(facingMode)
    return () => {
      cameraRequestRef.current += 1
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [mode, facingMode, startCamera, activeTab])

  useEffect(() => {
    if (!isMobile && activeTab === 'latest') setActiveTab('registrar')
  }, [isMobile, activeTab])

  /* ── capturar foto ── */
  async function handleCapture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Si cámara frontal, voltear horizontalmente
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.96)
    setCameraFullscreen(false)
    setRecognitionSource('camera')
    setImageError('')
    setCapturedUrl(dataUrl)

    // Detener cámara
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    setMode('processing')
    setStatusMsg('Detectando rostros…')
    await analyzeFace(dataUrl, 'camera')
  }

  /* ── cargar una fotografía y procesarla con el mismo motor de la cámara ── */
  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImageError('')
    setSaveError('')
    setCameraFullscreen(false)
    setRecognitionSource('upload')

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    try {
      setMode('processing')
      setStatusMsg('Preparando imagen…')
      const prepared = await prepareFaceImage(file)
      setCapturedUrl(prepared.dataUrl)
      setStatusMsg('Validando calidad y buscando rostros…')
      await analyzeFace(prepared.dataUrl, 'upload')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible procesar la imagen.'
      setCapturedUrl(null)
      setImageError(message)
      setMode('camera')
    }
  }

  /* ── analizar rostros (multi-face) ── */
  async function analyzeFace(dataUrl: string, source: RecognitionSource) {
    if (!modelsReady) {
      setStatusMsg('Cargando modelos de IA…')
      try { await loadFaceModels() } catch {
        setStatusMsg('Modelos no disponibles.')
        setTimeout(() => resetCamera(), 2000)
        return
      }
    }

    if (allNinos.length === 0) {
      setStatusMsg('⚠️ No hay niños con foto registrada en la base de datos')
      setTimeout(() => setMode('no_match'), 2000)
      return
    }

    try {
      setStatusMsg('Analizando rostros…')

      // Detección robusta multi-rostro: mejora de imagen + busca TODAS las caras (hasta 5+)
      const result = await detectFacesRobust(
        dataUrl,
        msg => setStatusMsg(msg),
        true,
        source === 'upload',
      )
      const descriptors = result.descriptors

      console.log(`[analyzeFace] ${result.detail} | intento #${result.attempt} | mejorada=${result.enhanced} | niños en BD:`, allNinos.length)

      if (descriptors.length === 0) {
        setStatusMsg(`Sin rostros detectados (${allNinos.length} niños en BD)`)
        setTimeout(() => setMode('no_match'), 1500)
        return
      }

      setStatusMsg(`${descriptors.length} rostro${descriptors.length > 1 ? 's' : ''} detectado${descriptors.length > 1 ? 's' : ''}… comparando…`)

      // Para cada rostro detectado, buscar el mejor match sin repetir niños
      const usedIds = new Set<string>()
      const matches: FaceMatch[] = []

      for (const det of descriptors) {
        const desc = Array.from(det)
        let bestNino: NinoWithDescriptor | null = null
        let bestDist = Infinity
        let secondDist = Infinity

        for (const nino of allNinos) {
          if (usedIds.has(nino.id)) continue
          const d = faceDistance(desc, nino.face_descriptor)
          if (d < bestDist) { secondDist = bestDist; bestDist = d; bestNino = nino }
          else if (d < secondDist) { secondDist = d }
        }

        // Margen: el mejor debe destacar sobre el segundo para evitar confusiones
        const margin = secondDist - bestDist
        console.log(`  rostro → ${bestNino?.nombre ?? '?'} dist=${bestDist.toFixed(3)} (2º=${secondDist === Infinity ? '∞' : secondDist.toFixed(3)}, margen=${margin === Infinity ? '∞' : margin.toFixed(3)})`)

        const hasClearLead =
          secondDist === Infinity ||
          bestDist <= FACE_MATCH_STRICT_THRESHOLD ||
          margin >= FACE_MATCH_MIN_MARGIN

        if (bestNino && bestDist < FACE_MATCH_THRESHOLD && hasClearLead) {
          usedIds.add(bestNino.id)
          const already = todayRecords.some(r => r.nino_id === bestNino!.id)
          matches.push({ nino: bestNino, dist: bestDist, already })
        }
      }

      console.log('[analyzeFace] matches encontrados:', matches.length)

      if (matches.length === 0) {
        setMode('no_match')
        return
      }

      setMultiMatches(matches)
      const allAlready = matches.every(m => m.already)
      setMode(allAlready ? 'already' : 'matched')

    } catch (e: any) {
      console.error('[analyzeFace]', e.message)
      setMode('no_match')
    }
  }

  /* ── registrar una asistencia (un solo niño) ── */
  async function handleRegister(
    nino: KidsNino,
    metodo = recognitionSource === 'upload' ? 'imagen_facial' : 'facial',
  ) {
    setSaving(true)
    setSaveError('')
    try {
      const res  = await fetch('/api/kids/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nino_id:        nino.id,
          metodo,
          registrado_por: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setSuccessMsg(`✅ ${nino.nombre} ${nino.apellido ?? ''} registrado`)
        await Promise.all([loadToday(), loadLatest()])
        setTimeout(() => { setSuccessMsg(''); resetCamera() }, 2200)
      } else {
        setSaveError(json.error ?? 'Error al registrar.')
      }
    } catch (e: any) {
      setSaveError('Error de conexión: ' + (e.message ?? ''))
    }
    setSaving(false)
  }

  /* ── registrar todos los matches nuevos (grupal) ── */
  async function handleRegisterAll(seleccion?: FaceMatch[]) {
    // Si llega selección explícita, usar esa; si no, todos los nuevos
    const nuevos = (seleccion ?? multiMatches).filter(m => !m.already)
    if (nuevos.length === 0) return
    setSaving(true)
    setSaveError('')
    try {
      const results = await Promise.all(
        nuevos.map(m =>
          fetch('/api/kids/asistencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nino_id:        m.nino.id,
              metodo: recognitionSource === 'upload' ? 'imagen_facial_grupal' : 'facial_grupal',
              registrado_por: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
            }),
          }).then(r => r.json())
        )
      )
      const errors = results.filter(r => !r.ok && !r.already)
      if (errors.length > 0) {
        setSaveError(`${errors.length} registro(s) fallaron.`)
      } else {
        const n = nuevos.length
        setSuccessMsg(`✅ ${n} niño${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''} correctamente`)
        await Promise.all([loadToday(), loadLatest()])
        setTimeout(() => { setSuccessMsg(''); resetCamera() }, 2500)
      }
    } catch (e: any) {
      setSaveError('Error de conexión: ' + (e.message ?? ''))
    }
    setSaving(false)
  }

  /* ── registro manual (sin rostro conocido) ── */
  async function handleManualRegister(nino: KidsNino) {
    await handleRegister(nino, 'manual')
  }

  function resetCamera() {
    setCapturedUrl(null)
    setMultiMatches([])
    setStatusMsg('')
    setImageError('')
    setRecognitionSource('camera')
    setMode('camera')
  }

  function switchCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
  }

  /* ── Fecha de hoy en Colombia ── */
  const today = new Intl.DateTimeFormat('es-CO', {
    weekday:'long', day:'numeric', month:'long', timeZone:'America/Bogota',
  }).format(new Date())
  const todayCount = todayRecords.length
  const navigationTabs: Array<{
    key: TabView
    label: string
    icon: 'camera' | 'latest' | 'history'
  }> = isMobile
    ? [
        { key:'registrar', label:'Registrar', icon:'camera' },
        { key:'latest', label:'Últimas', icon:'latest' },
        { key:'historial', label:'Historial', icon:'history' },
      ]
    : [
        { key:'registrar', label:'Registrar', icon:'camera' },
        { key:'historial', label:'Historial', icon:'history' },
      ]

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      flex:1, minHeight:0, display:'flex', flexDirection:'column',
      overflow:'hidden', background:'transparent',
      paddingBottom: isMobile ? 56 : 0,
    }}>
      {/* ── Toast de éxito ── */}
      {successMsg && (
        <div style={{
          position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
          zIndex:999, background:'linear-gradient(135deg,#10b981,#059669)',
          color:'#fff', padding:'12px 28px', borderRadius:50, fontSize:13, fontWeight:700,
          boxShadow:'0 8px 32px rgba(16,185,129,.45)', animation:'coordFadeIn .3s both',
          whiteSpace:'nowrap',
        }}>
          {successMsg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        padding: isMobile ? '9px 12px 10px' : '7px 18px',
        flexShrink:0, borderBottom:'1px solid rgba(255,255,255,.38)',
        background:'linear-gradient(135deg,rgba(255,255,255,.48),rgba(226,232,240,.16))',
        backdropFilter:'blur(24px) saturate(145%)',
        WebkitBackdropFilter:'blur(24px) saturate(145%)',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,.62), 0 8px 24px rgba(15,23,42,.04)',
        display:'flex',
        flexDirection:isMobile ? 'column' : 'row',
        alignItems:isMobile ? 'stretch' : 'center',
        gap:isMobile ? 9 : 14,
      }}>
        {/* Top row: título + counter */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, paddingBottom:isMobile ? 3 : 0, flex:1, minWidth:0 }}>
          <div>
            <div style={{ fontSize:isMobile ? 8 : 7, fontWeight:750, color:'#0d9488', letterSpacing:'1.4px', textTransform:'uppercase', marginBottom:0 }}>
              Módulo Kids
            </div>
            <div className="kids-panel-title" style={{ fontSize:isMobile ? 17 : 18, lineHeight:1.05, fontWeight:850, color:'#0f172a', letterSpacing:'-0.4px' }}>
              Asistencias
            </div>
            <div style={{ fontSize:isMobile ? 8 : 7.5, color:'#6b7280', marginTop:1, textTransform:'capitalize', whiteSpace:'nowrap' }}>{today}</div>
          </div>
          {!isMobile && (
            <div style={{
              display:'flex', alignItems:'center', gap:5, flexShrink:0,
              background:'linear-gradient(135deg,rgba(16,185,129,.12),rgba(5,150,105,.08))',
              border:'1px solid rgba(16,185,129,.25)', borderRadius:11, padding:'5px 9px',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,.7)',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:15, fontWeight:900, color:'#059669', lineHeight:1 }}>{todayCount}</div>
                <div style={{ fontSize:6.5, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.8px' }}>Hoy</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Navegación Liquid Glass ── */}
        <div className="attendance-tabs-shell" style={{
          display:'flex', gap:isMobile ? 4 : 3, flexShrink:0,
          width:isMobile ? '100%' : 'auto',
          alignSelf:isMobile ? 'stretch' : 'center',
          padding:isMobile ? 4 : 3,
          borderRadius:16,
          background:'linear-gradient(145deg,rgba(255,255,255,.44),rgba(255,255,255,.16))',
          border:'1px solid rgba(255,255,255,.58)',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.72), inset 0 -1px 0 rgba(15,23,42,.04), 0 7px 20px rgba(15,23,42,.08)',
          backdropFilter:'blur(18px) saturate(150%)',
          WebkitBackdropFilter:'blur(18px) saturate(150%)',
        }}>
          {navigationTabs.map(tab => {
            const active = activeTab === tab.key
            return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`attendance-tab-button${active ? ' is-active' : ''}`}
              aria-pressed={active}
              style={{
                flex:isMobile ? 1 : 'none',
                minWidth:isMobile ? 0 : 86,
                minHeight:isMobile ? 38 : 32,
                padding:isMobile ? '7px 8px' : '6px 11px',
                border:`1px solid ${active ? 'rgba(255,255,255,.82)' : 'transparent'}`,
                cursor:'pointer', borderRadius:12,
                background:active
                  ? 'linear-gradient(145deg,rgba(255,255,255,.94),rgba(240,253,250,.68))'
                  : 'transparent',
                color:active ? '#0f766e' : '#64748b',
                boxShadow:active
                  ? '0 5px 14px rgba(13,148,136,.13), inset 0 1px 0 #fff, inset 0 -1px 0 rgba(13,148,136,.08)'
                  : 'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                gap:isMobile ? 6 : 5,
                fontSize:isMobile ? 10 : 9, fontWeight:800,
                letterSpacing:'-.08px',
              }}
            >
              <span style={{
                width:isMobile ? 22 : 19, height:isMobile ? 22 : 19,
                borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center',
                background:active ? 'rgba(13,148,136,.1)' : 'rgba(100,116,139,.07)',
                color:active ? '#0d9488' : '#64748b', flexShrink:0,
              }}>
                {tab.icon === 'camera' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z"/>
                    <circle cx="12" cy="13" r="3.5"/>
                  </svg>
                )}
                {tab.icon === 'latest' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 2"/>
                  </svg>
                )}
                {tab.icon === 'history' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="5" width="16" height="16" rx="2"/>
                    <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>
                  </svg>
                )}
              </span>
              <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tab.label}</span>
              {tab.key === 'latest' && isMobile && todayCount > 0 && (
                <span style={{
                  minWidth:17, height:17, padding:'0 4px', borderRadius:50,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  background:active ? '#0d9488' : 'rgba(100,116,139,.12)',
                  color:active ? '#fff' : '#64748b', fontSize:8, fontWeight:900,
                }}>{todayCount}</span>
              )}
            </button>
          )})}
        </div>
        <style>{`
          .attendance-tab-button {
            transition: transform .22s cubic-bezier(.2,.8,.2,1), background .2s ease, box-shadow .2s ease, color .2s ease;
          }
          .attendance-tab-button:not(.is-active):hover {
            background: rgba(255,255,255,.38) !important;
            color: #334155 !important;
            transform: translateY(-1px);
          }
          .attendance-tab-button:active {
            transform: scale(.97);
            box-shadow: inset 0 2px 5px rgba(15,23,42,.09) !important;
          }
        `}</style>
      </div>

      {/* ── ÚLTIMAS: pestaña independiente únicamente en responsive ── */}
      {activeTab === 'latest' && isMobile && (
        <div style={{
          flex:1, minHeight:0, overflow:'hidden', padding:'10px 12px 12px',
          background:'linear-gradient(145deg,rgba(255,255,255,.16),rgba(207,250,254,.08))',
        }}>
          <div style={{
            width:'100%', height:'100%', overflow:'hidden', borderRadius:20,
            border:'1px solid rgba(255,255,255,.58)',
            boxShadow:'0 16px 40px rgba(15,23,42,.1), inset 0 1px 0 rgba(255,255,255,.7)',
          }}>
            <LatestPanel
              records={latestRecords}
              loading={latestLoading}
              todayCount={todayCount}
              isMobile={isMobile}
              isCompact={isCompact}
              onRefresh={() => { loadToday(); loadLatest() }}
            />
          </div>
        </div>
      )}

      {/* ── PANEL HISTORIAL ── */}
      {activeTab === 'historial' && (
        <div style={{
          flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden',
          background:'linear-gradient(145deg,rgba(248,250,252,.66),rgba(236,254,255,.28))',
          backdropFilter:'blur(18px) saturate(135%)',
          WebkitBackdropFilter:'blur(18px) saturate(135%)',
        }}>

          {/* ── Cabecera ── */}
          <div style={{
            padding: isMobile ? '12px 14px 10px' : '14px 20px 10px',
            borderBottom:'1px solid rgba(0,0,0,.06)',
            background:'linear-gradient(135deg,rgba(255,255,255,.72),rgba(241,245,249,.34))',
            backdropFilter:'blur(18px) saturate(140%)',
            WebkitBackdropFilter:'blur(18px) saturate(140%)',
            flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{
                  width:32, height:32, borderRadius:10,
                  background:'linear-gradient(135deg,#0d9488,#0891b2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 3px 10px rgba(13,148,136,.35)', flexShrink:0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', lineHeight:1 }}>
                    {histDate ? 'Asistencias del día' : 'Últimas asistencias'}
                  </div>
                  <div style={{ fontSize:9, color:'#6b7280', marginTop:2, fontWeight:600 }}>
                    {histDate ? new Date(histDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' }) : 'Más recientes primero'}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {/* Contador */}
                <div style={{
                  background:'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))',
                  border:'1px solid rgba(13,148,136,.22)', borderRadius:10,
                  padding:'4px 10px', textAlign:'center',
                }}>
                  <span style={{ fontSize:16, fontWeight:900, color:'#0d9488', lineHeight:1, display:'block' }}>
                    {(histDate ? histLoading : latestLoading) ? '…' : (histDate ? histRecords : latestRecords).length}
                  </span>
                  <span style={{ fontSize:8, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    {histDate ? 'ese día' : 'recientes'}
                  </span>
                </div>
                {/* Refresh */}
                <button
                  onClick={() => histDate ? loadHistorial(histDate, histGrupo) : loadLatest(histGrupo)}
                  style={{
                    width:32, height:32, borderRadius:9, border:'1px solid rgba(0,0,0,.08)',
                    background:'rgba(255,255,255,.9)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 1px 4px rgba(0,0,0,.06)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
              {/* Date picker */}
              <div style={{ display:'flex', alignItems:'center', gap:5, position:'relative' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <input
                  type="date"
                  value={histDate}
                  onChange={e => setHistDate(e.target.value)}
                  style={{
                    padding:'5px 9px', borderRadius:8,
                    border: histDate ? '1.5px solid rgba(13,148,136,.45)' : '1.5px solid #e5e7eb',
                    fontSize:11, fontWeight:600,
                    color: histDate ? '#0d9488' : '#9ca3af',
                    outline:'none', background:'rgba(255,255,255,.9)',
                  }}
                />
                {histDate && (
                  <button
                    onClick={() => setHistDate('')}
                    title="Ver últimas"
                    style={{
                      position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer',
                      color:'#9ca3af', fontSize:14, lineHeight:1, padding:0,
                    }}
                  >×</button>
                )}
              </div>

              {/* Grupo */}
              <select
                value={histGrupo}
                onChange={e => setHistGrupo(e.target.value)}
                style={{
                  padding:'5px 9px', borderRadius:8, border:'1.5px solid #e5e7eb',
                  fontSize:11, fontWeight:600, color:'#374151', outline:'none',
                  background:'rgba(255,255,255,.9)',
                }}
              >
                <option value="">Todos los grupos</option>
                {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>

              {/* Chip: "sin filtro de fecha" */}
              {!histDate && (
                <div style={{
                  fontSize:9, fontWeight:700, color:'#0d9488',
                  background:'rgba(13,148,136,.08)', border:'1px solid rgba(13,148,136,.2)',
                  padding:'3px 9px', borderRadius:50, whiteSpace:'nowrap',
                }}>
                  Mostrando últimas 60
                </div>
              )}
            </div>
          </div>

          {/* ── Lista ── */}
          <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'12px 14px 24px', display:'flex', flexDirection:'column', gap:6 }}>
            {/* Modo: por fecha */}
            {histDate ? (
              histLoading ? (
                <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af', fontSize:13 }}>Cargando…</div>
              ) : histRecords.length === 0 ? (
                <div style={{ textAlign:'center', padding:'48px 0' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                  <div style={{ fontSize:13, color:'#6b7280', fontWeight:600 }}>Sin registros para esta fecha</div>
                  <button onClick={() => setHistDate('')} style={{
                    marginTop:12, padding:'7px 18px', borderRadius:50, border:'none',
                    background:'linear-gradient(135deg,#0d9488,#0891b2)',
                    color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer',
                  }}>Ver últimas asistencias</button>
                </div>
              ) : (
                histRecords.map((r, i) => <AttendanceRow key={r.id} record={r} idx={i} />)
              )
            ) : (
              /* Modo: últimas (agrupar por fecha igual que LatestPanel) */
              latestLoading ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'8px 0' }}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ height:56, borderRadius:14, background:`rgba(0,0,0,${0.05 - i*0.007})`, animation:'histPulse 1.4s ease-in-out infinite' }} />
                  ))}
                  <style>{`@keyframes histPulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
                </div>
              ) : latestRecords.length === 0 ? (
                <div style={{ textAlign:'center', padding:'52px 0' }}>
                  <div style={{ fontSize:42, marginBottom:10 }}>📋</div>
                  <div style={{ fontSize:13, color:'#374151', fontWeight:700 }}>Sin asistencias registradas</div>
                </div>
              ) : (() => {
                // Agrupar por fecha
                const groups: { fecha: string; label: string; rows: AsistenciaRecord[] }[] = []
                for (const r of latestRecords) {
                  const last = groups[groups.length - 1]
                  if (last && last.fecha === r.fecha) { last.rows.push(r) }
                  else {
                    const { fechaLabel } = formatColombiaTime(r.fecha, r.hora)
                    groups.push({ fecha: r.fecha, label: fechaLabel, rows: [r] })
                  }
                }
                return groups.map((g, gi) => (
                  <div key={g.fecha}>
                    {/* Separador de día */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding: gi === 0 ? '4px 2px 8px' : '14px 2px 8px' }}>
                      <div style={{
                        fontSize:9, fontWeight:800, letterSpacing:'1px', textTransform:'uppercase',
                        color: g.label === 'Hoy' ? '#0d9488' : '#6b7280',
                        background: g.label === 'Hoy' ? 'rgba(13,148,136,.1)' : 'rgba(0,0,0,.04)',
                        border: `1px solid ${g.label === 'Hoy' ? 'rgba(13,148,136,.25)' : 'rgba(0,0,0,.07)'}`,
                        padding:'2px 9px', borderRadius:50,
                      }}>{g.label}</div>
                      <div style={{ flex:1, height:1, background:'rgba(0,0,0,.06)' }} />
                      <span style={{ fontSize:9, color:'#9ca3af', fontWeight:600 }}>{g.rows.length}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {g.rows.map((r, i) => <AttendanceRow key={r.id} record={r} idx={i} />)}
                    </div>
                  </div>
                ))
              })()
            )}
          </div>
        </div>
      )}

      {/* ── Body REGISTRAR ── */}
      {activeTab === 'registrar' && <div style={{
        flex:1, minHeight:0, display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow:'hidden',
      }}>

        {/* ════════════════════════════════════════
            PANEL IZQUIERDO — Cámara / Resultado
        ════════════════════════════════════════ */}
        <div style={{
          width: isMobile ? '100%' : '52%',
          flexShrink:0, display:'flex', flexDirection:'column',
          borderRight: isMobile ? 'none' : '1px solid rgba(0,0,0,.06)',
          borderBottom: isMobile ? '1px solid rgba(0,0,0,.06)' : 'none',
          background:'rgba(255,255,255,.6)',
          overflow:'hidden',
        }}>

          {/* ─── MODO: CÁMARA ─── */}
          {mode === 'camera' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 16px', gap:14 }}>
              {/* Video */}
              <div style={{
                width: cameraFullscreen ? '100vw' : 'min(100%, 420px)',
                height: cameraFullscreen ? '100dvh' : 'clamp(150px, 34dvh, 315px)',
                inset: cameraFullscreen ? 0 : undefined,
                zIndex: cameraFullscreen ? 120 : undefined,
                borderRadius: cameraFullscreen ? 0 : 20,
                overflow:'hidden', background:'#0f172a', position: cameraFullscreen ? 'fixed' : 'relative',
                boxShadow: cameraFullscreen ? 'none' : '0 12px 40px rgba(0,0,0,.22)',
                border: cameraFullscreen ? 'none' : '2px solid rgba(255,255,255,.15)',
              }}>
                {isMobile && !cameraFullscreen && (
                  <button
                    type="button"
                    onClick={() => { setCameraFullscreen(true); void startCamera(facingMode) }}
                    aria-label="Abrir cámara"
                    style={{
                      position:'absolute', inset:0, zIndex:3, border:0,
                      background:'#0f172a', color:'rgba(255,255,255,.84)', cursor:'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
                    }}
                  >
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span style={{ fontSize:14, fontWeight:750, letterSpacing:'-.1px' }}>
                      Toca para abrir la cámara
                    </span>
                  </button>
                )}
                {cameraErr ? (
                  <div style={{
                    position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', gap:10, padding:24,
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" style={{ display: isMobile ? 'none' : 'block' }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    {!isMobile && <p style={{ fontSize:12, color:'rgba(255,255,255,.55)', textAlign:'center' }}>{cameraErr}</p>}
                    <button
                      onClick={() => startCamera(facingMode)}
                      style={{
                        width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,.1)',
                        border:'1px solid rgba(255,255,255,.3)', color:'#fff',
                        cursor:'pointer', display:'grid', placeItems:'center',
                      }}
                    >
                      <svg width="37" height="37" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1 2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay playsInline muted
                      style={{
                        width:'100%', height:'100%', objectFit:'cover',
                        transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                      }}
                    />
                    {/* Guía grupal — marco rectangular con esquinas */}
                    <div style={{
                      position:'absolute', inset:0, display:'flex',
                      alignItems:'center', justifyContent:'center', pointerEvents:'none',
                    }}>
                      <div style={{
                        width:'84%', height:'72%', position:'relative',
                        boxShadow:'0 0 0 9999px rgba(0,0,0,.28)',
                        borderRadius:8,
                      }}>
                        {/* Esquinas */}
                        {([['top','left'],['top','right'],['bottom','left'],['bottom','right']] as const).map(([v,h]) => (
                          <div key={`${v}${h}`} style={{
                            position:'absolute',
                            [v]: -2, [h]: -2,
                            width:22, height:22,
                            borderTop:    v==='top'    ? '3px solid rgba(255,255,255,.9)' : 'none',
                            borderBottom: v==='bottom' ? '3px solid rgba(255,255,255,.9)' : 'none',
                            borderLeft:   h==='left'   ? '3px solid rgba(255,255,255,.9)' : 'none',
                            borderRight:  h==='right'  ? '3px solid rgba(255,255,255,.9)' : 'none',
                            borderRadius: v==='top'&&h==='left' ? '4px 0 0 0' : v==='top'&&h==='right' ? '0 4px 0 0' : v==='bottom'&&h==='left' ? '0 0 0 4px' : '0 0 4px 0',
                          }} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Botones de control */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={handleImageUpload}
                style={{ display:'none' }}
              />
              <div style={{
                display: cameraFullscreen || !isMobile ? 'flex' : 'none', alignItems:'center', gap:12,
                position: cameraFullscreen ? 'fixed' : 'static',
                zIndex: cameraFullscreen ? 121 : undefined,
                left: cameraFullscreen ? 0 : undefined,
                right: cameraFullscreen ? 0 : undefined,
                bottom: cameraFullscreen ? 96 : undefined,
                justifyContent: cameraFullscreen ? 'center' : undefined,
              }}>
                {/* Cambiar cámara */}
                <button
                  onClick={switchCamera}
                  title="Cambiar cámara"
                  style={{
                    width:44, height:44, borderRadius:'50%', border:'1px solid rgba(0,0,0,.1)',
                    background:'rgba(255,255,255,.9)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 2px 8px rgba(0,0,0,.1)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                    <path d="M5 3l-3 3 3 3"/>
                  </svg>
                </button>

                {/* Capturar — botón principal */}
                <button
                  onClick={handleCapture}
                  disabled={!!cameraErr}
                  style={{
                    width:72, height:72, borderRadius:'50%', border:'4px solid #fff',
                    background: cameraErr
                      ? '#e5e7eb'
                      : 'linear-gradient(135deg,#0d9488,#0891b2)',
                    cursor: cameraErr ? 'not-allowed' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 6px 24px rgba(13,148,136,.45), 0 0 0 4px rgba(13,148,136,.15)',
                    transition:'all .18s',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>

                {/* Analizar una imagen existente */}
                <button
                  type="button"
                  className="attendance-upload-button"
                  onClick={() => imageInputRef.current?.click()}
                  title="Seleccionar una imagen para reconocimiento"
                  aria-label="Subir imagen"
                  style={{
                    height:44, minWidth:isMobile && cameraFullscreen ? 44 : (isMobile ? 112 : 126), padding:isMobile && cameraFullscreen ? 0 : '0 14px',
                    borderRadius:isMobile && cameraFullscreen ? '50%' : 50, border:'1px solid rgba(8,145,178,.24)',
                    background:'linear-gradient(145deg,rgba(255,255,255,.94),rgba(236,254,255,.78))',
                    color:'#0e7490', cursor:'pointer', display:'flex',
                    alignItems:'center', justifyContent:'center', gap:8,
                    fontSize:11, fontWeight:800, letterSpacing:'-.1px',
                    boxShadow:'0 5px 16px rgba(8,145,178,.12), inset 0 1px 0 rgba(255,255,255,.95)',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                  {!(isMobile && cameraFullscreen) && 'Subir imagen'}
                </button>

                {isMobile && cameraFullscreen && (
                  <button
                    type="button"
                    onClick={() => setCameraFullscreen(false)}
                    title="Cerrar cámara"
                    aria-label="Cerrar cámara"
                    style={{
                      width:44, height:44, borderRadius:'50%', border:'1px solid rgba(255,255,255,.42)',
                      background:'rgba(15,23,42,.72)', color:'#fff', cursor:'pointer',
                      display:'grid', placeItems:'center', boxShadow:'0 5px 18px rgba(0,0,0,.25)',
                    }}
                  >
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
                  </button>
                )}

                {/* Modelos status */}
                {!isMobile && <div
                  title={modelsReady ? 'IA lista' : 'Cargando IA...'}
                  style={{
                    width:44, height:44, borderRadius:'50%',
                    border:`1px solid ${modelsReady ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`,
                    background: modelsReady ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >
                  <div style={{
                    width:10, height:10, borderRadius:'50%',
                    background: modelsReady ? '#10b981' : '#f59e0b',
                    boxShadow: modelsReady ? '0 0 6px rgba(16,185,129,.8)' : '0 0 6px rgba(245,158,11,.8)',
                  }}/>
                </div>}
              </div>

              <p style={{ display: isMobile || cameraFullscreen ? 'none' : 'block', fontSize:11, color:'#9ca3af', textAlign:'center', margin:0 }}>
                Usa la cámara o analiza una foto JPG, PNG o WEBP
              </p>
              <div style={{
                display: isMobile || cameraFullscreen ? 'none' : 'flex', alignItems:'center', gap:6, marginTop:-8,
                color:'#64748b', fontSize:9, fontWeight:600,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
                Procesamiento local · la imagen no se almacena
              </div>
              {imageError && (
                <div role="alert" style={{
                  maxWidth:360, padding:'7px 12px', borderRadius:10,
                  background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.18)',
                  color:'#be123c', fontSize:10, fontWeight:700, textAlign:'center',
                }}>
                  {imageError}
                </div>
              )}
              <style>{`
                .attendance-upload-button {
                  transition: transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease, background .2s ease;
                }
                .attendance-upload-button:hover {
                  transform: translateY(-2px);
                  background: linear-gradient(145deg,rgba(255,255,255,1),rgba(207,250,254,.9)) !important;
                  box-shadow: 0 9px 22px rgba(8,145,178,.2), inset 0 1px 0 #fff !important;
                }
                .attendance-upload-button:active {
                  transform: translateY(0) scale(.97);
                  box-shadow: inset 0 2px 5px rgba(8,145,178,.15) !important;
                }
              `}</style>
            </div>
          )}

          {/* ─── MODO: PROCESANDO ─── */}
          {mode === 'processing' && capturedUrl && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              <div style={{ position:'relative', width:200, height:200 }}>
                <img src={capturedUrl} alt="" style={{
                  width:'100%', height:'100%',
                  objectFit:recognitionSource === 'upload' ? 'contain' : 'cover',
                  borderRadius:16, background:'#e2e8f0',
                }}/>
                <div style={{
                  position:'absolute', inset:0, borderRadius:16,
                  background:'rgba(13,148,136,.15)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10,
                }}>
                  <div style={{
                    width:40, height:40, borderRadius:'50%',
                    border:'3px solid #0d9488', borderTopColor:'transparent',
                    animation:'spin .8s linear infinite',
                  }}/>
                </div>
              </div>
              <div style={{
                display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
                borderRadius:50, background:'rgba(13,148,136,.08)',
                border:'1px solid rgba(13,148,136,.16)',
                fontSize:9, fontWeight:800, color:'#0f766e', textTransform:'uppercase',
                letterSpacing:'.7px',
              }}>
                {recognitionSource === 'upload' ? 'Imagen cargada' : 'Captura de cámara'}
              </div>
              <p style={{ fontSize:13, fontWeight:600, color:'#374151', margin:0 }}>{statusMsg}</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* ─── MODO: MATCH(ES) ENCONTRADO(S) ─── */}
          {mode === 'matched' && multiMatches.length > 0 && capturedUrl && (
            <MultiMatchPanel
              capturedUrl={capturedUrl}
              matches={multiMatches}
              saving={saving}
              saveError={saveError}
              onRegisterSelected={(seleccion) => handleRegisterAll(seleccion)}
              onRegisterOne={(nino) => handleRegister(nino)}
              onReset={resetCamera}
            />
          )}

          {/* ─── MODO: TODOS YA REGISTRADOS ─── */}
          {mode === 'already' && multiMatches.length > 0 && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              <div style={{
                width:72, height:72, borderRadius:'50%',
                background:'linear-gradient(135deg,#f59e0b,#d97706)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 6px 20px rgba(245,158,11,.4)',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#0f172a' }}>
                  {multiMatches.length > 1 ? `${multiMatches.length} niños detectados` : 'Niño detectado'}
                </div>
                <div style={{ fontSize:11, color:'#92400e', marginTop:4, fontWeight:600 }}>
                  Todos ya fueron registrados hoy ✓
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center' }}>
                {multiMatches.map((m, i) => <NinoCard key={i} nino={m.nino} />)}
              </div>
              <button
                onClick={resetCamera}
                style={{
                  padding:'10px 28px', borderRadius:50, border:'1px solid rgba(0,0,0,.1)',
                  background:'rgba(255,255,255,.9)', color:'#374151', fontSize:12,
                  fontWeight:700, cursor:'pointer',
                }}
              >
                  Realizar otra validación
              </button>
            </div>
          )}

          {/* ─── MODO: SIN MATCH ─── */}
          {mode === 'no_match' && (
            <NoMatchPanel
              capturedUrl={capturedUrl}
              allNinos={allNinos.length > 0 ? allNinos : []}
              saving={saving}
              onManualRegister={handleManualRegister}
              onReset={resetCamera}
              usuario={usuario}
            />
          )}

          {/* canvas oculto */}
          <canvas ref={canvasRef} style={{ display:'none' }} />
        </div>

        {/* ════════════════════════════════════════
            PANEL DERECHO — Últimas asistencias
        ════════════════════════════════════════ */}
        {!isMobile && (
          <LatestPanel
            records={latestRecords}
            loading={latestLoading}
            todayCount={todayCount}
            isMobile={isMobile}
            isCompact={isCompact}
            onRefresh={() => { loadToday(); loadLatest() }}
          />
        )}

      </div>} {/* end activeTab === 'registrar' */}
    </div>
  )
}

/* ── MultiMatchPanel — resultado con múltiples rostros + selección ──────── */
function MultiMatchPanel({
  capturedUrl, matches, saving, saveError, onRegisterSelected, onRegisterOne, onReset,
}: {
  capturedUrl:        string
  matches:            FaceMatch[]
  saving:             boolean
  saveError:          string
  onRegisterSelected: (seleccion: FaceMatch[]) => void
  onRegisterOne:      (nino: KidsNino) => void
  onReset:            () => void
}) {
  // Set de índices DESCARTADOS por el usuario (la X)
  const [descartados, setDescartados] = useState<Set<number>>(new Set())

  function toggleDescartado(i: number) {
    setDescartados(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const yaReg  = matches.filter(m => m.already)
  // Nuevos = no registrados Y no descartados manualmente
  const nuevosSeleccionados = matches.filter((m, i) => !m.already && !descartados.has(i))

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto', padding:'16px 16px 24px', gap:14 }}>

      {/* Foto capturada + badge de rostros */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <img src={capturedUrl} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:14,
            boxShadow:'0 4px 16px rgba(0,0,0,.14)' }}/>
          <div style={{
            position:'absolute', bottom:-6, right:-6,
            background:'linear-gradient(135deg,#0d9488,#0891b2)',
            color:'#fff', fontSize:10, fontWeight:800,
            padding:'3px 9px', borderRadius:50,
            boxShadow:'0 2px 8px rgba(13,148,136,.4)',
            border:'2px solid #fff',
          }}>
            {matches.length} rostro{matches.length > 1 ? 's' : ''}
          </div>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>
            {matches.length} niño{matches.length > 1 ? 's' : ''} identificado{matches.length > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
            {matches.length > 1
              ? 'Confirma ✓ o descarta ✕ cada coincidencia'
              : nuevosSeleccionados.length > 0 ? 'Listo para registrar' : 'Ya registrado hoy'
            }
          </div>
        </div>
      </div>

      {/* Tarjetas de matches con selección */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {matches.map((m, i) => {
          const isDescartado = descartados.has(i)
          const confianza = Math.round((1 - m.dist) * 100)
          const confColor = confianza >= 60 ? '#059669' : confianza >= 45 ? '#d97706' : '#dc2626'
          return (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 12px', borderRadius:14,
              opacity: isDescartado ? 0.5 : 1,
              background: isDescartado
                ? 'rgba(148,163,184,.08)'
                : m.already ? 'rgba(245,158,11,.06)' : 'rgba(16,185,129,.06)',
              border: `1.5px solid ${
                isDescartado ? 'rgba(148,163,184,.3)'
                : m.already ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.25)'
              }`,
              transition:'all .18s',
            }}>
              {/* Avatar */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <MatchAvatar nino={m.nino} />
                {isDescartado && (
                  <div style={{
                    position:'absolute', inset:0, borderRadius:'50%',
                    background:'rgba(100,116,139,.55)', display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:12, fontWeight:800, color: isDescartado ? '#94a3b8' : '#0f172a',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  textDecoration: isDescartado ? 'line-through' : 'none',
                }}>
                  {m.nino.nombre} {m.nino.apellido ?? ''}
                </div>
                <div style={{ fontSize:9, fontWeight:700, color:'#6b7280', marginTop:1 }}>
                  {m.nino.grupo ?? ''} · <span style={{ color: confColor }}>{confianza}% confianza</span>
                </div>
              </div>

              {/* Acciones: ya registrado, o botones ✕ / ✓ */}
              {m.already ? (
                <div style={{ fontSize:9, fontWeight:800, color:'#92400e', background:'rgba(245,158,11,.15)',
                  padding:'3px 9px', borderRadius:50, whiteSpace:'nowrap', flexShrink:0 }}>
                  Ya registrado
                </div>
              ) : (
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {/* ✕ Descartar */}
                  <button
                    onClick={() => toggleDescartado(i)}
                    title={isDescartado ? 'Restaurar' : 'Descartar (no es este niño)'}
                    style={{
                      width:34, height:34, borderRadius:'50%', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border: `1.5px solid ${isDescartado ? '#dc2626' : 'rgba(239,68,68,.35)'}`,
                      background: isDescartado ? '#fee2e2' : 'rgba(255,255,255,.85)',
                      transition:'all .15s',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                  {/* ✓ Mantener */}
                  <button
                    onClick={() => { if (isDescartado) toggleDescartado(i) }}
                    title="Confirmar coincidencia"
                    style={{
                      width:34, height:34, borderRadius:'50%', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border: `1.5px solid ${!isDescartado ? '#059669' : 'rgba(16,185,129,.35)'}`,
                      background: !isDescartado ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,.85)',
                      transition:'all .15s',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={!isDescartado ? '#fff' : '#059669'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Botón principal — registra solo los seleccionados */}
      {matches.some(m => !m.already) && (
        <button
          onClick={() => onRegisterSelected(nuevosSeleccionados)}
          disabled={saving || nuevosSeleccionados.length === 0}
          style={{
            width:'100%', padding:'14px', borderRadius:50, border:'none',
            background: nuevosSeleccionados.length === 0
              ? '#e5e7eb'
              : 'linear-gradient(135deg,#10b981,#059669)',
            color: nuevosSeleccionados.length === 0 ? '#9ca3af' : '#fff',
            fontSize:13, fontWeight:800,
            cursor: (saving || nuevosSeleccionados.length === 0) ? 'not-allowed' : 'pointer',
            boxShadow: nuevosSeleccionados.length === 0 ? 'none' : '0 6px 20px rgba(16,185,129,.42)',
            opacity: saving ? 0.7 : 1, transition:'all .18s',
            letterSpacing:'0.3px',
          }}
        >
          {saving
            ? 'Registrando…'
            : nuevosSeleccionados.length === 0
              ? 'Selecciona al menos una coincidencia'
              : nuevosSeleccionados.length === 1
                ? `✅ Registrar a ${nuevosSeleccionados[0].nino.nombre}`
                : `✅ Registrar ${nuevosSeleccionados.length} niños`
          }
        </button>
      )}

      {saveError && (
        <div style={{
          padding:'10px 16px', borderRadius:12,
          background:'rgba(239,68,68,.08)', border:'1.5px solid rgba(239,68,68,.3)',
          fontSize:11, color:'#dc2626', fontWeight:600, textAlign:'center',
        }}>
          ⚠️ {saveError}
        </div>
      )}

      <button
        onClick={onReset}
        style={{ background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer', textDecoration:'underline', textAlign:'center' }}
      >
        Capturar otra foto
      </button>
    </div>
  )
}

/* ── MatchAvatar — avatar pequeño para MultiMatchPanel ─────────────────── */
function MatchAvatar({ nino }: { nino: KidsNino }) {
  const [broken, setBroken] = useState(false)
  const ini = `${nino.nombre.charAt(0)}${(nino.apellido ?? 'X').charAt(0)}`.toUpperCase()
  return (
    <div style={{
      width:42, height:42, borderRadius:'50%', flexShrink:0, overflow:'hidden',
      background:'linear-gradient(135deg,#60a5fa,#a78bfa)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:13, fontWeight:800, color:'#fff',
      border:'2px solid rgba(255,255,255,.8)',
    }}>
      {nino.foto_url && !broken
        ? <img src={nino.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)}/>
        : ini
      }
    </div>
  )
}

/* ── NinoCard — tarjeta compacta del niño identificado ── */
function NinoCard({ nino }: { nino: KidsNino }) {
  const [broken, setBroken] = useState(false)
  const ini  = `${nino.nombre.charAt(0)}${(nino.apellido ?? 'X').charAt(0)}`.toUpperCase()
  const grad = 'linear-gradient(135deg,#60a5fa,#a78bfa)'
  const grupoColor = GRUPO_COLORS[nino.grupo ?? ''] ?? '#6b7280'

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:8,
      background:'rgba(255,255,255,.9)', border:'1px solid rgba(0,0,0,.08)',
      borderRadius:18, padding:'16px 20px',
      boxShadow:'0 4px 16px rgba(0,0,0,.08)',
      minWidth:140,
    }}>
      <div style={{
        width:60, height:60, borderRadius:'50%', overflow:'hidden',
        background: grad, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:18, fontWeight:800, color:'#fff',
        border:'2.5px solid rgba(255,255,255,.9)',
        boxShadow:'0 3px 12px rgba(0,0,0,.14)',
      }}>
        {nino.foto_url && !broken
          ? <img src={nino.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)} />
          : ini
        }
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>{nino.nombre} {nino.apellido ?? ''}</div>
        <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{nino.edad} años</div>
        {nino.grupo && (
          <div style={{
            marginTop:5, display:'inline-block', padding:'2px 10px', borderRadius:50,
            background:`${grupoColor}18`, border:`1px solid ${grupoColor}44`,
            fontSize:9, fontWeight:800, color:grupoColor,
          }}>
            {nino.grupo}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── NoMatchPanel — cuando no se reconoce el rostro ── */
function NoMatchPanel({
  capturedUrl, allNinos, saving, onManualRegister, onReset, usuario,
}: {
  capturedUrl:      string | null
  allNinos:         KidsNino[]
  saving:           boolean
  onManualRegister: (n: KidsNino) => void
  onReset:          () => void
  usuario:          { nombre: string; apellido: string } | null
}) {
  const [search, setSearch]   = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const filtered = allNinos.filter(n => {
    const q = search.toLowerCase()
    return `${n.nombre} ${n.apellido ?? ''}`.toLowerCase().includes(q)
  })

  // Cargar todos (con y sin descriptor) para búsqueda manual
  const [allForSearch, setAllForSearch] = useState<KidsNino[]>([])
  useEffect(() => {
    fetch('/api/kids/ninos')
      .then(r => r.json())
      .then(j => { if (j.ok) setAllForSearch(j.data) })
      .catch(() => {})
  }, [])

  const filteredAll = allForSearch.filter(n => {
    const q = search.toLowerCase()
    return `${n.nombre} ${n.apellido ?? ''}`.toLowerCase().includes(q)
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 16px', gap:14, overflowY:'auto' }}>
      {/* Foto capturada */}
      {capturedUrl && (
        <div style={{ position:'relative', flexShrink:0 }}>
          <img src={capturedUrl} alt="" style={{ width:120, height:120, objectFit:'cover', borderRadius:16, filter:'grayscale(.3)' }}/>
          <div style={{
            position:'absolute', inset:0, borderRadius:16,
            border:'2.5px solid #f43f5e',
            display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:6,
          }}>
            <div style={{
              background:'#f43f5e', color:'#fff', fontSize:9, fontWeight:800,
              padding:'2px 10px', borderRadius:50,
            }}>
              Rostro desconocido
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, fontWeight:800, color:'#0f172a' }}>No se reconoció el rostro</div>
        <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>
          Puedes asignar manualmente o realizar otra validación
        </div>
      </div>

      <div style={{ display:'flex', gap:8, width:'100%', maxWidth:340 }}>
        <button
          onClick={() => setShowSearch(true)}
          style={{
            flex:1, padding:'11px', borderRadius:50, border:'1.5px solid #6366f1',
            background:'rgba(99,102,241,.08)', color:'#4338ca', fontSize:12, fontWeight:700, cursor:'pointer',
          }}
        >
          Asignar a niño existente
        </button>
        <button
          onClick={onReset}
          style={{
            flex:1, padding:'11px', borderRadius:50, border:'1.5px solid rgba(0,0,0,.1)',
            background:'rgba(255,255,255,.9)', color:'#374151', fontSize:12, fontWeight:700, cursor:'pointer',
          }}
        >
          Intentar de nuevo
        </button>
      </div>

      {/* Búsqueda manual */}
      {showSearch && (
        <div style={{ width:'100%', maxWidth:340 }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar niño por nombre…"
            style={{
              width:'100%', padding:'10px 14px', borderRadius:12, boxSizing:'border-box',
              border:'1.5px solid #e0e7ff', fontSize:12, outline:'none',
              background:'rgba(255,255,255,.95)',
            }}
          />
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
            {(search.length > 0 ? filteredAll : allForSearch).slice(0, 12).map(n => {
              const ini = `${n.nombre.charAt(0)}${(n.apellido ?? 'X').charAt(0)}`.toUpperCase()
              const grupoColor = GRUPO_COLORS[n.grupo ?? ''] ?? '#6b7280'
              return (
                <button
                  key={n.id}
                  onClick={() => { onManualRegister(n); setShowSearch(false) }}
                  disabled={saving}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'8px 12px', borderRadius:10, border:'1px solid rgba(0,0,0,.07)',
                    background:'rgba(255,255,255,.9)', cursor:'pointer', textAlign:'left',
                    transition:'background .15s',
                  }}
                >
                  <div style={{
                    width:34, height:34, borderRadius:'50%', flexShrink:0,
                    background:'linear-gradient(135deg,#60a5fa,#a78bfa)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:800, color:'#fff',
                    overflow:'hidden',
                  }}>
                    {n.foto_url
                      ? <img src={n.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : ini
                    }
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {n.nombre} {n.apellido ?? ''}
                    </div>
                    {n.grupo && (
                      <div style={{ fontSize:9, fontWeight:700, color:grupoColor, marginTop:1 }}>{n.grupo}</div>
                    )}
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4"/>
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── LatestPanel — panel de últimas asistencias ─────────────────────────── */
function LatestPanel({
  records, loading, todayCount, isMobile, isCompact, onRefresh,
}: {
  records:    AsistenciaRecord[]
  loading:    boolean
  todayCount: number
  isMobile:   boolean
  isCompact:  boolean
  onRefresh:  () => void
}) {
  const hoy = getColombiaTodayDate()

  // Agrupar por fecha para mostrar separadores de día
  const grouped: { fecha: string; label: string; rows: AsistenciaRecord[] }[] = []
  for (const r of records) {
    const last = grouped[grouped.length - 1]
    if (last && last.fecha === r.fecha) {
      last.rows.push(r)
    } else {
      const { fechaLabel } = formatColombiaTime(r.fecha, r.hora)
      grouped.push({ fecha: r.fecha, label: fechaLabel, rows: [r] })
    }
  }

  return (
    <div style={{
      flex:1, minWidth:0, display:'flex', flexDirection:'column',
      background:'linear-gradient(145deg,rgba(255,255,255,.64),rgba(236,254,255,.3))',
      backdropFilter:'blur(22px) saturate(145%)',
      WebkitBackdropFilter:'blur(22px) saturate(145%)',
      overflow:'hidden',
    }}>
      {/* Header del panel */}
      <div style={{
        padding: isMobile ? '14px 18px 10px' : isCompact ? '12px 16px 9px' : '14px 18px 10px',
        borderBottom:'1px solid rgba(255,255,255,.5)',
        background:'linear-gradient(135deg,rgba(255,255,255,.76),rgba(226,232,240,.28))',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,.86), 0 7px 20px rgba(15,23,42,.05)',
        backdropFilter:'blur(18px) saturate(140%)',
        WebkitBackdropFilter:'blur(18px) saturate(140%)',
        flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              width:30, height:30, borderRadius:10,
              background:'linear-gradient(135deg,#0d9488,#0891b2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 3px 10px rgba(13,148,136,.35)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:isCompact ? 11 : 12, fontWeight:800, color:'#0f172a', lineHeight:1 }}>
                Últimas asistencias
              </div>
              <div style={{ fontSize:9, color:'#6b7280', marginTop:2, fontWeight:600 }}>
                Zona horaria Colombia
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Counter hoy */}
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                background:'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))',
                border:'1px solid rgba(13,148,136,.2)', borderRadius:10,
                padding:isCompact ? '3px 9px' : '4px 10px', minWidth:42,
              }}>
              <span style={{ fontSize:isCompact ? 15 : 16, fontWeight:900, color:'#0d9488', lineHeight:1 }}>{todayCount}</span>
              <span style={{ fontSize:8, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px' }}>hoy</span>
            </div>
            {/* Botón refresh */}
            <button
              onClick={onRefresh}
              title="Actualizar"
              style={{
                width:30, height:30, borderRadius:9, border:'1px solid rgba(0,0,0,.08)',
                background:'rgba(255,255,255,.9)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 1px 4px rgba(0,0,0,.06)', transition:'all .15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', padding: isCompact ? '9px 10px 20px' : '10px 12px 24px', display:'flex', flexDirection:'column', gap:4 }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'8px 0' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                height:56, borderRadius:14,
                background:`rgba(0,0,0,${0.04 - i * 0.006})`,
                animation:'pulse 1.4s ease-in-out infinite',
              }}/>
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign:'center', padding:'52px 0' }}>
            <div style={{ fontSize:42, marginBottom:10 }}>📋</div>
            <div style={{ fontSize:13, color:'#374151', fontWeight:700 }}>Sin asistencias aún</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
              Captura un rostro para comenzar
            </div>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={group.fecha}>
              {/* Separador de día */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding: gi === 0 ? '4px 4px 8px' : '12px 4px 8px',
              }}>
                <div style={{
                  fontSize:9, fontWeight:800, letterSpacing:'1.2px',
                  textTransform:'uppercase',
                  color: group.fecha === hoy ? '#0d9488' : '#9ca3af',
                  background: group.fecha === hoy
                    ? 'rgba(13,148,136,.08)'
                    : 'rgba(0,0,0,.04)',
                  padding:'2px 10px', borderRadius:50,
                  border: group.fecha === hoy ? '1px solid rgba(13,148,136,.2)' : '1px solid transparent',
                }}>
                  {group.label} · {group.rows.length}
                </div>
                <div style={{ flex:1, height:1, background:'rgba(0,0,0,.06)' }}/>
              </div>
              {/* Filas del día */}
              {group.rows.map((r, i) => (
                <AttendanceRow key={r.id} record={r} idx={gi * 10 + i} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ── AttendanceRow — fila en la lista de asistencias ── */
function AttendanceRow({ record, idx }: { record: AsistenciaRecord; idx: number }) {
  const [broken, setBroken] = useState(false)
  const nino = record.nino
  const ini  = nino ? `${nino.nombre.charAt(0)}${(nino.apellido ?? 'X').charAt(0)}`.toUpperCase() : '?'
  const { hora12 } = formatColombiaTime(record.fecha, record.hora)
  const grupoColor  = GRUPO_COLORS[nino?.grupo ?? ''] ?? '#6b7280'

  const isImageMethod = record.metodo?.includes('imagen')
  const isFaceMethod = record.metodo?.includes('facial')
  const isGroupMethod = record.metodo?.includes('grupal')
  const metodoIcon = isImageMethod ? '🖼️' : isFaceMethod ? '📷' : '✋'
  const metodoLabel = isImageMethod
    ? (isGroupMethod ? 'imagen grupal' : 'imagen')
    : isGroupMethod ? 'grupal' : isFaceMethod ? 'facial' : 'manual'
  const metodoColor = isImageMethod ? '#7c3aed' : isFaceMethod ? '#0d9488' : '#6366f1'

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'9px 12px', borderRadius:14,
      background:'rgba(255,255,255,.88)',
      border:'1px solid rgba(0,0,0,.05)',
      boxShadow:'0 1px 6px rgba(0,0,0,.04)',
      animation:`coordFadeIn .28s ${Math.min(idx, 8) * 0.04}s both`,
      marginBottom:4,
    }}>
      {/* Avatar */}
      <div style={{
        width:38, height:38, borderRadius:'50%', flexShrink:0, overflow:'hidden',
        background:'linear-gradient(135deg,#60a5fa,#a78bfa)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, fontWeight:800, color:'#fff',
        border:'2px solid rgba(255,255,255,.9)',
        boxShadow:'0 2px 8px rgba(0,0,0,.1)',
      }}>
        {nino?.foto_url && !broken
          ? <img src={nino.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setBroken(true)}/>
          : ini
        }
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {nino?.nombre ?? '—'} {nino?.apellido ?? ''}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2, flexWrap:'wrap' }}>
          {nino?.grupo && (
            <span style={{ fontSize:9, fontWeight:700, color:grupoColor }}>{nino.grupo}</span>
          )}
          {nino?.grupo && record.registrado_por && (
            <span style={{ fontSize:9, color:'rgba(0,0,0,.2)', lineHeight:1 }}>·</span>
          )}
          {record.registrado_por && (
            <span style={{ fontSize:9, fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>
              {record.registrado_por.trim().split(/\s+/).slice(0, 3).join(' ')}
            </span>
          )}
        </div>
      </div>

      {/* Hora + método */}
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#0f172a' }}>{hora12}</div>
        <div style={{
          fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px',
          color: metodoColor, marginTop:1,
        }}>
          {metodoIcon} {metodoLabel}
        </div>
      </div>
    </div>
  )
}
