import { describe, it, expect } from 'vitest'
import { computeMatchScore } from '../scoring'
import type { UserProfile, Candidate } from '@/types'

// Minimal factory helpers so tests stay readable
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

describe('computeMatchScore', () => {
  describe('perfect match', () => {
    it('caps total at 99 even when all dimensions are 100%', () => {
      const score = computeMatchScore(makeUser(), makeCandidate())
      expect(score.total).toBe(99)
    })

    it('returns Strong Fit label', () => {
      expect(computeMatchScore(makeUser(), makeCandidate()).label).toBe('Strong Fit')
    })

    it('returns 100 on all dimension subscores', () => {
      const score = computeMatchScore(makeUser(), makeCandidate())
      expect(score.sector).toBe(100)
      expect(score.stage).toBe(100)
      expect(score.checkSize).toBe(100)
      expect(score.geography).toBe(100)
    })
  })

  describe('zero overlap', () => {
    it('returns 0 when nothing overlaps', () => {
      const score = computeMatchScore(
        makeUser({ sectors: ['Technology'], stages: ['Seed'], geography: ['Europe'], checkSizeMin: 10_000, checkSizeMax: 100_000 }),
        makeCandidate({ sectors: ['Real Estate'], stages: ['Series C'], geography: ['Asia'], checkSizeMin: 10_000_000, checkSizeMax: 50_000_000 }),
      )
      expect(score.total).toBe(0)
      expect(score.label).toBe('Low Fit')
    })
  })

  describe('sector overlap (40% weight)', () => {
    it('scores 0 when sectors share nothing', () => {
      const score = computeMatchScore(
        makeUser({ sectors: ['Technology'] }),
        makeCandidate({ sectors: ['Real Estate'] }),
      )
      expect(score.sector).toBe(0)
    })

    it('scores partial overlap by max-set fraction', () => {
      // user has 2 sectors, candidate has 2, 1 matches → overlap = 1/2 = 50
      const score = computeMatchScore(
        makeUser({ sectors: ['Technology', 'Healthcare'] }),
        makeCandidate({ sectors: ['Technology', 'Real Estate'] }),
      )
      expect(score.sector).toBe(50)
    })

    it('handles empty user sector array gracefully (returns 0)', () => {
      const score = computeMatchScore(
        makeUser({ sectors: [] }),
        makeCandidate({ sectors: ['Technology'] }),
      )
      expect(score.sector).toBe(0)
    })

    it('handles empty candidate sector array gracefully (returns 0)', () => {
      const score = computeMatchScore(
        makeUser({ sectors: ['Technology'] }),
        makeCandidate({ sectors: [] }),
      )
      expect(score.sector).toBe(0)
    })
  })

  describe('stage overlap (30% weight)', () => {
    it('scores 0 on no stage match', () => {
      const score = computeMatchScore(
        makeUser({ stages: ['Seed'] }),
        makeCandidate({ stages: ['Series C'] }),
      )
      expect(score.stage).toBe(0)
    })

    it('scores 100 on identical single stage', () => {
      const score = computeMatchScore(
        makeUser({ stages: ['Series A'] }),
        makeCandidate({ stages: ['Series A'] }),
      )
      expect(score.stage).toBe(100)
    })
  })

  describe('check size overlap (20% weight)', () => {
    it('scores 0 when ranges do not overlap', () => {
      const score = computeMatchScore(
        makeUser({ checkSizeMin: 100_000, checkSizeMax: 500_000 }),
        makeCandidate({ checkSizeMin: 1_000_000, checkSizeMax: 5_000_000 }),
      )
      expect(score.checkSize).toBe(0)
    })

    it('scores 100 for identical ranges', () => {
      const score = computeMatchScore(
        makeUser({ checkSizeMin: 1_000_000, checkSizeMax: 5_000_000 }),
        makeCandidate({ checkSizeMin: 1_000_000, checkSizeMax: 5_000_000 }),
      )
      expect(score.checkSize).toBe(100)
    })

    it('scores partial overlap proportionally', () => {
      // user: 0–4, candidate: 2–6 → overlap 2, span 6 → 2/6 ≈ 33
      const score = computeMatchScore(
        makeUser({ checkSizeMin: 0, checkSizeMax: 4_000_000 }),
        makeCandidate({ checkSizeMin: 2_000_000, checkSizeMax: 6_000_000 }),
      )
      expect(score.checkSize).toBe(33)
    })

    it('handles touching boundaries (lo === hi) as 0 overlap', () => {
      const score = computeMatchScore(
        makeUser({ checkSizeMin: 1_000_000, checkSizeMax: 2_000_000 }),
        makeCandidate({ checkSizeMin: 2_000_000, checkSizeMax: 4_000_000 }),
      )
      // overlap = hi - lo = 2M - 2M = 0 → score 0
      expect(score.checkSize).toBe(0)
    })

    it('scores 100 when both ranges collapse to the same single point (span === 0)', () => {
      // min === max on both sides — span is zero, branch returns 1.
      const score = computeMatchScore(
        makeUser({ checkSizeMin: 1_000_000, checkSizeMax: 1_000_000 }),
        makeCandidate({ checkSizeMin: 1_000_000, checkSizeMax: 1_000_000 }),
      )
      expect(score.checkSize).toBe(100)
    })
  })

  describe('geography overlap (10% weight)', () => {
    it('scores 0 on different regions', () => {
      const score = computeMatchScore(
        makeUser({ geography: ['Europe'] }),
        makeCandidate({ geography: ['Asia'] }),
      )
      expect(score.geography).toBe(0)
    })

    it('scores 100 on identical single region', () => {
      const score = computeMatchScore(
        makeUser({ geography: ['North America'] }),
        makeCandidate({ geography: ['North America'] }),
      )
      expect(score.geography).toBe(100)
    })
  })

  describe('label thresholds', () => {
    it('returns Strong Fit at exactly 80', () => {
      // sector=100 (40) + stage=100 (30) + checkSize=0 (0) + geography=100 (10) = 80
      const score = computeMatchScore(
        makeUser({ checkSizeMin: 1, checkSizeMax: 2 }),
        makeCandidate({ checkSizeMin: 100, checkSizeMax: 200 }),
      )
      expect(score.total).toBe(80)
      expect(score.label).toBe('Strong Fit')
    })

    it('returns Good Fit between 65 and 79', () => {
      // sector only (40) + geography only (10) = 50, add stage partial to get ~65-79
      // sector=100 (40) + stage=50 (15) + geo=100 (10) + check=0 = 65
      const score = computeMatchScore(
        makeUser({ stages: ['Series A', 'Series B'], checkSizeMin: 1, checkSizeMax: 2 }),
        makeCandidate({ stages: ['Series A', 'Series C'], checkSizeMin: 100, checkSizeMax: 200 }),
      )
      expect(score.total).toBeGreaterThanOrEqual(65)
      expect(score.total).toBeLessThan(80)
      expect(score.label).toBe('Good Fit')
    })

    it('returns Possible Fit between 50 and 64', () => {
      // sector=100 (40) + stage=0 (0) + checkSize=0 (0) + geography=100 (10) = 50
      const score = computeMatchScore(
        makeUser({ stages: ['Seed'], checkSizeMin: 1, checkSizeMax: 2 }),
        makeCandidate({ stages: ['Series C'], checkSizeMin: 100, checkSizeMax: 200 }),
      )
      expect(score.total).toBe(50)
      expect(score.label).toBe('Possible Fit')
    })

    it('returns Low Fit below 50', () => {
      // sector=0 + stage=0 + checkSize=0 + geography=0 = 0
      const score = computeMatchScore(
        makeUser({ sectors: ['X'], stages: ['Seed'], geography: ['Europe'], checkSizeMin: 1, checkSizeMax: 2 }),
        makeCandidate({ sectors: ['Y'], stages: ['Series C'], geography: ['Asia'], checkSizeMin: 100, checkSizeMax: 200 }),
      )
      expect(score.total).toBeLessThan(50)
      expect(score.label).toBe('Low Fit')
    })
  })

  describe('total never exceeds 99', () => {
    it('caps at 99 for a perfect match (not 100)', () => {
      const score = computeMatchScore(makeUser(), makeCandidate())
      expect(score.total).toBeLessThanOrEqual(99)
    })
  })
})
