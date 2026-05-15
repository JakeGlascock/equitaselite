import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

import { POST } from '../route'

const VALID_TOKEN = '12345678-1234-1234-1234-123456789abc'

beforeEach(() => {
  mockQuery.mockReset()
  mockQueryOne.mockReset()
})

function reqWithJsonBody(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function reqWithFormBody(body: string): NextRequest {
  return new NextRequest('http://localhost/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
}

function reqWithQuery(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/unsubscribe?t=${token}`, { method: 'POST' })
}

describe('POST /api/unsubscribe', () => {
  it('returns 400 when no token is supplied at all', async () => {
    const res = await POST(reqWithJsonBody({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid or missing token' })
  })

  it('returns 400 when the token is malformed (not a UUID)', async () => {
    const res = await POST(reqWithJsonBody({ token: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('accepts a token from the JSON body and disables notifications', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'user-1' })
    mockQuery.mockResolvedValueOnce([])
    const res = await POST(reqWithJsonBody({ token: VALID_TOKEN }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('UPDATE profiles')
    expect(sql).toContain('email_notifications_enabled = FALSE')
    expect(params).toEqual([VALID_TOKEN])
  })

  it('accepts a token from a form-encoded body (Gmail one-click)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'user-2' })
    mockQuery.mockResolvedValueOnce([])
    const res = await POST(reqWithFormBody(`token=${VALID_TOKEN}&List-Unsubscribe=One-Click`))
    expect(res.status).toBe(200)
  })

  it('prefers the query-string token over the body (Gmail puts it in the URL)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'user-3' })
    mockQuery.mockResolvedValueOnce([])
    const req = new NextRequest(`http://localhost/api/unsubscribe?t=${VALID_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `token=00000000-0000-0000-0000-000000000000`,
    })
    await POST(req)
    const [, params] = mockQueryOne.mock.calls[0]
    expect(params).toEqual([VALID_TOKEN])
  })

  it('returns 404 when the token is well-formed but does not match any profile', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await POST(reqWithJsonBody({ token: VALID_TOKEN }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Token not recognized' })
  })

  it('also clears match_digest_state so re-enabling does not trigger a deluge', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'user-4' })
    mockQuery.mockResolvedValueOnce([])
    await POST(reqWithJsonBody({ token: VALID_TOKEN }))
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('UPDATE match_digest_state')
    expect(params).toEqual(['user-4'])
  })

  it('tolerates the match_digest_state UPDATE failing (table may not exist pre-Phase-3)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'user-5' })
    mockQuery.mockRejectedValueOnce(new Error('relation "match_digest_state" does not exist'))
    const res = await POST(reqWithJsonBody({ token: VALID_TOKEN }))
    expect(res.status).toBe(200)
  })

  it('accepts a token via query string with no body', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'user-6' })
    mockQuery.mockResolvedValueOnce([])
    const res = await POST(reqWithQuery(VALID_TOKEN))
    expect(res.status).toBe(200)
  })

  it('returns 400 when JSON body parsing fails entirely', async () => {
    // Send invalid JSON via JSON content-type
    const req = new NextRequest('http://localhost/api/unsubscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
