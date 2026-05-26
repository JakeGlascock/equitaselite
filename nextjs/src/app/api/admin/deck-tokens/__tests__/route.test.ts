import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockIsUserAdmin   = vi.fn()
const mockQuery         = vi.fn()
const mockQueryOne      = vi.fn()
const mockGenerateToken = vi.fn()

vi.mock('@/lib/admin',   () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/preview', () => ({ generateToken: (...a: unknown[]) => mockGenerateToken(...a) }))

import { GET, POST, PATCH } from '../route'

function buildReq(method: 'GET' | 'POST' | 'PATCH', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/deck-tokens', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'a-1', 'x-user-email': 'a@x.com',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockIsUserAdmin.mockReset(); mockQuery.mockReset(); mockQueryOne.mockReset()
  mockGenerateToken.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
  // Two distinct tokens — first call is the DECK token, second is the PREVIEW token.
  // (See route.ts: `const deckToken = generateToken(); const previewToken = generateToken();`)
  mockGenerateToken.mockReturnValueOnce('d'.repeat(64)).mockReturnValueOnce('p'.repeat(64))
})

describe('POST /api/admin/deck-tokens', () => {
  const valid = { label: 'Investor X', demo_profile_id: 'demo_sarah_chen' }

  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(buildReq('POST', valid))).status).toBe(403)
  })

  it('rejects non-demo_ profile id', async () => {
    expect((await POST(buildReq('POST', { ...valid, demo_profile_id: 'real-user' }))).status).toBe(400)
  })

  it('rejects when demo profile does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await POST(buildReq('POST', valid))).status).toBe(400)
  })

  it('mints paired preview + deck token, returns both tokens', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'demo_sarah_chen' })
    mockQuery
      .mockResolvedValueOnce(undefined)   // preview insert
      .mockResolvedValueOnce(undefined)   // deck insert

    const res = await POST(buildReq('POST', valid))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.token).toBe('d'.repeat(64))
    expect(body.paired_token).toBe('p'.repeat(64))
    expect(body.ttl_days).toBe(14)
  })

  it('returns 500 if preview insert fails (no deck row created)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'demo_sarah_chen' })
    mockQuery.mockRejectedValueOnce(new Error('preview insert'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(buildReq('POST', valid))).status).toBe(500)
    // Only one insert attempted
    expect(mockQuery).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('rolls back paired preview when deck insert fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'demo_sarah_chen' })
    mockQuery
      .mockResolvedValueOnce(undefined)                                // preview insert
      .mockRejectedValueOnce(new Error('deck insert FK violation'))    // deck insert
      .mockResolvedValueOnce(undefined)                                // rollback DELETE
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildReq('POST', valid))

    expect(res.status).toBe(500)
    // Third call is the rollback
    const rollback = mockQuery.mock.calls[2][0]
    expect(rollback).toMatch(/DELETE FROM preview_tokens/)
    errSpy.mockRestore()
  })
})

describe('GET /api/admin/deck-tokens', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('lists kind=deck rows', async () => {
    mockQuery.mockResolvedValueOnce([{ token: 'd'.repeat(64) }])
    await GET(buildReq('GET'))
    expect(mockQuery.mock.calls[0][0]).toMatch(/kind = 'deck'/)
  })

  it('returns [] on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('table'))
    expect((await (await GET(buildReq('GET'))).json()).tokens).toEqual([])
  })
})

describe('PATCH /api/admin/deck-tokens — revoke + cascade', () => {
  const token = 'a'.repeat(64)

  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await PATCH(buildReq('PATCH', { token }))).status).toBe(403)
  })

  it('rejects bad token format', async () => {
    expect((await PATCH(buildReq('PATCH', { token: 'not-hex' }))).status).toBe(400)
  })

  it('issues a single CTE statement that cascades the revoke to the paired preview', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await PATCH(buildReq('PATCH', { token }))
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/WITH revoked_deck AS/)
    expect(sql).toMatch(/SELECT paired_token FROM revoked_deck/)
  })
})
