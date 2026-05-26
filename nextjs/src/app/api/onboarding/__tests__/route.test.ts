import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockGetEffectiveUserId  = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...a: unknown[]) => mockGetEffectiveUserId(...a),
}))

import { POST } from '../route'

const USER  = 'user-a'
const EMAIL = 'a@x.com'

// Minimal valid payload — built from required-field set.
const valid = (over: Record<string, unknown> = {}) => ({
  email:    EMAIL,
  role:     'angel',
  full_name: 'Test User',
  firm_name: 'Test Firm',
  sectors:   ['SaaS'],
  stages:    ['Seed'],
  geography: ['US'],
  check_size_min: 100,
  check_size_max: 1000,
  risk_tolerance: 'Moderate',
  expected_return: '3x',
  timeline:        '5 yrs',
  ...over,
})

function postReq(
  body: unknown,
  opts: { userId?: string | null; email?: string | null } = {},
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id']    = opts.userId ?? USER
  if (opts.email  !== null) headers['x-user-email'] = opts.email  ?? EMAIL
  return new NextRequest('http://localhost/api/onboarding', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockGetEffectiveUserId.mockReset()
  mockGetEffectiveUserId.mockResolvedValue(USER)
})

describe('POST /api/onboarding — auth + payload validation', () => {
  it('requires authentication', async () => {
    const res = await POST(postReq(valid(), { userId: null }))
    expect(res.status).toBe(401)
  })

  it('rejects missing required fields', async () => {
    const res = await POST(postReq({ email: EMAIL }))
    expect(res.status).toBe(400)
  })

  it('rejects check_size_max < check_size_min', async () => {
    const res = await POST(postReq(valid({ check_size_min: 5000, check_size_max: 100 })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/check_size_max/)
  })

  it('requires at least one role (no flags + no role)', async () => {
    const res = await POST(postReq({
      ...valid({ role: undefined }),
    }))
    expect(res.status).toBe(400)
  })

  it('family_office signup requires aum + mandate_type + concentration', async () => {
    const res = await POST(postReq(valid({
      role: 'family_office', expected_return: undefined, timeline: undefined,
    })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/aum|mandate_type|concentration/i)
  })

  it('angel signup requires expected_return + timeline', async () => {
    const res = await POST(postReq(valid({ expected_return: undefined })))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/onboarding — email squat defense', () => {
  it('blocks submission when payload email != JWT email (and not impersonating)', async () => {
    const res = await POST(postReq(valid({ email: 'victim@x.com' })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/match your signed-in/i)
  })

  it('skips the email check when acting-as a different profile (admin test-fixture)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('demo-target')   // impersonating
    mockQueryOne.mockResolvedValueOnce({ id: 'demo-target' })

    const res = await POST(postReq(valid({ email: 'fixture@x.com' })))

    expect(res.status).toBe(201)
  })
})

describe('POST /api/onboarding — DB writes', () => {
  it('inserts the profile + per-role mandates (angel)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER, role: 'angel' })
    mockQuery.mockResolvedValue(undefined)

    const res = await POST(postReq(valid()))

    expect(res.status).toBe(201)
    // mandates insert should fire once for the single 'angel' role
    const mandateCalls = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INTO mandates'),
    )
    expect(mandateCalls).toHaveLength(1)
    expect(mandateCalls[0][1][1]).toBe('angel')
  })

  it('mirrors mandate row per active investor role flag', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER })
    mockQuery.mockResolvedValue(undefined)

    await POST(postReq(valid({
      role: undefined,
      is_angel: true, is_family_office: true, is_next_gen: true,
      aum: '$50M', mandate_type: 'Direct', concentration: 'Diversified',
    })))

    const mandateCalls = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INTO mandates'),
    )
    expect(mandateCalls).toHaveLength(3)
    const roles = mandateCalls.map(c => c[1][1])
    expect(roles).toEqual(['angel', 'family_office', 'next_gen'])
  })

  it('falls back to the pre-034/035 INSERT shape when role flag columns are missing', async () => {
    // Primary INSERT throws on `is_angel` missing; route should retry the legacy INSERT.
    mockQueryOne
      .mockRejectedValueOnce(new Error('column "is_angel" does not exist'))
      .mockResolvedValueOnce({ id: USER })
    mockQuery.mockResolvedValue(undefined)

    const res = await POST(postReq(valid()))

    expect(res.status).toBe(201)
    expect(mockQueryOne).toHaveBeenCalledTimes(2)
  })

  it('rethrows non-migration errors instead of falling back', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('connection refused'))
    await expect(POST(postReq(valid()))).rejects.toThrow('connection refused')
  })

  it('survives mandates table being absent (pre-034 env)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER })
    mockQuery.mockRejectedValueOnce(new Error('relation "mandates" does not exist'))

    const res = await POST(postReq(valid()))
    expect(res.status).toBe(201)
  })
})
