'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { loadFaceModels, faceDistance, FACE_MATCH_THRESHOLD } from '@/lib/faceRecognition'
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

type Mode = 'camera' | 'processing' | 'matched' | 'no_match' | 'already'
type NinoWithDescriptor = KidsNino & { face_descriptor: number[] }

const GRUPO_COLORS: Record<string, string> = {
  'Semillitas':  '#f59e0b',
  'Exploradores':'#3b82f6',
  'Junior':      '#8b5cf6',
}

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

  /* ── state ── */
  const [mode,          setMode]          = useState<Mode>('camera')
  const [capturedUrl,   setCapturedUrl]   = useState<string | null>(null)
  const [matchedNino,   setMatchedNino]   = useState<KidsNino | null>(null)
  const [matchDist,     setMatchDist]     = useState(0)
  const [allNinos,      setAllNinos]      = useState<NinoWithDescriptor[]>([])
  const [todayRecords,  setTodayRecords]  = useState<AsistenciaRecord[]>([])
  const [statusMsg,     setStatusMsg]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [cameraErr,     setCameraErr]     = useState('')
  const [modelsReady,   setModelsReady]   = useState(false)
  const [isMobile,      setIsMobile]      = useState(false)
  const [facingMode,    setFacingMode]    = useState<'user' | 'environment'>('environment')
  const [successMsg,    setSuccessMsg]    = useState('')

  /* ── responsive ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
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

  /* ── cargar asistencias de hoy ── */
  const loadToday = useCallback(async () => {
    try {
      const res  = await fetch('/api/kids/asistencias')
      const json = await res.json()
      if (json.ok) setTodayRecords(json.data)
    } catch {}
  }, [])

  useEffect(() => { loadToday() }, [loadToday])

  /* ── iniciar cámara ── */
  const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    setCameraErr('')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e: any) {
      setCameraErr('No se pudo acceder a la cámara. Verifique los permisos.')
    }
  }, [facingMode])

  useEffect(() => {
    if (mode === 'camera') startCamera(facingMode)
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [mode, facingMode, startCamera])

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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedUrl(dataUrl)

    // Detener cámara
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    setMode('processing')
    setStatusMsg('Detectando rostro…')
    await analyzeFace(dataUrl)
  }

  /* ── analizar rostro ── */
  async function analyzeFace(dataUrl: string) {
    if (!modelsReady) {
      setStatusMsg('Cargando modelos de IA…')
      try { await loadFaceModels() } catch {
        setStatusMsg('Modelos no disponibles.')
        setTimeout(() => resetCamera(), 2000)
        return
      }
    }

    try {
      const fa = await import('face-api.js')
      setStatusMsg('Analizando rostro…')

      // dataURL → HTMLImageElement
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el  = new Image()
        el.onload  = () => resolve(el)
        el.onerror = reject
        el.src     = dataUrl
      })

      const detection = await fa
        .detectSingleFace(img, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 }))
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        setMode('no_match')
        setMatchedNino(null)
        return
      }

      const capturedDesc = Array.from(detection.descriptor)

      // Comparar con todos los niños
      let bestNino:  NinoWithDescriptor | null = null
      let bestDist   = Infinity

      for (const nino of allNinos) {
        const dist = faceDistance(capturedDesc, nino.face_descriptor)
        if (dist < bestDist) { bestDist = dist; bestNino = nino }
      }

      if (bestNino && bestDist < FACE_MATCH_THRESHOLD) {
        setMatchedNino(bestNino)
        setMatchDist(bestDist)

        // Verificar si ya fue registrado hoy
        const hoy  = new Date().toISOString().slice(0, 10)
        const ya   = todayRecords.some(r => r.nino_id === bestNino!.id)
        setMode(ya ? 'already' : 'matched')
      } else {
        setMatchedNino(null)
        setMode('no_match')
      }
    } catch (e: any) {
      console.error('[analyzeFace]', e.message)
      setMode('no_match')
    }
  }

  /* ── registrar asistencia ── */
  async function handleRegister() {
    if (!matchedNino) return
    setSaving(true)
    try {
      const res  = await fetch('/api/kids/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nino_id:        matchedNino.id,
          metodo:         'facial',
          registrado_por: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setSuccessMsg(`✅ ${matchedNino.nombre} ${matchedNino.apellido ?? ''} registrado`)
        await loadToday()
        setTimeout(() => { setSuccessMsg(''); resetCamera() }, 2200)
      }
    } catch {}
    setSaving(false)
  }

  /* ── registro manual (sin rostro conocido) ── */
  async function handleManualRegister(nino: KidsNino) {
    setSaving(true)
    try {
      const res  = await fetch('/api/kids/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nino_id:        nino.id,
          metodo:         'manual',
          registrado_por: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setSuccessMsg(`✅ ${nino.nombre} ${nino.apellido ?? ''} registrado manualmente`)
        await loadToday()
        setTimeout(() => { setSuccessMsg(''); resetCamera() }, 2200)
      }
    } catch {}
    setSaving(false)
  }

  function resetCamera() {
    setCapturedUrl(null)
    setMatchedNino(null)
    setMatchDist(0)
    setStatusMsg('')
    setMode('camera')
  }

  function switchCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
  }

  /* ── Colores según grupo ── */
  const today = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
  const todayCount = todayRecords.length

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      flex:1, minHeight:0, display:'flex', flexDirection:'column',
      overflow:'hidden', background:'transparent',
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
        padding: isMobile ? '14px 16px 10px' : '20px 28px 14px',
        flexShrink:0, borderBottom:'1px solid rgba(0,0,0,.05)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#0d9488', letterSpacing:'2px', textTransform:'uppercase', marginBottom:3 }}>
            Módulo Kids
          </div>
          <div style={{ fontSize: isMobile ? 20 : 26, fontWeight:900, color:'#0f172a', letterSpacing:'-0.5px' }}>
            Asistencias
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:2, textTransform:'capitalize' }}>{today}</div>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:8, flexShrink:0,
          background:'linear-gradient(135deg,rgba(16,185,129,.12),rgba(5,150,105,.08))',
          border:'1px solid rgba(16,185,129,.25)', borderRadius:16, padding:'10px 18px',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.7)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:22, fontWeight:900, color:'#059669', lineHeight:1 }}>{todayCount}</div>
            <div style={{ fontSize:9, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px' }}>Hoy</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex:1, minHeight:0, display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow:'hidden', gap: isMobile ? 0 : 0,
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
                width:'100%', maxWidth:420, aspectRatio:'4/3',
                borderRadius:20, overflow:'hidden', background:'#0f172a', position:'relative',
                boxShadow:'0 12px 40px rgba(0,0,0,.22)',
                border:'2px solid rgba(255,255,255,.15)',
              }}>
                {cameraErr ? (
                  <div style={{
                    position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', gap:10, padding:24,
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.55)', textAlign:'center' }}>{cameraErr}</p>
                    <button
                      onClick={() => startCamera(facingMode)}
                      style={{
                        padding:'8px 20px', borderRadius:50, background:'rgba(255,255,255,.15)',
                        border:'1px solid rgba(255,255,255,.3)', color:'#fff', fontSize:12,
                        cursor:'pointer', fontWeight:600,
                      }}
                    >
                      Reintentar
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
                    {/* Guía de rostro */}
                    <div style={{
                      position:'absolute', inset:0, display:'flex',
                      alignItems:'center', justifyContent:'center', pointerEvents:'none',
                    }}>
                      <div style={{
                        width:150, height:180, borderRadius:'50%',
                        border:'2px dashed rgba(255,255,255,.35)',
                        boxShadow:'0 0 0 9999px rgba(0,0,0,.22)',
                      }}/>
                    </div>
                  </>
                )}
              </div>

              {/* Botones de control */}
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
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

                {/* Modelos status */}
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  border:`1px solid ${modelsReady ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`,
                  background: modelsReady ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  title: modelsReady ? 'IA lista' : 'Cargando IA...',
                }}>
                  <div style={{
                    width:10, height:10, borderRadius:'50%',
                    background: modelsReady ? '#10b981' : '#f59e0b',
                    boxShadow: modelsReady ? '0 0 6px rgba(16,185,129,.8)' : '0 0 6px rgba(245,158,11,.8)',
                  }}/>
                </div>
              </div>

              <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', margin:0 }}>
                Centra el rostro en el óvalo y presiona capturar
              </p>
            </div>
          )}

          {/* ─── MODO: PROCESANDO ─── */}
          {mode === 'processing' && capturedUrl && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              <div style={{ position:'relative', width:200, height:200 }}>
                <img src={capturedUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:16 }}/>
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
              <p style={{ fontSize:13, fontWeight:600, color:'#374151', margin:0 }}>{statusMsg}</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* ─── MODO: MATCH ENCONTRADO ─── */}
          {mode === 'matched' && matchedNino && capturedUrl && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              {/* Foto capturada + niño */}
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ position:'relative' }}>
                  <img src={capturedUrl} alt="" style={{ width:90, height:90, objectFit:'cover', borderRadius:16 }}/>
                  <div style={{
                    position:'absolute', bottom:-6, right:-6, width:24, height:24, borderRadius:'50%',
                    background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 2px 8px rgba(16,185,129,.5)', border:'2px solid #fff',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize:22, color:'#9ca3af' }}>→</div>
                {/* Niño identificado */}
                <NinoCard nino={matchedNino} />
              </div>

              <div style={{
                background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.22)',
                borderRadius:12, padding:'8px 16px', fontSize:11, color:'#059669', fontWeight:600,
              }}>
                Confianza: {Math.round((1 - matchDist) * 100)}% · Distancia: {matchDist.toFixed(3)}
              </div>

              <button
                onClick={handleRegister}
                disabled={saving}
                style={{
                  width:'100%', maxWidth:320, padding:'14px',
                  borderRadius:50, border:'none',
                  background:'linear-gradient(135deg,#10b981,#059669)',
                  color:'#fff', fontSize:14, fontWeight:800, cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow:'0 6px 20px rgba(16,185,129,.42)',
                  letterSpacing:'0.5px', opacity: saving ? 0.7 : 1,
                  transition:'all .18s',
                }}
              >
                {saving ? 'Registrando…' : '✅  Registrar asistencia'}
              </button>
              <button
                onClick={resetCamera}
                style={{ background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer', textDecoration:'underline' }}
              >
                No es este niño — volver a capturar
              </button>
            </div>
          )}

          {/* ─── MODO: YA REGISTRADO ─── */}
          {mode === 'already' && matchedNino && (
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
              <NinoCard nino={matchedNino} />
              <div style={{
                background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)',
                borderRadius:12, padding:'10px 20px', fontSize:12, color:'#92400e', fontWeight:600, textAlign:'center',
              }}>
                Ya fue registrado hoy ✓
              </div>
              <button
                onClick={resetCamera}
                style={{
                  padding:'10px 28px', borderRadius:50, border:'1px solid rgba(0,0,0,.1)',
                  background:'rgba(255,255,255,.9)', color:'#374151', fontSize:12,
                  fontWeight:700, cursor:'pointer',
                }}
              >
                Capturar otro
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
            PANEL DERECHO — Lista de asistencias hoy
        ════════════════════════════════════════ */}
        <div style={{
          flex:1, minWidth:0, display:'flex', flexDirection:'column',
          background:'rgba(248,250,252,.8)', overflow:'hidden',
        }}>
          <div style={{
            padding:'16px 20px 10px', borderBottom:'1px solid rgba(0,0,0,.06)',
            display:'flex', alignItems:'center', gap:8, flexShrink:0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>Registro de hoy</span>
            {todayCount > 0 && (
              <div style={{
                marginLeft:'auto', background:'linear-gradient(135deg,#0d9488,#0891b2)',
                color:'#fff', fontSize:10, fontWeight:800, padding:'2px 10px', borderRadius:50,
                boxShadow:'0 2px 8px rgba(13,148,136,.35)',
              }}>
                {todayCount}
              </div>
            )}
          </div>

          <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'10px 14px 20px', display:'flex', flexDirection:'column', gap:7 }}>
            {todayRecords.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 0' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:13, color:'#6b7280', fontWeight:600 }}>Sin registros hoy</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                  Captura un rostro para registrar asistencia
                </div>
              </div>
            ) : (
              todayRecords.map((r, i) => (
                <AttendanceRow key={r.id} record={r} idx={i} />
              ))
            )}
          </div>
        </div>

      </div>
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
          Puedes asignar manualmente o capturar de nuevo
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
          Capturar de nuevo
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

/* ── AttendanceRow — fila en la lista de hoy ── */
function AttendanceRow({ record, idx }: { record: AsistenciaRecord; idx: number }) {
  const [broken, setBroken] = useState(false)
  const nino = record.nino
  const ini  = nino ? `${nino.nombre.charAt(0)}${(nino.apellido ?? 'X').charAt(0)}`.toUpperCase() : '?'
  const hora = record.hora?.slice(0, 5) ?? ''
  const grupoColor = GRUPO_COLORS[nino?.grupo ?? ''] ?? '#6b7280'

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'9px 12px', borderRadius:14,
      background:'rgba(255,255,255,.85)',
      border:'1px solid rgba(0,0,0,.06)',
      boxShadow:'0 2px 8px rgba(0,0,0,.04)',
      animation:`coordFadeIn .32s ${idx * 0.04}s both`,
    }}>
      {/* Avatar */}
      <div style={{
        width:38, height:38, borderRadius:'50%', flexShrink:0, overflow:'hidden',
        background:'linear-gradient(135deg,#60a5fa,#a78bfa)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, fontWeight:800, color:'#fff',
        border:'2px solid rgba(255,255,255,.8)',
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
        {nino?.grupo && (
          <div style={{ fontSize:9, fontWeight:700, color:grupoColor, marginTop:1 }}>{nino.grupo}</div>
        )}
      </div>

      {/* Hora + método */}
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#0f172a' }}>{hora}</div>
        <div style={{
          fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px',
          color: record.metodo === 'facial' ? '#0d9488' : '#6366f1', marginTop:1,
        }}>
          {record.metodo === 'facial' ? '📷 facial' : '✋ manual'}
        </div>
      </div>
    </div>
  )
}
