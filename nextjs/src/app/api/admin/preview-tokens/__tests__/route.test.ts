import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery        = vi.fn()
const mockQueryOne     = vi.fn()
const mockIsUserAdmin  = vi.fn()
const mockGenerateToken = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/admin',   () => ({ isUserAdmin:   (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/preview', () => ({ generateToken: (...a: unknown[]) => mockGenerateToken(...a) }))

import { GET, POST, PATCH } from '../route'

function buildReq(method: 'GET' | 'POST' | 'PATCH', body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': 'a-1', 'x-user-email': 'a@x.com',
  }
  return new NextRequest('http://localhost/api/admin/preview-tokens', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
  mockIsUserAdmin.mockReset(); mockGenerateToken.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
  mockGenerateToken.mockReturnValue('0'.repeat(64))
})

describe('POST /api/admin/preview-tokens', () => {
  const valid = { label: 'Test', demo_profile_id: 'demo_sarah_chen' }

  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(buildReq('POST', valid))).status).toBe(403)
  })

  it('rejects non-demo_ profile id (anti-leak)', async () => {
    expect((await POST(buildReq('POST', { ...valid, demo_profile_id: 'real-user' }))).status).toBe(400)
  })

  it('rejects when demo profile does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await POST(buildReq('POST', valid))).status).toBe(400)
  })

  it('mints a token with default TTL+max_views', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'demo_sarah_chen' })
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await POST(buildReq('POST', valid))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.token).toBe('0'.repeat(64))
    expect(body.ttl_days).toBe(14)
    expect(body.max_views).toBe(25)
  })

  it('honors caller-provided ttl_days + max_views', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'demo_sarah_chen' })
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await POST(buildReq('POST', { ...valid, ttl_days: 7, max_views: 100 }))
    expect((await res.json()).ttl_days).toBe(7)
  })

  it('returns 500 on DB insert failure', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'demo_sarah_chen' })
    mockQuery.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(buildReq('POST', valid))).status).toBe(500)
    errSpy.mockRestore()
  })
})

describe('GET /api/admin/preview-tokens', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('returns preview-kind tokens', async () => {
    mockQuery.mockResolvedValueOnce([{ token: 't-1' }])
    const res = await GET(buildReq('GET'))
    expect((await res.json()).tokens).toHaveLength(1)
    expect(mockQuery.mock.calls[0][0]).toMatch(/kind = 'preview'/)
  })

  it('returns [] on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('table'))
    expect((await (await GET(buildReq('GET'))).json()).tokens).toEqual([])
  })
})

describe('PATCH /api/admin/preview-tokens — revoke', () => {
  const token = 'f'.repeat(64)

  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await PATCH(buildReq('PATCH', { token }))).status).toBe(403)
  })

  it('rejects malformed token', async () => {
    expect((await PATCH(buildReq('PATCH', { token: 'not-64-hex' }))).status).toBe(400)
  })

  it('stamps revoked_at scoped to kind=preview', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await PATCH(buildReq('PATCH', { token }))
    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/revoked_at = NOW\(\)/)
    expect(sql).toMatch(/kind = 'preview'/)
  })
})
