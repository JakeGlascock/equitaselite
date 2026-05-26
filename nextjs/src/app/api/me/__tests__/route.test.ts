import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()
const mockGetTier  = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/membership', () => ({
  getTier: (...a: unknown[]) => mockGetTier(...a),
}))

import { GET, PATCH } from '../route'

const USER  = 'user-a'
const EMAIL = 'a@example.com'

function buildReq(
  method: 'GET' | 'PATCH',
  body?: unknown,
  opts: { userId?: string | null; email?: string | null; url?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id']    = opts.userId ?? USER
  if (opts.email  !== null) headers['x-user-email'] = opts.email  ?? EMAIL
  return new NextRequest(opts.url ?? 'http://localhost/api/me', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockGetTier.mockReset()
})

describe('GET /api/me', () => {
  it('requires authentication', async () => {
    const res = await GET(buildReq('GET', undefined, { userId: null }))
    expect(res.status).toBe(401)
  })

  it('returns the profile row', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER, full_name: 'A' })
    const res = await GET(buildReq('GET'))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(USER)
  })

  it('returns 404 when the row does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await GET(buildReq('GET'))).status).toBe(404)
  })
})

describe('PATCH /api/me — validation and security gates', () => {
  it('requires authentication', async () => {
    const res = await PATCH(buildReq('PATCH', { full_name: 'X' }, { userId: null }))
    expect(res.status).toBe(401)
  })

  it('rejects an invalid email format', async () => {
    const res = await PATCH(buildReq('PATCH', { email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('blocks changing email to anything other than the JWT email (squat defense)', async () => {
    const res = await PATCH(buildReq('PATCH', { email: 'someone-else@x.com' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Cognito/)
  })

  it('allows changing email when it matches the JWT email (case-insensitive)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER, email: EMAIL })
    const res = await PATCH(buildReq('PATCH', { email: EMAIL.toUpperCase(), full_name: 'X' }))
    expect(res.status).toBe(200)
  })

  it('blocks non-Sovereign from flipping is_off_market = true (tier gate)', async () => {
    mockGetTier.mockResolvedValueOnce('access')
    const res = await PATCH(buildReq('PATCH', { is_off_market: true }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/Sovereign/)
  })

  it('allows a Sovereign to flip is_off_market = true', async () => {
    mockGetTier.mockResolvedValueOnce('sovereign')
    mockQueryOne.mockResolvedValueOnce({ id: USER, is_off_market: true })
    const res = await PATCH(buildReq('PATCH', { is_off_market: true }))
    expect(res.status).toBe(200)
  })

  it('lets any user flip is_off_market = false without a tier check', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER, is_off_market: false })
    const res = await PATCH(buildReq('PATCH', { is_off_market: false }))
    expect(res.status).toBe(200)
    expect(mockGetTier).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/me — UPDATE behavior', () => {
  it('returns 404 if the profile row does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await PATCH(buildReq('PATCH', { full_name: 'X' }))).status).toBe(404)
  })

  it('updates basic profile fields and returns the row', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER, full_name: 'New Name' })
    const res = await PATCH(buildReq('PATCH', { full_name: 'New Name', firm_name: 'New Firm' }))
    expect(res.status).toBe(200)
    expect((await res.json()).full_name).toBe('New Name')
  })
})

describe('PATCH /api/me?role=... — per-role mandate upsert (Phase D2)', () => {
  it('upserts the mandates row when ?role=angel + mandate fields are present', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER })           // profile UPDATE
    mockQuery.mockResolvedValueOnce(undefined)                  // mandates UPSERT

    const res = await PATCH(buildReq('PATCH',
      { sectors: ['AI'], check_size_min: 100 },
      { url: 'http://localhost/api/me?role=angel' },
    ))

    expect(res.status).toBe(200)
    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO mandates/)
    expect(sql).toMatch(/ON CONFLICT \(profile_id, role\) DO UPDATE/)
    expect(args[1]).toBe('angel')
  })

  it('skips the mandates upsert when no mandate field is being changed', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER })
    await PATCH(buildReq('PATCH',
      { full_name: 'just-name' },
      { url: 'http://localhost/api/me?role=angel' },
    ))
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('ignores unknown role params', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER })
    await PATCH(buildReq('PATCH',
      { sectors: ['AI'] },
      { url: 'http://localhost/api/me?role=garbage' },
    ))
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('swallows mandate-table errors silently (pre-034 env)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: USER })
    mockQuery.mockRejectedValueOnce(new Error('mandates table missing'))

    const res = await PATCH(buildReq('PATCH',
      { sectors: ['AI'] },
      { url: 'http://localhost/api/me?role=angel' },
    ))

    expect(res.status).toBe(200)
  })
})
