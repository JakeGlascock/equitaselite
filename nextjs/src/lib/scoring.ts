import type { UserProfile, Candidate, MatchScore } from '@/types'

function overlapScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setB = new Set(b)
  const matches = a.filter(x => setB.has(x)).length
  return matches / Math.max(a.length, b.length)
}

function checkSizeScore(
  min1: number, max1: number,
  min2: number, max2: number
): number {
  const lo = Math.max(min1, min2)
  const hi = Math.min(max1, max2)
  if (lo > hi) return 0
  const overlap = hi - lo
  const span = Math.max(max1, max2) - Math.min(min1, min2)
  return span > 0 ? overlap / span : 1
}

export function computeMatchScore(user: UserProfile, candidate: Candidate): MatchScore {
  const sector    = overlapScore(user.sectors, candidate.sectors)
  const stage     = overlapScore(user.stages, candidate.stages)
  const checkSize = checkSizeScore(user.checkSizeMin, user.checkSizeMax, candidate.checkSizeMin, candidate.checkSizeMax)
  const geography = overlapScore(user.geography, candidate.geography)

  const raw = sector * 40 + stage * 30 + checkSize * 20 + geography * 10
  const total = Math.min(99, Math.round(raw))

  let label: MatchScore['label']
  if (total >= 80) label = 'Strong Fit'
  else if (total >= 65) label = 'Good Fit'
  else if (total >= 50) label = 'Possible Fit'
  else label = 'Low Fit'

  return {
    total,
    sector:    Math.round(sector * 100),
    stage:     Math.round(stage * 100),
    checkSize: Math.round(checkSize * 100),
    geography: Math.round(geography * 100),
    label,
  }
}
