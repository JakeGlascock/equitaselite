import { query, queryOne } from './db'
import type { Tier, MandateWeights } from '@/types'

// Per-role mandates (migration 034).
//
// A profile can hold any combination of Angel + Family Office, and each
// investor-side role has its own mandate (check size, sectors, deal
// shape, etc.). Mandates live in a sub-table keyed by (profile_id, role).
//
// Phase C reads from this table; Phase D will drop the now-redundant
// columns from `profiles`. Until then, callers that don't find a
// mandates row fall back to the profile's denormalized columns.

export type Role = 'angel' | 'family_office' | 'next_gen' | 'family_foundation' | 'daf'

export interface Mandate {
  profile_id: string
  role:       Role

  // Pillar 1: Strategic scope
  sectors:        string[]
  sub_sectors:    string[]
  anti_sectors:   string[]
  stages:         string[]
  geography:      string[]
  thematic_focus: string[]

  // Pillar 2: Capital mechanics
  check_size_min:        number
  check_size_max:        number
  check_size_target:     number | null
  deals_per_year:        number | null
  max_concentration_pct: number | null
  lead_capacity:         'lead' | 'follow' | 'either' | null
  co_invest_appetite:    'seeker' | 'open' | 'avoid' | null

  // Pillar 3: Time & risk
  risk_tolerance:              'Conservative' | 'Moderate' | 'Aggressive' | null
  expected_return:             string | null
  timeline:                    string | null
  holding_period_target_years: number | null
  loss_appetite:               'low' | 'moderate' | 'high' | null

  // Pillar 4: Governance & engagement
  engagement_style:       'board' | 'observer' | 'advisory' | 'passive' | null
  diligence_depth:        'light' | 'standard' | 'deep' | null
  decision_timeline_days: number | null

  // Pillar 5: Counterparty profile
  preferred_counterparty_types: string[]
  min_counterparty_tier:        Tier | null
  min_verification_level:       'accredited' | 'qp' | 'kye' | null

  // Pillar 6: Values & alignment
  esg_required:      boolean
  impact_themes:     string[]
  values_exclusions: string[]

  // Top-level mandate
  aum:           string | null
  mandate_type:  string | null
  concentration: string | null

  mandate_weights: MandateWeights
}

const MANDATE_COLUMNS = `
  profile_id, role,
  sectors, sub_sectors, anti_sectors, stages, geography, thematic_focus,
  check_size_min, check_size_max, check_size_target, deals_per_year,
  max_concentration_pct, lead_capacity, co_invest_appetite,
  risk_tolerance, expected_return, timeline,
  holding_period_target_years, loss_appetite,
  engagement_style, diligence_depth, decision_timeline_days,
  preferred_counterparty_types, min_counterparty_tier, min_verification_level,
  esg_required, impact_themes, values_exclusions,
  aum, mandate_type, concentration,
  mandate_weights
`

// Fetch a single mandate by (profile_id, role). Returns null if not
// present (e.g. legacy profile that hasn't been backfilled, or a profile
// that doesn't hold this role).
export async function getMandate(profileId: string, role: Role): Promise<Mandate | null> {
  try {
    return await queryOne<Mandate>(
      `SELECT ${MANDATE_COLUMNS} FROM mandates WHERE profile_id = $1 AND role = $2`,
      [profileId, role],
    )
  } catch {
    // mandates table doesn't exist yet (pre-034). Caller should fall
    // back to profile denormalized columns.
    return null
  }
}

// Fetch all mandates for a profile — used by /profile to render
// per-role mandate editors when a user holds both roles.
export async function getMandatesForProfile(profileId: string): Promise<Mandate[]> {
  try {
    return await query<Mandate>(
      `SELECT ${MANDATE_COLUMNS} FROM mandates WHERE profile_id = $1`,
      [profileId],
    )
  } catch {
    return []
  }
}
