import { query, queryOne } from '@/lib/db'
import { computeMatchScore } from '@/lib/scoring'
import type { IntroState } from '@/components/MatchCard'

export interface DbProfile {
  id: string
  email: string
  full_name: string
  title: string | null
  firm_name: string
  location: string | null
  aum: string | null
  role: 'angel' | 'family_office'
  sectors: string[]
  stages: string[]
  geography: string[]
  check_size_min: number
  check_size_max: number
  onboarding_completed: boolean
}

interface IntroRow {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined'
  requester_email: string
  recipient_email: string
  created_at: string
}

export interface MatchView {
  id: string
  fullName: string
  title: string | null
  firmName: string
  location: string | null
  aum: string | null
  role: 'angel' | 'family_office'
  sectors: string[]
  stages: string[]
  geography: string[]
  checkSizeMin: number
  checkSizeMax: number
  score: ReturnType<typeof computeMatchScore>
  intro: IntroState
}

function toScoring(p: DbProfile) {
  return {
    id:           p.id,
    email:        p.email,
    role:         p.role,
    firmName:     p.firm_name,
    aum:          p.aum ?? undefined,
    sectors:      p.sectors,
    stages:       p.stages,
    geography:    p.geography,
    checkSizeMin: Number(p.check_size_min),
    checkSizeMax: Number(p.check_size_max),
    createdAt:    '',
    updatedAt:    '',
    bio:          '',
    isVerified:   false,
  }
}

export async function getMe(userId: string): Promise<DbProfile | null> {
  return queryOne<DbProfile>(
    `SELECT id, email, full_name, title, firm_name, location, aum, role,
            sectors, stages, geography, check_size_min, check_size_max,
            onboarding_completed
     FROM profiles WHERE id = $1`,
    [userId]
  )
}

export async function getCandidates(me: DbProfile): Promise<DbProfile[]> {
  const oppositeRole = me.role === 'angel' ? 'family_office' : 'angel'
  // Concierges aren't investable counterparties — they're staff who manage
  // other profiles. Pre-init the column may not exist, so fall back to the
  // unfiltered query if the WHERE clause errors.
  try {
    return await query<DbProfile>(
      `SELECT id, email, full_name, title, firm_name, location, aum, role,
              sectors, stages, geography, check_size_min, check_size_max,
              onboarding_completed
       FROM profiles
       WHERE role = $1 AND onboarding_completed = TRUE AND id != $2
         AND (is_concierge IS NULL OR is_concierge = FALSE)`,
      [oppositeRole, me.id]
    )
  } catch {
    return query<DbProfile>(
      `SELECT id, email, full_name, title, firm_name, location, aum, role,
              sectors, stages, geography, check_size_min, check_size_max,
              onboarding_completed
       FROM profiles
       WHERE role = $1 AND onboarding_completed = TRUE AND id != $2`,
      [oppositeRole, me.id]
    )
  }
}

export async function getIntroductions(userId: string): Promise<IntroRow[]> {
  return query<IntroRow>(
    `SELECT i.id, i.requester_id, i.recipient_id, i.status, i.created_at,
            rp.email AS requester_email, cp.email AS recipient_email
     FROM introductions i
     JOIN profiles rp ON rp.id = i.requester_id
     JOIN profiles cp ON cp.id = i.recipient_id
     WHERE i.requester_id = $1 OR i.recipient_id = $1`,
    [userId]
  )
}

export function buildIntroMap(intros: IntroRow[], userId: string): Map<string, IntroState> {
  const map = new Map<string, IntroState>()
  for (const i of intros) {
    const isOutgoing = i.requester_id === userId
    const otherId    = isOutgoing ? i.recipient_id : i.requester_id
    map.set(otherId, {
      status:       i.status,
      direction:    isOutgoing ? 'outgoing' : 'incoming',
      contactEmail: i.status === 'accepted'
        ? (isOutgoing ? i.recipient_email : i.requester_email)
        : null,
    })
  }
  return map
}

export function toMatchView(c: DbProfile, me: DbProfile, intro?: IntroState): MatchView {
  return {
    id:           c.id,
    fullName:     c.full_name,
    title:        c.title,
    firmName:     c.firm_name,
    location:     c.location,
    aum:          c.aum,
    role:         c.role,
    sectors:      c.sectors,
    stages:       c.stages,
    geography:    c.geography,
    checkSizeMin: Number(c.check_size_min),
    checkSizeMax: Number(c.check_size_max),
    score:        computeMatchScore(toScoring(me), toScoring(c)),
    intro:        intro ?? { status: null, direction: null, contactEmail: null },
  }
}
