import { query, queryOne } from '@/lib/db'
import { applyKnockouts, computeMatchScore } from '@/lib/scoring'
import type { Tier } from '@/lib/membership'
import type { IntroState } from '@/components/MatchCard'
import type {
  UserProfile, Candidate, MandateWeights,
} from '@/types'

// Phase 6 expanded the on-disk profile shape to cover all six mandate
// pillars. DbProfile here mirrors the new schema. Existing rows have
// safe defaults (empty arrays / nulls / default weights) from migration
// 028 so this is backward-compatible at the data layer.
export interface DbProfile {
  id: string
  email: string
  full_name: string
  title: string | null
  firm_name: string
  location: string | null
  aum: string | null
  role: 'angel' | 'family_office'

  // Pillar 1
  sectors:        string[]
  stages:         string[]
  geography:      string[]
  sub_sectors?:    string[]
  anti_sectors?:   string[]
  thematic_focus?: string[]

  // Pillar 2
  check_size_min:           number
  check_size_max:           number
  check_size_target?:        number | null
  deals_per_year?:           number | null
  max_concentration_pct?:    number | null
  lead_capacity?:            'lead' | 'follow' | 'either' | null
  co_invest_appetite?:       'seeker' | 'open' | 'avoid' | null

  // Pillar 3
  holding_period_target_years?: number | null
  loss_appetite?:               'low' | 'moderate' | 'high' | null

  // Pillar 4
  engagement_style?:        'board' | 'observer' | 'advisory' | 'passive' | null
  diligence_depth?:         'light' | 'standard' | 'deep' | null
  decision_timeline_days?:  number | null

  // Pillar 5
  preferred_counterparty_types?: string[]
  min_counterparty_tier?:        Tier | null
  min_verification_level?:       'accredited' | 'qp' | 'kye' | null

  // Pillar 6
  esg_required?:      boolean
  impact_themes?:     string[]
  values_exclusions?: string[]

  mandate_weights?: MandateWeights

  onboarding_completed: boolean
  // Optional — present iff the membership column has been initialized.
  // Drives priority placement in match sort. Null/missing = lowest priority.
  membership?: Tier | null
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

const PROFILE_COLUMNS = `
  id, email, full_name, title, firm_name, location, aum, role,
  sectors, stages, geography, sub_sectors, anti_sectors, thematic_focus,
  check_size_min, check_size_max, check_size_target, deals_per_year,
  max_concentration_pct, lead_capacity, co_invest_appetite,
  holding_period_target_years, loss_appetite,
  engagement_style, diligence_depth, decision_timeline_days,
  preferred_counterparty_types, min_counterparty_tier, min_verification_level,
  esg_required, impact_themes, values_exclusions,
  mandate_weights, membership, onboarding_completed
`

// snake_case (DB) → camelCase (scoring). Defaults absent fields to safe
// empty values so scoring helpers don't have to defend against undefined.
function toScoringProfile(p: DbProfile): UserProfile {
  return {
    id:           p.id,
    email:        p.email,
    role:         p.role,
    firmName:     p.firm_name,
    aum:          p.aum ?? undefined,
    sectors:      p.sectors,
    stages:       p.stages,
    geography:    p.geography,
    subSectors:    p.sub_sectors    ?? [],
    antiSectors:   p.anti_sectors   ?? [],
    thematicFocus: p.thematic_focus ?? [],
    checkSizeMin:        Number(p.check_size_min),
    checkSizeMax:        Number(p.check_size_max),
    checkSizeTarget:     p.check_size_target != null ? Number(p.check_size_target) : null,
    dealsPerYear:        p.deals_per_year != null ? Number(p.deals_per_year) : null,
    maxConcentrationPct: p.max_concentration_pct != null ? Number(p.max_concentration_pct) : null,
    leadCapacity:        p.lead_capacity      ?? null,
    coInvestAppetite:    p.co_invest_appetite ?? null,
    holdingPeriodTargetYears: p.holding_period_target_years != null ? Number(p.holding_period_target_years) : null,
    lossAppetite:             p.loss_appetite ?? null,
    engagementStyle:        p.engagement_style       ?? null,
    diligenceDepth:         p.diligence_depth        ?? null,
    decisionTimelineDays:   p.decision_timeline_days != null ? Number(p.decision_timeline_days) : null,
    preferredCounterpartyTypes: p.preferred_counterparty_types ?? [],
    minCounterpartyTier:        p.min_counterparty_tier        ?? null,
    minVerificationLevel:       p.min_verification_level       ?? null,
    esgRequired:      p.esg_required      ?? false,
    impactThemes:     p.impact_themes     ?? [],
    valuesExclusions: p.values_exclusions ?? [],
    mandateWeights:   p.mandate_weights,
    membership:       p.membership ?? null,
    createdAt:        '',
    updatedAt:        '',
  }
}

function toCandidateProfile(p: DbProfile): Candidate {
  const sp = toScoringProfile(p)
  return {
    ...sp,
    bio:        '',
    isVerified: false,
  }
}

export async function getMe(userId: string): Promise<DbProfile | null> {
  return queryOne<DbProfile>(
    `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`,
    [userId]
  )
}

export async function getCandidates(me: DbProfile): Promise<DbProfile[]> {
  const oppositeRole = me.role === 'angel' ? 'family_office' : 'angel'
  return query<DbProfile>(
    `SELECT ${PROFILE_COLUMNS}
     FROM profiles
     WHERE role = $1 AND onboarding_completed = TRUE AND id != $2
       AND (is_concierge IS NULL OR is_concierge = FALSE)`,
    [oppositeRole, me.id]
  )
}

// Filters candidates through the viewer's knockouts. Returns the survivors.
// Asymmetric — only applies the viewer's hard filters, never the candidate's.
export function filterByKnockouts(me: DbProfile, candidates: DbProfile[]): DbProfile[] {
  const viewerSP = toScoringProfile(me)
  return candidates.filter(c => !applyKnockouts(viewerSP, toCandidateProfile(c)).blocked)
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
    score:        computeMatchScore(toScoringProfile(me), toCandidateProfile(c)),
    intro:        intro ?? { status: null, direction: null, contactEmail: null },
  }
}
