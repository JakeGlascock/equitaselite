import { query, queryOne } from '@/lib/db'
import { applyKnockouts, computeMatchScore } from '@/lib/scoring'
import type { Tier } from '@/lib/membership'
import { visibilityWhereFragment } from '@/lib/visibility'
import type { Mandate } from '@/lib/mandates'
import {
  compatibleFlagsWhere, matchRoleCaseExpr,
  type Role as CompatRole,
} from '@/lib/role-compat'
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
  // Off-Market mode (migration 033). Present on `me` so the dashboard
  // can pass it to MatchCard for the intro-reveal banner + render the
  // downgrade-grace banner. Not used in candidate rows directly (those
  // are already filtered by visibility).
  is_off_market?:          boolean | null
  off_market_grace_until?: Date | string | null
  // Multi-role identity flags (migrations 034 + 035). Backfilled from
  // `role` for legacy single-role profiles where applicable. Drive
  // the dashboard role-context toggle for multi-role users.
  is_angel?:             boolean | null
  is_family_office?:     boolean | null
  is_next_gen?:          boolean | null
  is_family_foundation?: boolean | null
  is_daf?:               boolean | null
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

// Merge a per-role mandate into the viewer's profile so scoring helpers
// score against the role-appropriate mandate (Chelsea-as-Angel uses her
// Angel mandate; Chelsea-as-FO uses her FO mandate). Returns the
// original profile untouched when no mandate is provided (legacy
// single-mandate users).
export function applyMandateToProfile(me: DbProfile, mandate: Mandate | null): DbProfile {
  if (!mandate) return me
  // DbProfile.role is the legacy Angel/FO-only column — we don't
  // overwrite it from the wider mandates.role (which includes Next-Gen
  // / Foundation / DAF). Scoring uses the mandate fields below, not
  // the role string, so leaving role alone is correct.
  return {
    ...me,
    sectors:                     mandate.sectors,
    sub_sectors:                 mandate.sub_sectors,
    anti_sectors:                mandate.anti_sectors,
    stages:                      mandate.stages,
    geography:                   mandate.geography,
    thematic_focus:              mandate.thematic_focus,
    check_size_min:              mandate.check_size_min,
    check_size_max:              mandate.check_size_max,
    check_size_target:           mandate.check_size_target,
    deals_per_year:              mandate.deals_per_year,
    max_concentration_pct:       mandate.max_concentration_pct,
    lead_capacity:               mandate.lead_capacity,
    co_invest_appetite:          mandate.co_invest_appetite,
    holding_period_target_years: mandate.holding_period_target_years,
    loss_appetite:               mandate.loss_appetite,
    engagement_style:            mandate.engagement_style,
    diligence_depth:             mandate.diligence_depth,
    decision_timeline_days:      mandate.decision_timeline_days,
    preferred_counterparty_types: mandate.preferred_counterparty_types,
    min_counterparty_tier:        mandate.min_counterparty_tier,
    min_verification_level:       mandate.min_verification_level,
    esg_required:      mandate.esg_required,
    impact_themes:     mandate.impact_themes,
    values_exclusions: mandate.values_exclusions,
    aum:               mandate.aum,
    mandate_weights:   mandate.mandate_weights,
  }
}

export async function getMe(userId: string): Promise<DbProfile | null> {
  // Try the full SELECT first (migration-035 columns); fall back
  // progressively for pre-035 / pre-034 / pre-033 environments.
  try {
    return await queryOne<DbProfile>(
      `SELECT ${PROFILE_COLUMNS}, is_off_market, off_market_grace_until,
              is_angel, is_family_office,
              is_next_gen, is_family_foundation, is_daf
       FROM profiles WHERE id = $1`,
      [userId]
    )
  } catch {
    try {
      return await queryOne<DbProfile>(
        `SELECT ${PROFILE_COLUMNS}, is_off_market, off_market_grace_until,
                is_angel, is_family_office
         FROM profiles WHERE id = $1`,
        [userId]
      )
    } catch {
      try {
        return await queryOne<DbProfile>(
          `SELECT ${PROFILE_COLUMNS}, is_off_market, off_market_grace_until FROM profiles WHERE id = $1`,
          [userId]
        )
      } catch {
        return queryOne<DbProfile>(
          `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`,
          [userId]
        )
      }
    }
  }
}

// viewerRole picks which side of the market the caller is browsing as.
// Multi-role users (Chelsea = Angel + FO) pass this from the dashboard
// context toggle; single-role users default to their (only) role.
//
// Phase E3 switches from bipartite "opposite role" filtering to a
// compatibility-matrix model (lib/role-compat.ts). For viewer-as-X the
// candidate pool is all profiles holding any role in COMPATIBILITY[X].
// The candidate's mandate row to JOIN is picked via a SQL CASE that
// prefers the first compatible role the candidate actually holds.
export async function getCandidates(me: DbProfile, viewerRole?: CompatRole): Promise<DbProfile[]> {
  const fallbackRole = me.role === 'angel' || me.role === 'family_office' ? me.role : null
  const role: CompatRole | null = (viewerRole as CompatRole | undefined) ?? fallbackRole as CompatRole | null
  if (!role) {
    // Concierge-only viewer (no investor role) has no match list.
    return []
  }

  // Demo viewers (investor preview walkthroughs) only see other demo
  // profiles — never real members.
  const demoOnly = me.id.startsWith('demo_')

  // Source mandate fields from mandates(role = <match-side>) when
  // present, else from the denormalized profile columns. The COALESCE
  // pattern keeps legacy single-mandate users working; the match-side
  // role is picked via SQL CASE off the viewer's compatibility list.
  const candidateSelect = `
    p.id, p.email, p.full_name, p.title, p.firm_name, p.location, p.role,
    COALESCE(m.aum,                          p.aum)                          AS aum,
    COALESCE(m.sectors,                      p.sectors)                      AS sectors,
    COALESCE(m.stages,                       p.stages)                       AS stages,
    COALESCE(m.geography,                    p.geography)                    AS geography,
    COALESCE(m.sub_sectors,                  p.sub_sectors)                  AS sub_sectors,
    COALESCE(m.anti_sectors,                 p.anti_sectors)                 AS anti_sectors,
    COALESCE(m.thematic_focus,               p.thematic_focus)               AS thematic_focus,
    COALESCE(m.check_size_min,               p.check_size_min)               AS check_size_min,
    COALESCE(m.check_size_max,               p.check_size_max)               AS check_size_max,
    COALESCE(m.check_size_target,            p.check_size_target)            AS check_size_target,
    COALESCE(m.deals_per_year,               p.deals_per_year)               AS deals_per_year,
    COALESCE(m.max_concentration_pct,        p.max_concentration_pct)        AS max_concentration_pct,
    COALESCE(m.lead_capacity,                p.lead_capacity)                AS lead_capacity,
    COALESCE(m.co_invest_appetite,           p.co_invest_appetite)           AS co_invest_appetite,
    COALESCE(m.holding_period_target_years,  p.holding_period_target_years)  AS holding_period_target_years,
    COALESCE(m.loss_appetite,                p.loss_appetite)                AS loss_appetite,
    COALESCE(m.engagement_style,             p.engagement_style)             AS engagement_style,
    COALESCE(m.diligence_depth,              p.diligence_depth)              AS diligence_depth,
    COALESCE(m.decision_timeline_days,       p.decision_timeline_days)       AS decision_timeline_days,
    COALESCE(m.preferred_counterparty_types, p.preferred_counterparty_types) AS preferred_counterparty_types,
    COALESCE(m.min_counterparty_tier,        p.min_counterparty_tier)        AS min_counterparty_tier,
    COALESCE(m.min_verification_level,       p.min_verification_level)       AS min_verification_level,
    COALESCE(m.esg_required,                 p.esg_required)                 AS esg_required,
    COALESCE(m.impact_themes,                p.impact_themes)                AS impact_themes,
    COALESCE(m.values_exclusions,            p.values_exclusions)            AS values_exclusions,
    COALESCE(m.mandate_weights,              p.mandate_weights)              AS mandate_weights,
    p.membership, p.onboarding_completed
  `

  // WHERE filters candidates to those holding at least one role
  // compatible with the viewer's role. JOIN picks the mandate row for
  // the highest-priority match-side role the candidate holds.
  const matchRoleCase = matchRoleCaseExpr(role, 'p')
  const compatFilter  = compatibleFlagsWhere(role, 'p')
  try {
    return await query<DbProfile>(
      `SELECT ${candidateSelect}
       FROM profiles p
       LEFT JOIN mandates m
         ON m.profile_id = p.id AND m.role = ${matchRoleCase}
       WHERE ${compatFilter}
         AND p.onboarding_completed = TRUE
         AND p.id != $1
         AND (p.is_concierge IS NULL OR p.is_concierge = FALSE)
         ${demoOnly ? `AND p.id LIKE 'demo_%'` : ''}
         AND ${visibilityWhereFragment('p', 1)}`,
      [me.id]
    )
  } catch {
    // Pre-034 fallback: mandates table or is_angel/is_family_office
    // flags don't exist yet. Use the legacy role column directly and
    // the original bipartite opposite filter.
    const oppositeRole = role === 'angel' ? 'family_office' : 'angel'
    return query<DbProfile>(
      `SELECT ${PROFILE_COLUMNS}
       FROM profiles
       WHERE role = $1 AND onboarding_completed = TRUE AND id != $2
         AND (is_concierge IS NULL OR is_concierge = FALSE)
         ${demoOnly ? `AND id LIKE 'demo_%'` : ''}`,
      [oppositeRole, me.id]
    )
  }
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
