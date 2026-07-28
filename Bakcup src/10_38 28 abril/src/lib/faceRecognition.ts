// src/lib/faceRecognition.ts
// Utilities for face-api.js model loading, image enhancement and face matching

export const FACE_MATCH_THRESHOLD = 0.58  // umbral de coincidencia (menor = más estricto)

/** Estado del proceso de detección facial */
export type FaceStatus =
  | 'idle'
  | 'loading_models'
  | 'detecting'
  | 'found'
  | 'not_found'
  | 'error'

let modelsLoaded = false

/** Carga los modelos de face-api.js una sola vez (cliente) */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return

  const fa = await import('face-api.js')

  const MODEL_URL = '/models'   // archivos estáticos en /public/models/
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])

  modelsLoaded = true
}

/** Distancia euclidiana entre dos descriptores (Float32Array o number[]) */
export function faceDistance(
  a: number[] | Float32Array,
  b: number[] | Float32Array,
): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const d = (a as number[])[i] - (b as number[])[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/* ════════════════════════════════════════════════════════════════════════
   MEJORA DE IMAGEN — clave para funcionar en poca luz
════════════════════════════════════════════════════════════════════════ */

/** Carga un dataURL/objectURL como HTMLImageElement */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = src
  })
}

/**
 * Mejora una imagen para detección facial en condiciones de poca luz.
 * Aplica:
 *   1. Estiramiento de contraste (histogram stretch) basado en percentiles
 *   2. Corrección gamma adaptativa según el brillo medio
 *   3. Realce de canal de luminancia
 * Devuelve un canvas listo para pasar a face-api.
 */
export function enhanceImageForDetection(
  source: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  const w = (source as HTMLImageElement).naturalWidth  || source.width
  const h = (source as HTMLImageElement).naturalHeight || source.height

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  const n = data.length / 4

  // 1. Histograma de luminancia
  const hist = new Array(256).fill(0)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0
    hist[lum]++
    sum += lum
  }
  const mean = sum / n

  // 2. Percentiles 1% y 99% (más robusto que min/max absolutos)
  const lowCount  = n * 0.01
  const highCount = n * 0.99
  let acc = 0, pLow = 0, pHigh = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= lowCount)  { pLow = v; break }
  }
  acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= highCount) { pHigh = v; break }
  }

  // 3. Factor de estiramiento de contraste
  const range = Math.max(1, pHigh - pLow)
  const scale = range > 12 ? 255 / range : 1

  // 4. Gamma adaptativa: imagen oscura → aclara; clara → casi neutra
  let gamma = 1
  if      (mean < 70)  gamma = 0.55   // muy oscura
  else if (mean < 100) gamma = 0.70   // oscura
  else if (mean < 130) gamma = 0.85   // tenue
  else if (mean > 200) gamma = 1.15   // sobreexpuesta → baja un poco

  // 5. LUT combinada (estiramiento + gamma)
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) {
    let s = (v - pLow) * scale
    s = s < 0 ? 0 : s > 255 ? 255 : s
    lut[v] = Math.round(255 * Math.pow(s / 255, gamma))
  }

  // 6. Aplicar LUT a cada canal RGB
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/** Decide si una imagen probablemente necesita mejora (oscura o de bajo contraste) */
export function needsEnhancement(source: HTMLImageElement | HTMLCanvasElement): boolean {
  const w = (source as HTMLImageElement).naturalWidth  || source.width
  const h = (source as HTMLImageElement).naturalHeight || source.height
  // Muestreo reducido para velocidad
  const sw = Math.min(160, w), sh = Math.min(120, h)
  const c = document.createElement('canvas')
  c.width = sw; c.height = sh
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, sw, sh)
  const d = ctx.getImageData(0, 0, sw, sh).data
  let sum = 0, min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0
    sum += lum
    if (lum < min) min = lum
    if (lum > max) max = lum
  }
  const mean = sum / (d.length / 4)
  const range = max - min
  return mean < 135 || range < 120   // oscura o bajo contraste
}

/* ════════════════════════════════════════════════════════════════════════
   DETECCIÓN ROBUSTA — multi-intento progresivo
════════════════════════════════════════════════════════════════════════ */

export interface RobustDetection {
  descriptors: Float32Array[]
  enhanced:    boolean
  attempt:     number
  detail:      string
}

/**
 * Detecta rostros con varios intentos progresivos.
 * Escala de "rápido y normal" a "agresivo con mejora de imagen".
 *
 * - multiFace = false (registro): retorna al primer rostro detectado (rápido).
 * - multiFace = true  (asistencia): busca capturar TODOS los rostros (hasta 5+),
 *   quedándose con el intento que detecte la mayor cantidad.
 */
export async function detectFacesRobust(
  dataUrl: string,
  onStatus?: (msg: string) => void,
  multiFace = false,
): Promise<RobustDetection> {
  const fa = await import('face-api.js')
  await loadFaceModels()

  const img = await loadImage(dataUrl)
  const enhanced = enhanceImageForDetection(img)
  const shouldEnhanceFirst = needsEnhancement(img)

  // Configuraciones progresivas. Si la imagen es oscura, empieza ya mejorada.
  // En modo multi-rostro priorizamos inputSize alto + umbral bajo para
  // capturar varias caras (incluso pequeñas o ligeramente giradas) en una pasada.
  const configs: { inputSize: number; score: number; enhance: boolean; label: string }[] =
    multiFace
      ? (shouldEnhanceFirst
          ? [
              { inputSize: 512, score: 0.30, enhance: true,  label: 'multi mejorada 512' },
              { inputSize: 608, score: 0.25, enhance: true,  label: 'multi mejorada 608' },
              { inputSize: 512, score: 0.30, enhance: false, label: 'multi original 512' },
              { inputSize: 416, score: 0.20, enhance: true,  label: 'multi sensible 416' },
            ]
          : [
              { inputSize: 512, score: 0.35, enhance: false, label: 'multi original 512' },
              { inputSize: 512, score: 0.28, enhance: true,  label: 'multi mejorada 512' },
              { inputSize: 608, score: 0.25, enhance: true,  label: 'multi mejorada 608' },
              { inputSize: 416, score: 0.20, enhance: true,  label: 'multi sensible 416' },
            ])
      : (shouldEnhanceFirst
          ? [
              { inputSize: 416, score: 0.35, enhance: true,  label: 'mejorada 416' },
              { inputSize: 512, score: 0.25, enhance: true,  label: 'mejorada 512' },
              { inputSize: 416, score: 0.30, enhance: false, label: 'original 416' },
              { inputSize: 320, score: 0.20, enhance: true,  label: 'mejorada 320 baja' },
            ]
          : [
              { inputSize: 416, score: 0.40, enhance: false, label: 'original 416' },
              { inputSize: 416, score: 0.30, enhance: true,  label: 'mejorada 416' },
              { inputSize: 512, score: 0.25, enhance: true,  label: 'mejorada 512' },
              { inputSize: 320, score: 0.20, enhance: true,  label: 'mejorada 320 baja' },
            ])

  let best: Float32Array[] = []
  let bestEnhanced = false
  let bestLabel = ''
  let bestAttempt = 0

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i]
    const input = cfg.enhance ? enhanced : img
    const opts  = new fa.TinyFaceDetectorOptions({ inputSize: cfg.inputSize, scoreThreshold: cfg.score })

    onStatus?.(`Analizando (${cfg.label})…`)
    try {
      const multi = await fa
        .detectAllFaces(input, opts)
        .withFaceLandmarks()
        .withFaceDescriptors()

      if (multi.length > best.length) {
        best = multi.map(m => m.descriptor)
        bestEnhanced = cfg.enhance
        bestLabel = cfg.label
        bestAttempt = i + 1
      }

      if (!multiFace) {
        // Registro: con 1 rostro basta
        if (best.length >= 1) break
      } else {
        // Asistencia: si ya hay grupo (≥2), confiamos; si hay 1 tras 2 intentos, suficiente
        if (best.length >= 2) break
        if (best.length >= 1 && i >= 1) break
      }
    } catch { /* siguiente intento */ }
  }

  if (best.length > 0) {
    return {
      descriptors: best,
      enhanced: bestEnhanced,
      attempt: bestAttempt,
      detail: `${best.length} rostro(s) · ${bestLabel}`,
    }
  }

  // Último recurso: detección simple sobre imagen mejorada, umbral muy bajo
  onStatus?.('Detección simple final…')
  try {
    const single = await fa
      .detectSingleFace(enhanced, new fa.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.15 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (single) {
      return { descriptors: [single.descriptor], enhanced: true, attempt: configs.length + 1, detail: 'simple final' }
    }
  } catch { /* nada */ }

  return { descriptors: [], enhanced: false, attempt: configs.length + 1, detail: 'sin rostros' }
}

/* ════════════════════════════════════════════════════════════════════════
   EXTRACCIÓN PARA REGISTRO — usa la misma robustez
════════════════════════════════════════════════════════════════════════ */

/**
 * Extrae el descriptor de un rostro desde un File de imagen.
 * Usa mejora de imagen + multi-intento para que el descriptor guardado
 * sea de alta calidad (clave para que el match futuro funcione bien).
 * Retorna null si no se detecta rostro.
 */
export async function extractFaceDescriptor(
  file: File,
  onStatus?: (s: FaceStatus) => void,
): Promise<Float32Array | null> {
  let url: string | null = null
  try {
    onStatus?.('loading_models')
    await loadFaceModels()

    url = URL.createObjectURL(file)
    onStatus?.('detecting')

    const result = await detectFacesRobust(url)

    if (result.descriptors.length > 0) {
      onStatus?.('found')
      // El primer rostro (mayor confianza) es el principal
      return result.descriptors[0]
    }
    onStatus?.('not_found')
    return null
  } catch {
    onStatus?.('error')
    return null
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}
