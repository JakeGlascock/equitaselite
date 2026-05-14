import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

import {
  buildIntroMap,
  toMatchView,
  getMe,
  getCandidates,
  getIntroductions,
  type DbProfile,
} from '../matches'

function makeProfile(overrides: Partial<DbProfile> = {}): DbProfile {
  return {
    id:                    'me-1',
    email:                 'me@example.com',
    full_name:             'Test User',
    title:                 'Partner',
    firm_name:             'Test Capital',
    location:              'NYC',
    aum:                   '$50M–$250M',
    role:                  'family_office',
    sectors:               ['SaaS', 'FinTech'],
    stages:                ['Seed', 'Series A'],
    geography:             ['North America'],
    check_size_min:        1,
    check_size_max:        5,
    onboarding_completed:  true,
    ...overrides,
  }
}

beforeEach(() => {
  mockQuery.mockReset()
  mockQueryOne.mockReset()
})

describe('buildIntroMap', () => {
  it('returns an empty map when there are no introductions', () => {
    const map = buildIntroMap([], 'user-1')
    expect(map.size).toBe(0)
  })

  it('marks outgoing intros and uses the recipient email when accepted', () => {
    const map = buildIntroMap([
      {
        id: 'i1', requester_id: 'user-1', recipient_id: 'user-2',
        status: 'accepted',
        requester_email: 'me@x.com', recipient_email: 'them@y.com',
        created_at: '2026-05-01',
      },
    ], 'user-1')

    expect(map.get('user-2')).toEqual({
      status: 'accepted', direction: 'outgoing', contactEmail: 'them@y.com',
    })
  })

  it('marks incoming intros and uses the requester email when accepted', () => {
    const map = buildIntroMap([
      {
        id: 'i1', requester_id: 'user-2', recipient_id: 'user-1',
        status: 'accepted',
        requester_email: 'them@x.com', recipient_email: 'me@y.com',
        created_at: '2026-05-01',
      },
    ], 'user-1')

    expect(map.get('user-2')).toEqual({
      status: 'accepted', direction: 'incoming', contactEmail: 'them@x.com',
    })
  })

  it('does not expose a contact email for pending or declined intros', () => {
    const map = buildIntroMap([
      {
        id: 'i1', requester_id: 'user-1', recipient_id: 'user-2',
        status: 'pending',
        requester_email: 'me@x.com', recipient_email: 'them@y.com',
        created_at: '2026-05-01',
      },
      {
        id: 'i2', requester_id: 'user-3', recipient_id: 'user-1',
        status: 'declined',
        requester_email: 'three@x.com', recipient_email: 'me@y.com',
        created_at: '2026-05-01',
      },
    ], 'user-1')

    expect(map.get('user-2')?.contactEmail).toBeNull()
    expect(map.get('user-3')?.contactEmail).toBeNull()
    expect(map.get('user-2')?.direction).toBe('outgoing')
    expect(map.get('user-3')?.direction).toBe('incoming')
  })
})

describe('toMatchView', () => {
  const me = makeProfile()
  const them = makeProfile({
    id: 'them-1', email: 'them@example.com', full_name: 'Counter Party',
    role: 'angel', firm_name: 'Counter Capital',
  })

  it('maps DB profile fields onto the camelCase view shape', () => {
    const view = toMatchView(them, me)
    expect(view.id).toBe('them-1')
    expect(view.fullName).toBe('Counter Party')
    expect(view.firmName).toBe('Counter Capital')
    expect(view.checkSizeMin).toBe(1)
    expect(view.checkSizeMax).toBe(5)
    expect(view.role).toBe('angel')
  })

  it('attaches a computed score', () => {
    const view = toMatchView(them, me)
    expect(view.score).toBeDefined()
    expect(typeof view.score.total).toBe('number')
    expect(['Strong Fit', 'Good Fit', 'Possible Fit', 'Low Fit']).toContain(view.score.label)
  })

  it('defaults intro state to all-null when no intro is supplied', () => {
    const view = toMatchView(them, me)
    expect(view.intro).toEqual({ status: null, direction: null, contactEmail: null })
  })

  it('passes through the supplied intro state', () => {
    const view = toMatchView(them, me, {
      status: 'pending', direction: 'outgoing', contactEmail: null,
    })
    expect(view.intro.status).toBe('pending')
    expect(view.intro.direction).toBe('outgoing')
  })

  it('coerces stringified numerics from pg back into numbers', () => {
    const themString = makeProfile({
      id: 'them-2', role: 'angel',
      // pg can return NUMERIC as string — exercise the Number() coercion
      check_size_min: '0.25' as unknown as number,
      check_size_max: '10'   as unknown as number,
    })
    const view = toMatchView(themString, me)
    expect(view.checkSizeMin).toBe(0.25)
    expect(view.checkSizeMax).toBe(10)
  })
})

describe('getMe', () => {
  it('selects the calling profile by id', async () => {
    const me = makeProfile()
    mockQueryOne.mockResolvedValue(me)
    const result = await getMe('me-1')
    expect(result).toBe(me)
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining('FROM profiles WHERE id = $1'), ['me-1'])
  })
})

describe('getCandidates', () => {
  it('queries the opposite role with the is_concierge filter when the column exists', async () => {
    mockQuery.mockResolvedValueOnce([makeProfile({ id: 'c1', role: 'angel' })])
    const me = makeProfile({ id: 'me-1', role: 'family_office' })

    const out = await getCandidates(me)
    expect(out).toHaveLength(1)
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('is_concierge')
    expect(params).toEqual(['angel', 'me-1'])
  })

  it('flips the role correctly for angel callers', async () => {
    mockQuery.mockResolvedValueOnce([])
    const me = makeProfile({ id: 'me-1', role: 'angel' })

    await getCandidates(me)
    const [, params] = mockQuery.mock.calls[0]
    expect(params).toEqual(['family_office', 'me-1'])
  })

  it('falls back to the unfiltered query when the is_concierge column is missing', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('column "is_concierge" does not exist'))
      .mockResolvedValueOnce([makeProfile({ id: 'c1', role: 'angel' })])
    const me = makeProfile({ id: 'me-1', role: 'family_office' })

    const out = await getCandidates(me)
    expect(out).toHaveLength(1)
    expect(mockQuery).toHaveBeenCalledTimes(2)
    const [fallbackSql] = mockQuery.mock.calls[1]
    expect(fallbackSql).not.toContain('is_concierge')
  })
})

describe('getIntroductions', () => {
  it('selects introductions for the given user (as requester or recipient)', async () => {
    mockQuery.mockResolvedValue([])
    await getIntroductions('user-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('requester_id = $1 OR i.recipient_id = $1')
    expect(params).toEqual(['user-1'])
  })
})
