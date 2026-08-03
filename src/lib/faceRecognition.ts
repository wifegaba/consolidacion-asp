// src/lib/faceRecognition.ts
// Utilities for face-api.js model loading, image enhancement and face matching

export const FACE_DESCRIPTOR_LENGTH = 128
export const FACE_MATCH_THRESHOLD = 0.54  // umbral normal (menor = más estricto)
export const FACE_MATCH_STRICT_THRESHOLD = 0.46
export const FACE_MATCH_MIN_MARGIN = 0.04
export const MAX_FACE_IMAGE_BYTES = 15 * 1024 * 1024

/** Estado del proceso de detección facial */
export type FaceStatus =
  | 'idle'
  | 'loading_models'
  | 'detecting'
  | 'found'
  | 'not_found'
  | 'error'

let modelsLoaded = false
let modelsPromise: Promise<void> | null = null

/** Carga los modelos de face-api.js una sola vez (cliente) */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const fa = await import('face-api.js')
      const MODEL_URL = '/models'   // archivos estáticos en /public/models/
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      modelsLoaded = true
    })().catch(error => {
      // Permite reintentar después de una descarga interrumpida o sin red.
      modelsPromise = null
      throw error
    })
  }
  await modelsPromise
}

/** Evita comparar vectores truncados, corruptos o con valores no numéricos. */
export function isValidFaceDescriptor(value: unknown): value is number[] | Float32Array {
  if (!Array.isArray(value) && !(value instanceof Float32Array)) return false
  if (value.length !== FACE_DESCRIPTOR_LENGTH) return false
  for (let i = 0; i < value.length; i++) {
    if (!Number.isFinite(value[i])) return false
  }
  return true
}

/** Distancia euclidiana entre dos descriptores (Float32Array o number[]) */
export function faceDistance(
  a: number[] | Float32Array,
  b: number[] | Float32Array,
): number {
  if (!isValidFaceDescriptor(a) || !isValidFaceDescriptor(b)) return Infinity
  let sum = 0
  for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
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
    el.onload = async () => {
      // En algunos navegadores móviles `load` puede llegar antes de que el
      // decodificador publique naturalWidth/naturalHeight. Esperar `decode`
      // evita crear canvases 0×0 y el IndexSizeError de getImageData.
      try { await el.decode() } catch { /* onload ya confirmó que hay imagen */ }
      if (el.naturalWidth > 0 && el.naturalHeight > 0) resolve(el)
      else reject(new Error('La imagen fue cargada sin dimensiones utilizables.'))
    }
    el.onerror = () => reject(new Error('No fue posible decodificar la imagen.'))
    el.src = src
  })
}

function getSourceDimensions(source: HTMLImageElement | HTMLCanvasElement): { width: number; height: number } | null {
  const rawWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const rawHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const width = Math.floor(Number(rawWidth))
  const height = Math.floor(Number(rawHeight))
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null
  return { width, height }
}

export interface PreparedFaceImage {
  dataUrl: string
  width: number
  height: number
}

/**
 * Valida y normaliza una imagen antes de enviarla al motor facial.
 * Corrige la orientación EXIF cuando el navegador la soporta, limita la
 * resolución para evitar picos de memoria y conserva detalle suficiente
 * para detectar rostros pequeños en fotografías grupales.
 */
export async function prepareFaceImage(
  file: File,
  maxEdge = 1920,
): Promise<PreparedFaceImage> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  const extensionOk = /\.(jpe?g|png|webp)$/i.test(file.name)

  if ((!allowedTypes.has(file.type) && !extensionOk) || file.size === 0) {
    throw new Error('Selecciona una imagen JPG, PNG o WEBP válida.')
  }
  if (file.size > MAX_FACE_IMAGE_BYTES) {
    throw new Error('La imagen supera el límite de 15 MB.')
  }

  let source: CanvasImageSource
  let sourceWidth = 0
  let sourceHeight = 0
  let bitmap: ImageBitmap | null = null
  let objectUrl: string | null = null

  try {
    if ('createImageBitmap' in window) {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      source = bitmap
      sourceWidth = bitmap.width
      sourceHeight = bitmap.height
    } else {
      objectUrl = URL.createObjectURL(file)
      const image = await loadImage(objectUrl)
      source = image
      sourceWidth = image.naturalWidth
      sourceHeight = image.naturalHeight
    }

    if (!sourceWidth || !sourceHeight) {
      throw new Error('No fue posible leer las dimensiones de la imagen.')
    }
    if (Math.min(sourceWidth, sourceHeight) < 160) {
      throw new Error('La imagen es demasiado pequeña para una detección confiable.')
    }

    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('No fue posible preparar la imagen.')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, width, height)

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.94),
      width,
      height,
    }
  } catch (error) {
    if (error instanceof Error && error.message) throw error
    throw new Error('El navegador no pudo decodificar esta imagen.')
  } finally {
    bitmap?.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
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
  const dimensions = getSourceDimensions(source)
  if (!dimensions) throw new Error('La imagen no tiene dimensiones válidas para mejorarla.')
  const { width: w, height: h } = dimensions

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No fue posible preparar el canvas de reconocimiento.')
  let imageData: ImageData
  try {
    // Algunos WebViews Android publican momentáneamente un frame 0×0 después
    // de abrir la cámara. Nunca dejamos que esa condición escape al UI.
    ctx.drawImage(source, 0, 0, w, h)
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    throw new Error('La imagen aún no está lista para el análisis facial.')
  }
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
  const dimensions = getSourceDimensions(source)
  // La validación principal reportará el error; este muestreo opcional nunca
  // debe tumbar la interfaz por un frame todavía no decodificado.
  if (!dimensions) return false
  const { width: w, height: h } = dimensions
  // Muestreo reducido para velocidad
  const sw = Math.min(160, w), sh = Math.min(120, h)
  if (sw < 1 || sh < 1) return false
  const c = document.createElement('canvas')
  c.width = sw; c.height = sh
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(source, 0, 0, sw, sh)
  let d: Uint8ClampedArray
  try {
    d = ctx.getImageData(0, 0, sw, sh).data
  } catch {
    return false
  }
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
  faces:       DetectedFace[]
  enhanced:    boolean
  attempt:     number
  detail:      string
}

export interface DetectedFace {
  descriptor:    Float32Array
  detectionScore: number
  relativeArea:   number
}

export interface RobustDetectionOptions {
  multiFace?: boolean
  exhaustive?: boolean
  shouldContinue?: () => boolean
}

export class FaceDetectionCancelledError extends Error {
  constructor() {
    super('Detección cancelada')
    this.name = 'FaceDetectionCancelledError'
  }
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
  options: RobustDetectionOptions | boolean = {},
  legacyExhaustive = false,
): Promise<RobustDetection> {
  const { multiFace, exhaustive, shouldContinue } = typeof options === 'boolean'
    ? { multiFace: options, exhaustive: legacyExhaustive, shouldContinue: undefined }
    : {
        multiFace: options.multiFace ?? false,
        exhaustive: options.exhaustive ?? false,
        shouldContinue: options.shouldContinue,
      }
  const assertActive = () => {
    if (shouldContinue && !shouldContinue()) throw new FaceDetectionCancelledError()
  }

  assertActive()
  const fa = await import('face-api.js')
  await loadFaceModels()

  assertActive()
  const img = await loadImage(dataUrl)
  const shouldEnhanceFirst = needsEnhancement(img)
  let enhanced: HTMLCanvasElement | null = null
  const getEnhanced = () => {
    enhanced ??= enhanceImageForDetection(img)
    return enhanced
  }

  // Configuraciones progresivas. Si la imagen es oscura, empieza ya mejorada.
  // En modo multi-rostro priorizamos inputSize alto + umbral bajo para
  // capturar varias caras (incluso pequeñas o ligeramente giradas) en una pasada.
  const configs: { inputSize: number; score: number; enhance: boolean; label: string }[] =
    multiFace
      ? (shouldEnhanceFirst
          ? [
              { inputSize: 512, score: 0.30, enhance: true,  label: 'multi mejorada 512' },
              { inputSize: 512, score: 0.30, enhance: false, label: 'multi original 512' },
              { inputSize: 608, score: 0.22, enhance: true,  label: 'multi sensible 608' },
            ]
          : [
              { inputSize: 512, score: 0.35, enhance: false, label: 'multi original 512' },
              { inputSize: 608, score: 0.27, enhance: false, label: 'multi detallada 608' },
              { inputSize: 608, score: 0.22, enhance: true,  label: 'multi mejorada 608' },
            ])
      : (shouldEnhanceFirst
          ? [
              { inputSize: 416, score: 0.35, enhance: true,  label: 'mejorada 416' },
              { inputSize: 416, score: 0.30, enhance: false, label: 'original 416' },
              { inputSize: 512, score: 0.22, enhance: true,  label: 'mejorada 512' },
            ]
          : [
              { inputSize: 416, score: 0.40, enhance: false, label: 'original 416' },
              { inputSize: 512, score: 0.28, enhance: false, label: 'original 512' },
              { inputSize: 512, score: 0.22, enhance: true,  label: 'mejorada 512' },
            ])

  let best: DetectedFace[] = []
  let bestQuality = -Infinity
  let bestEnhanced = false
  let bestLabel = ''
  let bestAttempt = 0
  let previousCount = -1

  for (let i = 0; i < configs.length; i++) {
    assertActive()
    const cfg = configs[i]
    onStatus?.(`Analizando (${cfg.label})…`)
    try {
      const input = cfg.enhance ? getEnhanced() : img
      const opts  = new fa.TinyFaceDetectorOptions({ inputSize: cfg.inputSize, scoreThreshold: cfg.score })
      const multi = await fa
        .detectAllFaces(input, opts)
        .withFaceLandmarks()
        .withFaceDescriptors()

      assertActive()
      const imageArea = Math.max(1, img.naturalWidth * img.naturalHeight)
      const faces: DetectedFace[] = multi.map(m => ({
        descriptor: m.descriptor,
        detectionScore: m.detection.score,
        relativeArea: Math.max(0, (m.detection.box.width * m.detection.box.height) / imageArea),
      }))
      const quality = faces.reduce(
        (sum, face) => sum + face.detectionScore + Math.min(0.15, Math.sqrt(face.relativeArea)),
        0,
      ) / Math.max(1, faces.length)

      if (faces.length > best.length || (faces.length === best.length && quality > bestQuality)) {
        best = faces
        bestQuality = quality
        bestEnhanced = cfg.enhance
        bestLabel = cfg.label
        bestAttempt = i + 1
      }

      if (!multiFace) {
        // Registro: con 1 rostro basta
        if (best.length >= 1) break
      } else {
        const currentCount = faces.length
        const oneClearFace = currentCount === 1
          && faces[0].detectionScore >= 0.72
          && faces[0].relativeArea >= 0.018

        // Cámara: una cara clara o un grupo se resuelven en una sola pasada.
        if (!exhaustive && (currentCount >= 2 || oneClearFace)) break
        // Foto cargada: una segunda pasada sólo se conserva si realmente aporta caras/calidad.
        if (exhaustive && currentCount > 0 && currentCount === previousCount) break
        if (!exhaustive && best.length >= 1 && i >= 1) break
        previousCount = currentCount
      }
    } catch (error) {
      if (error instanceof FaceDetectionCancelledError) throw error
      // Siguiente intento con otra escala/iluminación.
    }
  }

  if (best.length > 0) {
    return {
      descriptors: best.map(face => face.descriptor),
      faces: best,
      enhanced: bestEnhanced,
      attempt: bestAttempt,
      detail: `${best.length} rostro(s) · ${bestLabel}`,
    }
  }

  // Último recurso: detección simple sobre imagen mejorada, umbral muy bajo
  assertActive()
  onStatus?.('Detección simple final…')
  try {
    const single = await fa
      .detectSingleFace(getEnhanced(), new fa.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.18 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    assertActive()
    if (single) {
      const imageArea = Math.max(1, img.naturalWidth * img.naturalHeight)
      const face: DetectedFace = {
        descriptor: single.descriptor,
        detectionScore: single.detection.score,
        relativeArea: Math.max(0, (single.detection.box.width * single.detection.box.height) / imageArea),
      }
      return {
        descriptors: [single.descriptor],
        faces: [face],
        enhanced: true,
        attempt: configs.length + 1,
        detail: 'simple final',
      }
    }
  } catch (error) {
    if (error instanceof FaceDetectionCancelledError) throw error
  }

  return { descriptors: [], faces: [], enhanced: false, attempt: configs.length + 1, detail: 'sin rostros' }
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
  try {
    onStatus?.('loading_models')
    await loadFaceModels()

    onStatus?.('detecting')

    const prepared = await prepareFaceImage(file)
    const result = await detectFacesRobust(prepared.dataUrl)

    if (result.faces.length > 0) {
      onStatus?.('found')
      // En fotos con varias personas, usar el rostro más nítido y dominante;
      // el orden devuelto por el detector no garantiza que sea el principal.
      const primary = [...result.faces].sort((a, b) => {
        const qualityA = a.detectionScore + Math.min(0.25, Math.sqrt(a.relativeArea))
        const qualityB = b.detectionScore + Math.min(0.25, Math.sqrt(b.relativeArea))
        return qualityB - qualityA
      })[0]
      return primary.descriptor
    }
    onStatus?.('not_found')
    return null
  } catch {
    onStatus?.('error')
    return null
  }
}
