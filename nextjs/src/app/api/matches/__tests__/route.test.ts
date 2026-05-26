import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()
const mockCompute  = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/scoring', () => ({
  computeMatchScore: (...a: unknown[]) => mockCompute(...a),
}))

import { GET } from '../route'

function req(opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'user-a'
  return new NextRequest('http://localhost/api/matches', { headers })
}

const buildProfile = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'me', full_name: 'Me', title: null, firm_name: 'My Firm', location: null,
  aum: null, role: 'angel' as const, sectors: ['SaaS'], stages: ['Seed'],
  geography: ['US'], check_size_min: 100, check_size_max: 1000,
  ...over,
})

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockCompute.mockReset()
})

describe('GET /api/matches', () => {
  it('requires authentication', async () => {
    const res = await GET(req({ userId: null }))
    expect(res.status).toBe(401)
  })

  it('returns 404 if the caller has no completed profile', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await GET(req())
    expect(res.status).toBe(404)
  })

  it('returns candidates of the opposite role, sorted by score descending', async () => {
    mockQueryOne.mockResolvedValueOnce(buildProfile({ role: 'angel' }))
    mockQuery.mockResolvedValueOnce([
      buildProfile({ id: 'fo-1', role: 'family_office' }),
      buildProfile({ id: 'fo-2', role: 'family_office' }),
    ])
    mockCompute
      .mockReturnValueOnce({ total: 60 })
      .mockReturnValueOnce({ total: 92 })

    const res = await GET(req())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.map((r: { id: string }) => r.id)).toEqual(['fo-2', 'fo-1'])
    expect(body[0].score.total).toBe(92)
    // The candidate query must filter to the opposite role + exclude self.
    const candidateSql = mockQuery.mock.calls[0][0]
    const candidateArgs = mockQuery.mock.calls[0][1]
    expect(candidateSql).toMatch(/role = \$1/)
    expect(candidateSql).toMatch(/id != \$2/)
    expect(candidateArgs[0]).toBe('family_office')
    expect(candidateArgs[1]).toBe('user-a')
  })

  it('flips role mapping when the caller is family_office', async () => {
    mockQueryOne.mockResolvedValueOnce(buildProfile({ role: 'family_office' }))
    mockQuery.mockResolvedValueOnce([])

    await GET(req())

    expect(mockQuery.mock.calls[0][1][0]).toBe('angel')
  })

  it('coerces stringy check_size_min/max from pg into numbers before scoring', async () => {
    mockQueryOne.mockResolvedValueOnce(
      buildProfile({ role: 'angel', check_size_min: '50' as unknown as number }),
    )
    mockQuery.mockResolvedValueOnce([
      buildProfile({ id: 'fo-1', role: 'family_office', check_size_min: '200' as unknown as number }),
    ])
    mockCompute.mockReturnValueOnce({ total: 80 })

    const res = await GET(req())
    const body = await res.json()
    expect(body[0].checkSizeMin).toBe(200)
    expect(typeof body[0].checkSizeMin).toBe('number')
  })
})
