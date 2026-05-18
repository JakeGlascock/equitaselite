export type UserRole = 'angel' | 'family_office'

export type Tier = 'access' | 'select' | 'sovereign'

// The six mandate pillars. Each contributes a 0-100 sub-score, combined
// using the viewer's MandateWeights for an asymmetric total.
export type Pillar = 'scope' | 'capital' | 'timeRisk' | 'governance' | 'counterparty' | 'values'

export interface MandateWeights {
  scope:        number  // 0-100, all six should sum to 100
  capital:      number
  timeRisk:     number
  governance:   number
  counterparty: number
  values:       number
}

export const DEFAULT_MANDATE_WEIGHTS: MandateWeights = {
  scope:        40,
  capital:      25,
  timeRisk:     10,
  governance:   5,
  counterparty: 10,
  values:       10,
}

export interface PillarScores {
  scope:        number  // 0-100
  capital:      number
  timeRisk:     number
  governance:   number
  counterparty: number
  values:       number
}

// Fields below the legacy ones are added for Phase 6 mandate pillars.
// Every new field is optional so existing callers and fixtures keep
// working; scoring treats absent fields as "no preference declared"
// rather than hard zero where it makes sense.
export interface UserProfile {
  id: string
  email: string
  role: UserRole
  firmName: string
  aum?: string
  // Pillar 1 — Strategic scope
  sectors: string[]
  stages: string[]
  geography: string[]
  subSectors?:    string[]
  antiSectors?:   string[]
  thematicFocus?: string[]
  // Pillar 2 — Capital mechanics
  checkSizeMin: number
  checkSizeMax: number
  checkSizeTarget?:     number | null
  dealsPerYear?:        number | null
  maxConcentrationPct?: number | null
  leadCapacity?:        'lead' | 'follow' | 'either' | null
  coInvestAppetite?:    'seeker' | 'open' | 'avoid' | null
  // Pillar 3 — Time & risk
  holdingPeriodTargetYears?: number | null
  lossAppetite?:             'low' | 'moderate' | 'high' | null
  // Pillar 4 — Governance & engagement
  engagementStyle?:      'board' | 'observer' | 'advisory' | 'passive' | null
  diligenceDepth?:       'light' | 'standard' | 'deep' | null
  decisionTimelineDays?: number | null
  // Pillar 5 — Counterparty profile (used mostly as knockouts; see below)
  preferredCounterpartyTypes?: string[]
  minCounterpartyTier?:        Tier | null
  minVerificationLevel?:       'accredited' | 'qp' | 'kye' | null
  // Pillar 6 — Values & alignment
  esgRequired?:      boolean
  impactThemes?:     string[]
  valuesExclusions?: string[]
  // Personalization
  mandateWeights?: MandateWeights
  // EE-specific
  membership?: Tier | null
  createdAt: string
  updatedAt: string
}

// Candidate is the counterparty being scored. Same field set as
// UserProfile minus the viewer-personalization knobs — we never apply a
// counterparty's weights / knockouts to our own view of them.
export interface Candidate {
  id: string
  role: UserRole
  firmName: string
  aum?: string
  sectors: string[]
  stages: string[]
  geography: string[]
  subSectors?:    string[]
  antiSectors?:   string[]
  thematicFocus?: string[]
  checkSizeMin: number
  checkSizeMax: number
  checkSizeTarget?:     number | null
  dealsPerYear?:        number | null
  maxConcentrationPct?: number | null
  leadCapacity?:        'lead' | 'follow' | 'either' | null
  coInvestAppetite?:    'seeker' | 'open' | 'avoid' | null
  holdingPeriodTargetYears?: number | null
  lossAppetite?:             'low' | 'moderate' | 'high' | null
  engagementStyle?:      'board' | 'observer' | 'advisory' | 'passive' | null
  diligenceDepth?:       'light' | 'standard' | 'deep' | null
  decisionTimelineDays?: number | null
  esgRequired?:      boolean
  impactThemes?:     string[]
  valuesExclusions?: string[]
  membership?: Tier | null
  bio: string
  linkedinUrl?: string
  isVerified: boolean
}

export type KnockoutReason =
  | 'anti_sectors'
  | 'min_counterparty_tier'
  | 'esg_required'
  | 'values_exclusions'

export interface KnockoutResult {
  blocked: boolean
  reason?: KnockoutReason
}

export interface MatchScore {
  total: number
  // Legacy sub-scores. Derived from the scope / capital pillar internals
  // so MatchCard and existing tests keep working.
  sector: number
  stage: number
  checkSize: number
  geography: number
  label: 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Low Fit'
  // Phase 6 — per-pillar breakdown. Optional so old MatchScore consumers
  // keep compiling.
  pillars?: PillarScores
}

export interface Deal {
  id: string
  title: string
  status: 'open' | 'closing' | 'closed'
  targetAmount: number
  committedAmount: number
  participants: string[]
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: 'new_match' | 'deal_update' | 'message' | 'document'
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}
