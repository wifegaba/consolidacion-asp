'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

/* ── Constants ──────────────────────────────────────────────────────────── */
const CONTAINER = 300   // px — interactive area
const CROP_R    = 130   // px — crop circle radius
const OUTPUT    = 400   // px — canvas output size

interface Props {
  file:      File
  onConfirm: (cropped: File) => void
  onCancel:  () => void
}

/* ════════════════════════════════════════════════════════════════════════
   CropModal
════════════════════════════════════════════════════════════════════════ */
export default function CropModal({ file, onConfirm, onCancel }: Props) {
  const imgRef    = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  const [imgSrc,   setImgSrc]   = useState('')
  const [visible,  setVisible]  = useState(false)
  const [done,     setDone]     = useState(false)

  // ── Render state (for image display) ───────────────────────────────────
  const [zoom,     setZoom]     = useState(1)
  const [pos,      setPos]      = useState({ x: 0, y: 0 })
  const [natW,     setNatW]     = useState(1)
  const [natH,     setNatH]     = useState(1)
  const [minZoom,  setMinZoom]  = useState(1)
  const [maxZoom,  setMaxZoom]  = useState(4)

  // ── Interaction refs (read in event handlers to avoid stale closures) ──
  const zR     = useRef(1)         // current zoom
  const pR     = useRef({ x:0, y:0 }) // current pos
  const nwR    = useRef(1)         // natural width
  const nhR    = useRef(1)         // natural height
  const minZR  = useRef(1)         // min zoom
  const maxZR  = useRef(4)         // max zoom

  // ── Drag state ─────────────────────────────────────────────────────────
  const dragging  = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const lastPinch = useRef(0)

  /* ── Sync refs + state atomically ─────────────────────────────────────── */
  function commit(z: number, p: { x: number; y: number }) {
    zR.current = z
    pR.current = p
    setZoom(z)
    setPos({ ...p })
  }

  /* ── Clamp position so the image always covers the crop circle ────────── */
  function clamp(p: { x: number; y: number }, z: number) {
    const dW    = nwR.current * z
    const dH    = nhR.current * z
    const cL    = (CONTAINER - CROP_R * 2) / 2   // left edge of crop rect
    const cT    = (CONTAINER - CROP_R * 2) / 2   // top  edge of crop rect
    const cR    = cL + CROP_R * 2                 // right  edge
    const cBot  = cT + CROP_R * 2                 // bottom edge
    return {
      x: Math.min(cL, Math.max(cR - dW,  p.x)),
      y: Math.min(cT, Math.max(cBot - dH, p.y)),
    }
  }

  /* ── Apply zoom around a container-relative center point ──────────────── */
  function applyZoom(raw: number, cx = CONTAINER / 2, cy = CONTAINER / 2) {
    const z     = Math.min(maxZR.current, Math.max(minZR.current, raw))
    const ratio = z / zR.current
    commit(z, clamp({
      x: cx - (cx - pR.current.x) * ratio,
      y: cy - (cy - pR.current.y) * ratio,
    }, z))
  }

  /* ── Load image URL ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgSrc(url)
    const t = setTimeout(() => setVisible(true), 10)
    return () => { URL.revokeObjectURL(url); clearTimeout(t) }
  }, [file])

  /* ── Auto-fit once image loads ────────────────────────────────────────── */
  const onImgLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight

    nwR.current = nw
    nhR.current = nh
    setNatW(nw)
    setNatH(nh)

    // Cover zoom: smallest zoom that fills the crop circle completely
    const fit = Math.max((CROP_R * 2) / nw, (CROP_R * 2) / nh)
    const max = fit * 4

    minZR.current = fit
    maxZR.current = max
    setMinZoom(fit)
    setMaxZoom(max)

    // Center the image inside the container
    const p = clamp({ x: (CONTAINER - nw * fit) / 2, y: (CONTAINER - nh * fit) / 2 }, fit)
    commit(fit, p)
  }, []) // eslint-disable-line

  /* ── Non-passive wheel listener (React onWheel can't preventDefault) ──── */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.06 : 0.94
      const rect   = el.getBoundingClientRect()
      applyZoom(zR.current * factor, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, []) // reads from refs — no deps needed

  /* ── Mouse drag ─────────────────────────────────────────────────────────── */
  function onMouseDown(e: React.MouseEvent) {
    dragging.current  = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    commit(zR.current, clamp({ x: pR.current.x + dx, y: pR.current.y + dy }, zR.current))
  }
  function onMouseUp() { dragging.current = false }

  /* ── Touch drag + pinch zoom ──────────────────────────────────────────── */
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      dragging.current  = true
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      dragging.current = false
      lastPinch.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - lastMouse.current.x
      const dy = e.touches[0].clientY - lastMouse.current.y
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      commit(zR.current, clamp({ x: pR.current.x + dx, y: pR.current.y + dy }, zR.current))
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      if (lastPinch.current > 0) {
        applyZoom(zR.current * (dist / lastPinch.current))
      }
      lastPinch.current = dist
    }
  }
  function onTouchEnd() { dragging.current = false }

  /* ── Extract crop and call onConfirm ──────────────────────────────────── */
  function handleConfirm() {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')!
    canvas.width  = OUTPUT
    canvas.height = OUTPUT

    const cL   = (CONTAINER - CROP_R * 2) / 2
    const cT   = (CONTAINER - CROP_R * 2) / 2
    const z    = zR.current
    const px   = pR.current.x
    const py   = pR.current.y
    const srcX = (cL - px) / z
    const srcY = (cT - py) / z
    const srcW = (CROP_R * 2) / z
    const srcH = (CROP_R * 2) / z

    // Circular clip for clean edges
    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT)
    ctx.restore()

    setDone(true)
    canvas.toBlob(
      blob => { if (blob) onConfirm(new File([blob], 'foto.jpg', { type: 'image/jpeg' })) },
      'image/jpeg', 0.92,
    )
  }

  function handleClose() {
    setVisible(false)
    setTimeout(onCancel, 220)
  }

  /* ── Zoom display as multiplier (1.0× = fit, 4.0× = max) ─────────────── */
  const zoomLabel = (minZoom > 0 ? zoom / minZoom : 1).toFixed(1) + '×'

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position:'fixed', inset:0, zIndex:70,
        background:     visible ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(4px)'       : 'none',
        transition:     'all .22s',
      }} />

      {/* Card */}
      <div style={{
        position:   'fixed',
        top:        '50%', left: '50%',
        transform:  visible
          ? 'translate(-50%,-50%) scale(1)'
          : 'translate(-50%,-50%) scale(.9)',
        opacity:    visible ? 1 : 0,
        transition: 'all .22s cubic-bezier(.4,0,.2,1)',
        zIndex:     80,
        background: '#fff',
        borderRadius: 24,
        boxShadow:  '0 32px 80px rgba(0,0,0,.22)',
        padding:    '24px 24px 22px',
        width:      Math.min(352, typeof window !== 'undefined' ? window.innerWidth - 24 : 352),
        display:    'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>

        {/* ── Header ── */}
        <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:10, fontWeight:600, color:'#0d9488', letterSpacing:'2px', textTransform:'uppercase', marginBottom:3 }}>
              Foto de perfil
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827' }}>Ajustar imagen</div>
          </div>
          <button onClick={handleClose} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── Hint ── */}
        <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', margin:0, lineHeight:1.5 }}>
          Arrastra para encuadrar la foto
        </p>

        {/* ── Crop canvas ── */}
        <div
          ref={wrapRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            position:   'relative',
            width:      CONTAINER,
            height:     CONTAINER,
            borderRadius: 16,
            overflow:   'hidden',
            background: '#1a1a2e',
            cursor:     'grab',
            flexShrink: 0,
            touchAction:'none',
            userSelect: 'none',
          }}
        >
          {/* Image layer */}
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position:      'absolute',
                left:          pos.x,
                top:           pos.y,
                width:         natW * zoom,
                height:        natH * zoom,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Dark vignette outside crop circle */}
          <div style={{
            position:       'absolute', inset: 0, pointerEvents: 'none',
            background:     'rgba(0,0,0,.58)',
            WebkitMaskImage:`radial-gradient(circle ${CROP_R}px at 50% 50%, transparent ${CROP_R-1}px, black ${CROP_R}px)`,
            maskImage:      `radial-gradient(circle ${CROP_R}px at 50% 50%, transparent ${CROP_R-1}px, black ${CROP_R}px)`,
          }} />

          {/* Crop circle border */}
          <div style={{
            position:'absolute', left:'50%', top:'50%',
            transform:'translate(-50%,-50%)',
            width: CROP_R*2, height: CROP_R*2,
            borderRadius:'50%',
            border:'2px solid rgba(255,255,255,.75)',
            boxShadow:'0 0 0 1px rgba(0,0,0,.25)',
            pointerEvents:'none',
          }} />

          {/* Rule-of-thirds guides */}
          {[1,2].map(i => (
            <div key={`v${i}`} style={{
              position:'absolute', pointerEvents:'none',
              left: (CONTAINER/2 - CROP_R) + (CROP_R*2/3)*i - 0.5,
              top:  CONTAINER/2 - CROP_R,
              width:1, height:CROP_R*2,
              background:'rgba(255,255,255,.18)',
            }}/>
          ))}
          {[1,2].map(i => (
            <div key={`h${i}`} style={{
              position:'absolute', pointerEvents:'none',
              top:  (CONTAINER/2 - CROP_R) + (CROP_R*2/3)*i - 0.5,
              left: CONTAINER/2 - CROP_R,
              height:1, width:CROP_R*2,
              background:'rgba(255,255,255,.18)',
            }}/>
          ))}
        </div>

        {/* ── Actions ── */}
        <div style={{ display:'flex', gap:10, width:'100%' }}>
          <button
            onClick={handleClose}
            style={{ flex:1, padding:'12px', borderRadius:50, border:'1.5px solid #e5e7eb', background:'transparent', fontSize:13, fontWeight:600, color:'#6b7280', cursor:'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={done || !imgSrc}
            style={{
              flex:2, padding:'12px', borderRadius:50, border:'none',
              background:  done || !imgSrc ? '#e5e7eb' : 'linear-gradient(135deg,#0d9488,#0891b2)',
              color:       done || !imgSrc ? '#9ca3af' : '#fff',
              fontSize:13, fontWeight:700,
              cursor:      done || !imgSrc ? 'default' : 'pointer',
              boxShadow:   done || !imgSrc ? 'none' : '0 8px 20px rgba(13,148,136,.3)',
              transition:  'all .2s',
            }}
          >
            {done ? 'Aplicando...' : 'Aplicar recorte'}
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display:'none' }} />
      </div>
    </>
  )
}
