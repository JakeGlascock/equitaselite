import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockQueryOne = vi.fn()
vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  query:    vi.fn(),
}))

import {
  TIER_LIMITS, DEFAULT_TIER,
  getLimits, priorityRank, isTier,
  getTier, getIntroCountLast30Days, checkIntroQuota,
} from '../membership'

beforeEach(() => mockQueryOne.mockReset())

describe('TIER_LIMITS', () => {
  it('blocks intros entirely on Access', () => {
    expect(TIER_LIMITS.access.introsPerMonth).toBe(0)
  })

  it('caps Access at 10 matches, Select+Sovereign unlimited', () => {
    expect(TIER_LIMITS.access.matchesPerMonth).toBe(10)
    expect(TIER_LIMITS.select.matchesPerMonth).toBeNull()
    expect(TIER_LIMITS.sovereign.matchesPerMonth).toBeNull()
  })

  it('orders priority rank Sovereign < Select < Access (lower = surfaces earlier)', () => {
    expect(TIER_LIMITS.sovereign.priorityRank).toBeLessThan(TIER_LIMITS.select.priorityRank)
    expect(TIER_LIMITS.select.priorityRank).toBeLessThan(TIER_LIMITS.access.priorityRank)
  })

  it('marks Sovereign as unlimited intros', () => {
    expect(TIER_LIMITS.sovereign.introsPerMonth).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('getLimits', () => {
  it('returns the limits for a given tier', () => {
    expect(getLimits('access')).toBe(TIER_LIMITS.access)
    expect(getLimits('sovereign')).toBe(TIER_LIMITS.sovereign)
  })
})

describe('priorityRank', () => {
  it('returns the tier rank for a known tier', () => {
    expect(priorityRank('sovereign')).toBe(0)
    expect(priorityRank('select')).toBe(1)
    expect(priorityRank('access')).toBe(2)
  })

  it('returns one-worse-than-default for null/undefined membership', () => {
    const worstKnown = TIER_LIMITS[DEFAULT_TIER].priorityRank
    expect(priorityRank(null)).toBeGreaterThan(worstKnown)
    expect(priorityRank(undefined)).toBeGreaterThan(worstKnown)
  })
})

describe('isTier', () => {
  it('accepts the three tier values', () => {
    expect(isTier('access')).toBe(true)
    expect(isTier('select')).toBe(true)
    expect(isTier('sovereign')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isTier('')).toBe(false)
    expect(isTier('platinum')).toBe(false)
    expect(isTier(null)).toBe(false)
    expect(isTier(undefined)).toBe(false)
    expect(isTier(42)).toBe(false)
  })
})

describe('getTier', () => {
  it('returns the user\'s membership when set', async () => {
    mockQueryOne.mockResolvedValue({ membership: 'sovereign' })
    expect(await getTier('user-1')).toBe('sovereign')
  })

  it('defaults to access when the row exists but membership is null', async () => {
    mockQueryOne.mockResolvedValue({ membership: null })
    expect(await getTier('user-1')).toBe(DEFAULT_TIER)
  })

  it('defaults to access when no row is found', async () => {
    mockQueryOne.mockResolvedValue(null)
    expect(await getTier('user-1')).toBe(DEFAULT_TIER)
  })

  it('defaults to access when the membership column does not exist yet', async () => {
    mockQueryOne.mockRejectedValue(new Error('column "membership" does not exist'))
    expect(await getTier('user-1')).toBe(DEFAULT_TIER)
  })

  it('defaults to access when the membership value is bogus', async () => {
    mockQueryOne.mockResolvedValue({ membership: 'platinum' })
    expect(await getTier('user-1')).toBe(DEFAULT_TIER)
  })
})

describe('getIntroCountLast30Days', () => {
  it('returns the count parsed from pg\'s text representation', async () => {
    mockQueryOne.mockResolvedValue({ count: '7' })
    expect(await getIntroCountLast30Days('user-1')).toBe(7)
  })

  it('returns 0 when there are no rows', async () => {
    mockQueryOne.mockResolvedValue(null)
    expect(await getIntroCountLast30Days('user-1')).toBe(0)
  })

  it('returns 0 when the table does not exist (pre-init)', async () => {
    mockQueryOne.mockRejectedValue(new Error('relation "introductions" does not exist'))
    expect(await getIntroCountLast30Days('user-1')).toBe(0)
  })
})

describe('checkIntroQuota', () => {
  function setup(tier: string | null, count: number) {
    mockQueryOne
      .mockResolvedValueOnce({ membership: tier })       // getTier
      .mockResolvedValueOnce({ count: String(count) })   // getIntroCountLast30Days
  }

  it('blocks Access users immediately (limit=0)', async () => {
    setup('access', 0)
    const q = await checkIntroQuota('user-1')
    expect(q).toMatchObject({ ok: false, tier: 'access', used: 0, limit: 0, remaining: 0 })
  })

  it('permits Select users under their 5/mo cap', async () => {
    setup('select', 3)
    const q = await checkIntroQuota('user-1')
    expect(q).toMatchObject({ ok: true, tier: 'select', used: 3, limit: 5, remaining: 2 })
  })

  it('blocks Select users at their 5/mo cap', async () => {
    setup('select', 5)
    const q = await checkIntroQuota('user-1')
    expect(q).toMatchObject({ ok: false, tier: 'select', used: 5, limit: 5, remaining: 0 })
  })

  it('always permits Sovereign users (infinite cap)', async () => {
    setup('sovereign', 999)
    const q = await checkIntroQuota('user-1')
    expect(q.ok).toBe(true)
    expect(q.tier).toBe('sovereign')
    expect(q.limit).toBe(Number.POSITIVE_INFINITY)
    expect(q.remaining).toBe(Infinity)
  })
})
