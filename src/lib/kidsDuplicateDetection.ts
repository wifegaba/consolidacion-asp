export type DuplicateCheckInput = {
  nombre: string
  apellido?: string | null
  edad?: number | null
  telefono?: string | null
  face_descriptor?: number[] | null
}

export type DuplicateCheckCandidate = DuplicateCheckInput & {
  id: string
  activo?: boolean
}

export type PossibleDuplicate = {
  id: string
  nombre: string
  apellido: string
  score: number
  reasons: string[]
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizedPhone(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j++) {
      const current = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[right.length]
}

function similarity(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length)
  return maxLength ? 1 - levenshtein(left, right) / maxLength : 0
}

function descriptorDistance(left?: number[] | null, right?: number[] | null) {
  if (!left || !right || left.length !== 128 || right.length !== 128) return Infinity
  let sum = 0
  for (let i = 0; i < 128; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) return Infinity
    const delta = left[i] - right[i]
    sum += delta * delta
  }
  return Math.sqrt(sum)
}

/**
 * Encuentra registros que muy probablemente son el mismo niño. Combina datos
 * biográficos y rostro; nunca marca sólo por compartir teléfono/acudiente.
 */
export function findPossibleKidsDuplicates(
  incoming: DuplicateCheckInput,
  candidates: DuplicateCheckCandidate[],
): PossibleDuplicate[] {
  const fullName = normalizeText(`${incoming.nombre} ${incoming.apellido ?? ''}`)
  const firstName = fullName.split(' ')[0] ?? ''
  const phone = normalizedPhone(incoming.telefono)

  if (!fullName) return []

  return candidates.flatMap(candidate => {
    const candidateName = normalizeText(`${candidate.nombre} ${candidate.apellido ?? ''}`)
    const candidateFirstName = candidateName.split(' ')[0] ?? ''
    const nameSimilarity = similarity(fullName, candidateName)
    const sameFirstName = firstName.length >= 3 && firstName === candidateFirstName
    const sameAge = incoming.edad != null && candidate.edad != null && Number(incoming.edad) === Number(candidate.edad)
    const candidatePhone = normalizedPhone(candidate.telefono)
    const samePhone = phone.length >= 7 && candidatePhone === phone
    const faceDistance = descriptorDistance(incoming.face_descriptor, candidate.face_descriptor)
    const reasons: string[] = []
    let score = 0

    if (fullName === candidateName) {
      score = 100
      reasons.push('mismo nombre')
    } else {
      if (sameFirstName) {
        score += 35
        reasons.push('mismo primer nombre')
      }
      if (nameSimilarity >= 0.78) {
        score += Math.round(nameSimilarity * 45)
        reasons.push('nombre muy parecido')
      }
      if (sameAge) {
        score += 15
        reasons.push('misma edad')
      }
      if (samePhone) {
        score += 20
        reasons.push('mismo teléfono')
      }
    }

    // La foto es la señal dominante: una coincidencia facial sólida bloquea el
    // alta aun si el nombre fue escrito distinto.
    if (faceDistance <= 0.48) {
      score = Math.max(score, 99)
      reasons.push('rostro coincidente')
    } else if (faceDistance <= 0.54 && (sameFirstName || sameAge || samePhone)) {
      score = Math.max(score, 90)
      reasons.push('rostro coincidente con datos de respaldo')
    }

    if (score < 80) return []
    return [{
      id: candidate.id,
      nombre: candidate.nombre,
      apellido: candidate.apellido ?? '',
      score: Math.min(score, 100),
      reasons,
    }]
  }).sort((left, right) => right.score - left.score)
}
