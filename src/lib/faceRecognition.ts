// src/lib/faceRecognition.ts
// ─── Servicio de extracción de descriptores faciales (solo cliente) ───────────
// Usa face-api.js con modelos TinyFaceDetector + FaceLandmark68 + FaceRecognition
// Los modelos deben estar en /public/models/ (7 archivos descargados de GitHub)

export type FaceStatus = 'idle' | 'loading_models' | 'detecting' | 'found' | 'not_found' | 'error'

// Indica si los archivos de modelos ya fueron confirmados como disponibles
let _modelsAvailable: boolean | null = null   // null = aún sin verificar

let _faceapi: typeof import('face-api.js') | null = null
let _modelsLoaded = false
let _loadingPromise: Promise<void> | null = null

const MODEL_URL = '/models'

/* ── Carga lazy de face-api.js (evita problemas de SSR) ── */
async function getFaceApi() {
  if (_faceapi) return _faceapi
  _faceapi = await import('face-api.js')
  return _faceapi
}

/* ── Verifica si el archivo de manifiesto del primer modelo existe ── */
async function checkModelsAvailable(): Promise<boolean> {
  if (_modelsAvailable !== null) return _modelsAvailable
  try {
    const res = await fetch(`${MODEL_URL}/tiny_face_detector_model-weights_manifest.json`, { method: 'HEAD' })
    _modelsAvailable = res.ok
  } catch {
    _modelsAvailable = false
  }
  return _modelsAvailable
}

/* ── Carga de modelos (ejecuta solo una vez) ── */
export async function loadFaceModels(): Promise<void> {
  if (_modelsLoaded) return
  if (_loadingPromise) return _loadingPromise

  _loadingPromise = (async () => {
    try {
      const fa = await getFaceApi()
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      _modelsLoaded = true
      _modelsAvailable = true
    } catch (e) {
      _loadingPromise = null   // permite reintentar
      throw e
    }
  })()

  return _loadingPromise
}

/* ── Extrae descriptor de 128 dimensiones a partir de un File de imagen ── */
export async function extractFaceDescriptor(
  file: File,
  onStatus?: (s: FaceStatus) => void,
): Promise<number[] | null> {
  try {
    // Verificar primero si los modelos existen en /public/models/
    // Si no están descargados, ignorar silenciosamente (sin badge de error)
    const available = await checkModelsAvailable()
    if (!available) {
      // Modelos no descargados aún — no mostrar nada, foto se guarda igual
      return null
    }

    // Cargar modelos (solo si existen)
    onStatus?.('loading_models')
    await loadFaceModels()

    // Crear elemento <img> a partir del File
    onStatus?.('detecting')
    const fa  = await getFaceApi()
    const url = URL.createObjectURL(file)

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload  = () => resolve(el)
      el.onerror = reject
      el.src     = url
    })

    // Detectar el rostro más prominente
    const detection = await fa
      .detectSingleFace(img, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    URL.revokeObjectURL(url)

    if (!detection) {
      onStatus?.('not_found')
      return null
    }

    onStatus?.('found')
    return Array.from(detection.descriptor)  // Float32Array → number[]
  } catch (e: any) {
    console.error('[faceRecognition] ❌', e.message)
    onStatus?.('error')
    return null
  }
}

/* ── Calcula distancia euclidiana entre dos descriptores ── */
export function faceDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

/* ── Umbral recomendado: < 0.5 = misma persona ── */
export const FACE_MATCH_THRESHOLD = 0.5
