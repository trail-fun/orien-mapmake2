import type { Cp, CpCandidate } from '../types'

export function generateId(prefix: string, existing: string[]): string {
  const nums = existing
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export function sortByOrder<T extends { usage: string; order: number; number: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pri = (u: string) => u === 'start' ? 0 : (u === 'goal' || u === 'both') ? 2 : 1
    const d = pri(a.usage) - pri(b.usage)
    if (d !== 0) return d
    if (a.order !== b.order) return a.order - b.order
    return a.number - b.number
  })
}

export function cpLabel(number: number, usage: string): string {
  if (usage === 'start') return 'S'
  if (usage === 'goal') return 'F'
  if (usage === 'both') return 'S/F'
  return String(number)
}

export function promoteCandidateToCp(candidate: CpCandidate, existingCps: Cp[]): Cp {
  const id = generateId('cp_', existingCps.map(c => c.id))
  const now = new Date().toISOString()
  return {
    id, type: 'cp',
    number: candidate.number,
    usage: candidate.usage,
    order: candidate.order,
    score: candidate.score,
    acquired_lat: candidate.coordinates[1],
    acquired_lng: candidate.coordinates[0],
    acquired_at: now,
    description: '',
    memo: candidate.memo,
    photos: [],
    source_candidate_id: candidate.id,
    coordinates: [...candidate.coordinates] as [number, number],
  }
}
