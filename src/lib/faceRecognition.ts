// src/lib/faceRecognition.ts
// Utilities for face-api.js model loading and face matching

export const FACE_MATCH_THRESHOLD = 0.58  // menor = más estricto (0.48 era el caso límite)

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

/**
 * Extrae el descriptor de un rostro desde un File de imagen.
 * Llama a onStatus en cada etapa del proceso.
 * Retorna null si no se detecta rostro.
 */
export async function extractFaceDescriptor(
  file: File,
  onStatus?: (s: FaceStatus) => void,
): Promise<Float32Array | null> {
  try {
    onStatus?.('loading_models')
    await loadFaceModels()

    const fa  = await import('face-api.js')
    const url = URL.createObjectURL(file)

    try {
      onStatus?.('detecting')

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el   = new Image()
        el.onload  = () => resolve(el)
        el.onerror = reject
        el.src     = url
      })

      const detection = await fa
        .detectSingleFace(img, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 }))
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (detection) {
        onStatus?.('found')
        return detection.descriptor
      } else {
        onStatus?.('not_found')
        return null
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    onStatus?.('error')
    return null
  }
}
