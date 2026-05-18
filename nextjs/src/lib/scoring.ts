import type {
  UserProfile, Candidate, MatchScore, MandateWeights,
  PillarScores, KnockoutResult,
} from '@/types'
import { DEFAULT_MANDATE_WEIGHTS } from '@/types'

// ── Sub-score helpers ────────────────────────────────────────────────────

function overlapScore(a: string[] | undefined, b: string[] | undefined): number {
  if (!a?.length || !b?.length) return 0
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

// Categorical match: same value → 1, both null/empty → neutral (configurable),
// one declared and other null → "viewer didn't care" (1) or "candidate hasn't
// declared" (0.5).
function categoricalMatch<T>(a: T | null | undefined, b: T | null | undefined, neutral = 1): number {
  if (a == null && b == null) return neutral
  if (a == null || b == null) return 0.5
  return a === b ? 1 : 0
}

// Ordinal match for 3-step scales (light/standard/deep, low/moderate/high).
// Same value → 1, off-by-one → 0.5, off-by-two → 0.
function ordinalMatch<T extends string>(a: T | null | undefined, b: T | null | undefined, order: readonly T[]): number {
  if (a == null && b == null) return 1
  if (a == null || b == null) return 0.5
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  if (ia < 0 || ib < 0) return 0
  const diff = Math.abs(ia - ib)
  if (diff === 0) return 1
  if (diff === 1) return 0.5
  return 0
}

// ── Pillar scorers ───────────────────────────────────────────────────────
// Each returns { score: 0-100 } plus any sub-components the caller (or
// legacy MatchScore fields) might want to read.

// Each pillar reports its 0-100 score AND whether either side declared
// any data in it. Undeclared pillars are dropped from the weighted total
// (rather than counted as neutral) so unfilled optional fields don't
// drag scores down. Scope and capital are always declared because
// sectors/stages/geo/check-size are required at onboarding.

interface PillarResult { score: number; declared: boolean }
interface ScopeResult extends PillarResult { subs: { sector: number; stage: number; geography: number } }
interface CapitalResult extends PillarResult { subs: { checkSize: number } }

function scopePillar(u: UserProfile | Candidate, c: Candidate | UserProfile): ScopeResult {
  const sector    = overlapScore(u.sectors,       c.sectors)
  const stage     = overlapScore(u.stages,        c.stages)
  const geography = overlapScore(u.geography,     c.geography)
  // Sub-sector and thematic-focus only contribute when at least one side
  // declared them — otherwise they'd pull score down for legacy profiles.
  type Part = { weight: number; score: number }
  const parts: Part[] = [
    { weight: 0.45, score: sector    },
    { weight: 0.35, score: stage     },
    { weight: 0.20, score: geography },
  ]
  if (u.subSectors?.length || c.subSectors?.length) {
    parts.push({ weight: 0.15, score: overlapScore(u.subSectors, c.subSectors) })
  }
  if (u.thematicFocus?.length || c.thematicFocus?.length) {
    parts.push({ weight: 0.10, score: overlapScore(u.thematicFocus, c.thematicFocus) })
  }
  const totalW = parts.reduce((s, p) => s + p.weight, 0)
  const sum    = parts.reduce((s, p) => s + p.weight * p.score, 0)
  const composite = totalW > 0 ? sum / totalW : 0
  return {
    score:    composite * 100,
    declared: true,  // core required fields exist; pillar is always declared
    subs: {
      sector:    sector    * 100,
      stage:     stage     * 100,
      geography: geography * 100,
    },
  }
}

function capitalPillar(u: UserProfile | Candidate, c: Candidate | UserProfile): CapitalResult {
  const checkSize = checkSizeScore(u.checkSizeMin, u.checkSizeMax, c.checkSizeMin, c.checkSizeMax)
  // Target-in-range: small bonus if viewer's target check size falls inside
  // candidate's range (or vice versa). Used as a tiebreaker, not the main
  // signal.
  let targetBonus = 0
  if (u.checkSizeTarget != null && u.checkSizeTarget >= c.checkSizeMin && u.checkSizeTarget <= c.checkSizeMax) {
    targetBonus += 0.1
  }
  if (c.checkSizeTarget != null && c.checkSizeTarget >= u.checkSizeMin && c.checkSizeTarget <= u.checkSizeMax) {
    targetBonus += 0.1
  }
  // Lead/follow compatibility — only down-weights if both sides want the same
  // role (e.g., both want to lead). Neutral when at least one is "either".
  const leadConflict =
    (u.leadCapacity === 'lead'   && c.leadCapacity === 'lead') ||
    (u.leadCapacity === 'follow' && c.leadCapacity === 'follow')
  const leadAdj = leadConflict ? -0.15 : 0
  const composite = Math.max(0, Math.min(1, checkSize + targetBonus + leadAdj))
  return {
    score:    composite * 100,
    declared: true,
    subs:     { checkSize: checkSize * 100 },
  }
}

const LOSS_APPETITE_ORDER = ['low', 'moderate', 'high'] as const
function timeRiskPillar(u: UserProfile | Candidate, c: Candidate | UserProfile): PillarResult {
  let parts = 0
  let sum = 0

  if (u.holdingPeriodTargetYears != null && c.holdingPeriodTargetYears != null) {
    const diff = Math.abs(u.holdingPeriodTargetYears - c.holdingPeriodTargetYears)
    sum += Math.max(0, 1 - diff / 10)  // 0-year diff = 1, 10+ year diff = 0
    parts += 1
  }
  if (u.lossAppetite || c.lossAppetite) {
    sum  += ordinalMatch(u.lossAppetite, c.lossAppetite, LOSS_APPETITE_ORDER)
    parts += 1
  }
  if (parts === 0) return { score: 0, declared: false }
  return { score: (sum / parts) * 100, declared: true }
}

const DILIGENCE_ORDER = ['light', 'standard', 'deep'] as const
function governancePillar(u: UserProfile | Candidate, c: Candidate | UserProfile): PillarResult {
  let parts = 0
  let sum = 0

  if (u.engagementStyle || c.engagementStyle) {
    sum  += categoricalMatch(u.engagementStyle, c.engagementStyle)
    parts += 1
  }
  if (u.diligenceDepth || c.diligenceDepth) {
    sum  += ordinalMatch(u.diligenceDepth, c.diligenceDepth, DILIGENCE_ORDER)
    parts += 1
  }
  if (u.decisionTimelineDays != null && c.decisionTimelineDays != null) {
    const diff = Math.abs(u.decisionTimelineDays - c.decisionTimelineDays)
    sum += Math.max(0, 1 - diff / 60)  // 0-day diff = 1, 60+ day diff = 0
    parts += 1
  }
  if (parts === 0) return { score: 0, declared: false }
  return { score: (sum / parts) * 100, declared: true }
}

function counterpartyPillar(u: UserProfile, c: Candidate): PillarResult {
  // Soft alignment only — min tier / min verification are hard knockouts
  // handled in applyKnockouts(), not scored here.
  let parts = 0
  let sum = 0

  if (u.preferredCounterpartyTypes?.length) {
    sum += u.preferredCounterpartyTypes.includes(c.role) ? 1 : 0
    parts += 1
  }
  if (c.membership && !u.minCounterpartyTier) {
    const tierWeight = { access: 0.5, select: 0.75, sovereign: 1.0 }[c.membership] ?? 0.5
    sum += tierWeight
    parts += 1
  }
  if (parts === 0) return { score: 0, declared: false }
  return { score: (sum / parts) * 100, declared: true }
}

function valuesPillar(u: UserProfile | Candidate, c: Candidate | UserProfile): PillarResult {
  let parts = 0
  let sum = 0

  // ESG match: both sides declared → check equality; only one side
  // declared esg=true → soft penalty (the hard version is a knockout).
  if (u.esgRequired || c.esgRequired) {
    sum += (u.esgRequired === c.esgRequired) ? 1 : 0.5
    parts += 1
  }
  if (u.impactThemes?.length || c.impactThemes?.length) {
    sum  += overlapScore(u.impactThemes, c.impactThemes)
    parts += 1
  }
  if (parts === 0) return { score: 0, declared: false }
  return { score: (sum / parts) * 100, declared: true }
}

// ── Knockouts ────────────────────────────────────────────────────────────

// Returns blocked=true if the viewer's hard filters disqualify the candidate.
// Asymmetric — only applies the VIEWER's filters, never the counterparty's.
export function applyKnockouts(viewer: UserProfile, candidate: Candidate): KnockoutResult {
  // anti_sectors: any overlap between viewer's anti-list and candidate's
  // declared sectors hides the candidate.
  if (viewer.antiSectors?.length) {
    const antiSet = new Set(viewer.antiSectors)
    if (candidate.sectors.some(s => antiSet.has(s))) {
      return { blocked: true, reason: 'anti_sectors' }
    }
  }

  // values_exclusions: applied across the candidate's sectors and
  // impact themes (an exclusion can be either kind).
  if (viewer.valuesExclusions?.length) {
    const exclSet = new Set(viewer.valuesExclusions)
    const candTags = [...candidate.sectors, ...(candidate.impactThemes ?? [])]
    if (candTags.some(t => exclSet.has(t))) {
      return { blocked: true, reason: 'values_exclusions' }
    }
  }

  // Minimum counterparty tier (membership). Order from the EE pricing model.
  if (viewer.minCounterpartyTier) {
    const rank = { access: 1, select: 2, sovereign: 3 } as const
    const candRank = candidate.membership ? rank[candidate.membership] : 0
    if (candRank < rank[viewer.minCounterpartyTier]) {
      return { blocked: true, reason: 'min_counterparty_tier' }
    }
  }

  // ESG required: if viewer requires ESG and the candidate's profile
  // doesn't carry esgRequired=TRUE, they're out.
  if (viewer.esgRequired && !candidate.esgRequired) {
    return { blocked: true, reason: 'esg_required' }
  }

  return { blocked: false }
}

// ── Public API ───────────────────────────────────────────────────────────

function pickWeights(viewer: UserProfile | undefined): MandateWeights {
  return viewer?.mandateWeights ?? DEFAULT_MANDATE_WEIGHTS
}

export function computeMatchScore(
  user:      UserProfile,
  candidate: Candidate,
  weights:   MandateWeights = pickWeights(user),
): MatchScore {
  const scope        = scopePillar(user, candidate)
  const capital      = capitalPillar(user, candidate)
  const timeRisk     = timeRiskPillar(user, candidate)
  const governance   = governancePillar(user, candidate)
  const counterparty = counterpartyPillar(user, candidate)
  const values       = valuesPillar(user, candidate)

  const pillars: PillarScores = {
    scope:        Math.round(scope.score),
    capital:      Math.round(capital.score),
    timeRisk:     Math.round(timeRisk.score),
    governance:   Math.round(governance.score),
    counterparty: Math.round(counterparty.score),
    values:       Math.round(values.score),
  }

  // Weighted total. Only DECLARED pillars contribute — undeclared ones
  // are dropped from both the numerator and the weight denominator so an
  // unfilled optional pillar can't pull a perfect core match below 99.
  // The denominator is re-normalized over the surviving pillars, so a
  // scope-only profile gets a total based purely on scope alignment.
  const contribs: Array<{ score: number; weight: number }> = []
  if (scope.declared)        contribs.push({ score: pillars.scope,        weight: weights.scope        })
  if (capital.declared)      contribs.push({ score: pillars.capital,      weight: weights.capital      })
  if (timeRisk.declared)     contribs.push({ score: pillars.timeRisk,     weight: weights.timeRisk     })
  if (governance.declared)   contribs.push({ score: pillars.governance,   weight: weights.governance   })
  if (counterparty.declared) contribs.push({ score: pillars.counterparty, weight: weights.counterparty })
  if (values.declared)       contribs.push({ score: pillars.values,       weight: weights.values       })

  const norm = contribs.reduce((s, p) => s + p.weight, 0)
  const rawTotal = norm > 0
    ? contribs.reduce((s, p) => s + (p.score * p.weight) / norm, 0)
    : 0

  const total = Math.min(99, Math.round(rawTotal))

  let label: MatchScore['label']
  if      (total >= 80) label = 'Strong Fit'
  else if (total >= 65) label = 'Good Fit'
  else if (total >= 50) label = 'Possible Fit'
  else                   label = 'Low Fit'

  return {
    total,
    // Legacy fields — derived from the scope/capital sub-components so
    // existing UI (MatchCard) keeps working without changes.
    sector:    Math.round(scope.subs.sector),
    stage:     Math.round(scope.subs.stage),
    geography: Math.round(scope.subs.geography),
    checkSize: Math.round(capital.subs.checkSize),
    label,
    pillars,
  }
}
