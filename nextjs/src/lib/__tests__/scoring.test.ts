import { describe, it, expect } from 'vitest'
import { computeMatchScore, applyKnockouts } from '../scoring'
import type { UserProfile, Candidate, MandateWeights } from '@/types'

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    email: 'test@firm.com',
    role: 'family_office',
    firmName: 'Test Family Office',
    sectors: ['Technology', 'Healthcare'],
    stages: ['Series A', 'Series B'],
    geography: ['North America'],
    checkSizeMin: 1_000_000,
    checkSizeMax: 5_000_000,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  }
}

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    role: 'angel',
    firmName: 'Test Angel',
    sectors: ['Technology', 'Healthcare'],
    stages: ['Series A', 'Series B'],
    geography: ['North America'],
    checkSizeMin: 1_000_000,
    checkSizeMax: 5_000_000,
    bio: 'Test bio',
    isVerified: false,
    ...overrides,
  }
}

describe('computeMatchScore — legacy sub-scores', () => {
  it('populates sector / stage / checkSize / geography from the scope+capital pillars', () => {
    const score = computeMatchScore(makeUser(), makeCandidate())
    expect(score.sector).toBe(100)
    expect(score.stage).toBe(100)
    expect(score.geography).toBe(100)
    expect(score.checkSize).toBe(100)
  })

  it('scores sector partial overlap by max-set fraction', () => {
    const score = computeMatchScore(
      makeUser({ sectors: ['Technology', 'Healthcare'] }),
      makeCandidate({ sectors: ['Technology', 'Real Estate'] }),
    )
    expect(score.sector).toBe(50)
  })

  it('returns 0 for sector when either side is empty', () => {
    expect(computeMatchScore(makeUser({ sectors: [] }), makeCandidate()).sector).toBe(0)
    expect(computeMatchScore(makeUser(), makeCandidate({ sectors: [] })).sector).toBe(0)
  })

  it('check-size scores proportionally on partial range overlap', () => {
    // user 0-4M, candidate 2-6M → overlap 2M / span 6M ≈ 33
    const score = computeMatchScore(
      makeUser({ checkSizeMin: 0, checkSizeMax: 4_000_000 }),
      makeCandidate({ checkSizeMin: 2_000_000, checkSizeMax: 6_000_000 }),
    )
    expect(score.checkSize).toBe(33)
  })

  it('check-size returns 0 on disjoint ranges', () => {
    const score = computeMatchScore(
      makeUser({ checkSizeMin: 100_000, checkSizeMax: 500_000 }),
      makeCandidate({ checkSizeMin: 1_000_000, checkSizeMax: 5_000_000 }),
    )
    expect(score.checkSize).toBe(0)
  })

  it('check-size collapses to 100 when both ranges are the same single point', () => {
    const score = computeMatchScore(
      makeUser({ checkSizeMin: 1_000_000, checkSizeMax: 1_000_000 }),
      makeCandidate({ checkSizeMin: 1_000_000, checkSizeMax: 1_000_000 }),
    )
    expect(score.checkSize).toBe(100)
  })
})

describe('computeMatchScore — total + label', () => {
  it('caps total at 99 for a perfect scope+capital match', () => {
    const score = computeMatchScore(makeUser(), makeCandidate())
    expect(score.total).toBe(99)
    expect(score.label).toBe('Strong Fit')
  })

  it('returns 0 / Low Fit on no overlap anywhere', () => {
    const score = computeMatchScore(
      makeUser({ sectors: ['X'], stages: ['Seed'], geography: ['Europe'], checkSizeMin: 1, checkSizeMax: 2 }),
      makeCandidate({ sectors: ['Y'], stages: ['Series C'], geography: ['Asia'], checkSizeMin: 100, checkSizeMax: 200 }),
    )
    expect(score.total).toBe(0)
    expect(score.label).toBe('Low Fit')
  })

  it('a scope-perfect, capital-zero match is no longer Strong Fit', () => {
    // Capital matters now — disjoint check ranges drag the total below 80
    // even if everything else aligns. This was Strong Fit in the legacy
    // weighting and is intentionally not anymore.
    const score = computeMatchScore(
      makeUser({ checkSizeMin: 1, checkSizeMax: 2 }),
      makeCandidate({ checkSizeMin: 100, checkSizeMax: 200 }),
    )
    expect(score.label).not.toBe('Strong Fit')
  })
})

describe('computeMatchScore — undeclared pillars drop out of weighting', () => {
  it('a profile with only scope+capital filled scores purely on those pillars', () => {
    // No timeRisk / governance / counterparty / values fields declared.
    // Total should ignore those weights entirely; perfect scope+capital → 99.
    const score = computeMatchScore(makeUser(), makeCandidate())
    expect(score.total).toBe(99)
  })

  it('a declared timeRisk pillar contributes to the total when both sides set it', () => {
    const baseScore = computeMatchScore(makeUser(), makeCandidate()).total
    const withTimeRiskMatch = computeMatchScore(
      makeUser({ holdingPeriodTargetYears: 5, lossAppetite: 'moderate' }),
      makeCandidate({ holdingPeriodTargetYears: 5, lossAppetite: 'moderate' }),
    ).total
    const withTimeRiskMismatch = computeMatchScore(
      makeUser({ holdingPeriodTargetYears: 1, lossAppetite: 'low' }),
      makeCandidate({ holdingPeriodTargetYears: 9, lossAppetite: 'high' }),
    ).total
    expect(withTimeRiskMatch).toBeGreaterThanOrEqual(baseScore - 1)
    expect(withTimeRiskMismatch).toBeLessThan(baseScore)
  })

  it('declaring esg_required on both sides keeps the total high', () => {
    const score = computeMatchScore(
      makeUser({ esgRequired: true }),
      makeCandidate({ esgRequired: true }),
    )
    expect(score.total).toBeGreaterThanOrEqual(95)
  })
})

describe('computeMatchScore — asymmetric weights', () => {
  // The same pair can score differently for each side depending on whose
  // weights are applied. Capital-heavy viewer values check-size overlap
  // more; scope-heavy viewer punishes check mismatch less.
  it('weight redistribution changes the total for the same pair', () => {
    const u = makeUser({ checkSizeMin: 1, checkSizeMax: 2 })  // tiny
    const c = makeCandidate()                                  // 1M-5M

    const capitalHeavy: MandateWeights = {
      scope: 5, capital: 80, timeRisk: 0, governance: 0, counterparty: 0, values: 15,
    }
    const scopeHeavy: MandateWeights = {
      scope: 80, capital: 5, timeRisk: 0, governance: 0, counterparty: 0, values: 15,
    }
    const capitalView = computeMatchScore(u, c, capitalHeavy).total
    const scopeView   = computeMatchScore(u, c, scopeHeavy).total
    expect(scopeView).toBeGreaterThan(capitalView)
  })

  it('normalizes non-100-summing weight bundles defensively', () => {
    // Doubled weights still produce the same effective totals — guards
    // against garbage in the DB.
    const wA: MandateWeights = { scope: 40, capital: 25, timeRisk: 10, governance: 5, counterparty: 10, values: 10 }
    const wB: MandateWeights = { scope: 80, capital: 50, timeRisk: 20, governance: 10, counterparty: 20, values: 20 }
    const a = computeMatchScore(makeUser(), makeCandidate(), wA).total
    const b = computeMatchScore(makeUser(), makeCandidate(), wB).total
    expect(a).toBe(b)
  })
})

describe('applyKnockouts', () => {
  it('passes through when no knockouts set', () => {
    const res = applyKnockouts(makeUser(), makeCandidate())
    expect(res.blocked).toBe(false)
  })

  it('blocks on anti_sectors overlap', () => {
    const res = applyKnockouts(
      makeUser({ antiSectors: ['Gambling', 'Defense'] }),
      makeCandidate({ sectors: ['Defense', 'AI'] }),
    )
    expect(res.blocked).toBe(true)
    expect(res.reason).toBe('anti_sectors')
  })

  it('does not block when anti_sectors does not overlap', () => {
    const res = applyKnockouts(
      makeUser({ antiSectors: ['Gambling'] }),
      makeCandidate({ sectors: ['Healthcare'] }),
    )
    expect(res.blocked).toBe(false)
  })

  it('blocks on values_exclusions matching candidate sectors', () => {
    const res = applyKnockouts(
      makeUser({ valuesExclusions: ['Fossil Fuels'] }),
      makeCandidate({ sectors: ['Fossil Fuels', 'Healthcare'] }),
    )
    expect(res.blocked).toBe(true)
    expect(res.reason).toBe('values_exclusions')
  })

  it('blocks on values_exclusions matching candidate impact themes', () => {
    const res = applyKnockouts(
      makeUser({ valuesExclusions: ['Carbon-positive'] }),
      makeCandidate({ impactThemes: ['Carbon-positive'] }),
    )
    expect(res.blocked).toBe(true)
    expect(res.reason).toBe('values_exclusions')
  })

  it('blocks when candidate tier is below viewer min_counterparty_tier', () => {
    const res = applyKnockouts(
      makeUser({ minCounterpartyTier: 'sovereign' }),
      makeCandidate({ membership: 'select' }),
    )
    expect(res.blocked).toBe(true)
    expect(res.reason).toBe('min_counterparty_tier')
  })

  it('passes when candidate tier meets or exceeds viewer min_counterparty_tier', () => {
    const ok = applyKnockouts(
      makeUser({ minCounterpartyTier: 'select' }),
      makeCandidate({ membership: 'sovereign' }),
    )
    expect(ok.blocked).toBe(false)
  })

  it('blocks when candidate has no membership and viewer requires one', () => {
    const res = applyKnockouts(
      makeUser({ minCounterpartyTier: 'access' }),
      makeCandidate({ membership: null }),
    )
    expect(res.blocked).toBe(true)
  })

  it('blocks when viewer requires ESG and candidate is not flagged', () => {
    const res = applyKnockouts(
      makeUser({ esgRequired: true }),
      makeCandidate({ esgRequired: false }),
    )
    expect(res.blocked).toBe(true)
    expect(res.reason).toBe('esg_required')
  })

  it('passes when both sides have esg_required true', () => {
    const res = applyKnockouts(
      makeUser({ esgRequired: true }),
      makeCandidate({ esgRequired: true }),
    )
    expect(res.blocked).toBe(false)
  })

  it('does not block on esg when viewer is indifferent', () => {
    const res = applyKnockouts(
      makeUser({ esgRequired: false }),
      makeCandidate({ esgRequired: false }),
    )
    expect(res.blocked).toBe(false)
  })

  it('reports the first failing knockout (anti_sectors short-circuits before tier)', () => {
    const res = applyKnockouts(
      makeUser({
        antiSectors:        ['Defense'],
        minCounterpartyTier: 'sovereign',
      }),
      makeCandidate({ sectors: ['Defense'], membership: 'access' }),
    )
    expect(res.reason).toBe('anti_sectors')
  })
})

describe('computeMatchScore — pillar breakdown', () => {
  it('exposes per-pillar scores on the result', () => {
    const score = computeMatchScore(makeUser(), makeCandidate())
    expect(score.pillars).toBeDefined()
    expect(score.pillars?.scope).toBe(100)
    expect(score.pillars?.capital).toBe(100)
  })

  it('scope pillar respects sub_sector overlap once either side declares it', () => {
    const score = computeMatchScore(
      makeUser({ subSectors: ['AI Infra'] }),
      makeCandidate({ subSectors: ['AI Infra'] }),
    )
    // Sub-sector now contributes — but the perfect-sector base means
    // total scope should still be at or above the no-sub-sector baseline.
    expect(score.pillars!.scope).toBeGreaterThanOrEqual(95)
  })

  it('a sub_sector mismatch lowers the scope score from baseline', () => {
    const baseline = computeMatchScore(makeUser(), makeCandidate()).pillars!.scope
    const withMismatch = computeMatchScore(
      makeUser({ subSectors: ['AI Infra'] }),
      makeCandidate({ subSectors: ['Real Estate'] }),
    ).pillars!.scope
    expect(withMismatch).toBeLessThan(baseline)
  })
})
