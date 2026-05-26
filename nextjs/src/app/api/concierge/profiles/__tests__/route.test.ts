import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))

import { GET, POST } from '../route'

const CONCIERGE = 'concierge-1'

function buildReq(method: 'GET' | 'POST', body?: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? CONCIERGE
  return new NextRequest('http://localhost/api/concierge/profiles', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const validCreate = (over: Record<string, unknown> = {}) => ({
  email: 't@x.com', full_name: 'T', firm_name: 'F', role: 'angel',
  sectors: ['SaaS'], stages: ['Seed'], geography: ['US'],
  check_size_min: 100, check_size_max: 1000,
  ...over,
})

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
})

describe('GET /api/concierge/profiles', () => {
  it('forbids non-concierges', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('forbids unauthenticated callers', async () => {
    expect((await GET(buildReq('GET', undefined, { userId: null }))).status).toBe(403)
  })

  it('returns rows where managed_by = caller', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockQuery.mockResolvedValueOnce([{ id: 'managed_1' }])

    await GET(buildReq('GET'))

    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/managed_by = \$1/)
    expect(args).toEqual([CONCIERGE])
  })
})

describe('POST /api/concierge/profiles', () => {
  it('forbids non-concierges', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await POST(buildReq('POST', validCreate()))).status).toBe(403)
  })

  it('rejects invalid payload', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    expect((await POST(buildReq('POST', { full_name: 'X' }))).status).toBe(400)
  })

  it('inserts with managed_by = caller and a managed_<uuid> id', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ is_concierge: true })
      .mockResolvedValueOnce({ id: 'managed_xxx' })

    const res = await POST(buildReq('POST', validCreate()))

    expect(res.status).toBe(201)
    const [, args] = mockQueryOne.mock.calls[1]   // second call is the INSERT
    expect(args[0]).toMatch(/^managed_[0-9a-f-]{36}$/)   // managed_<uuid v4>
    expect(args[args.length - 1]).toBe(CONCIERGE)        // last param is managed_by
  })

  it('maps duplicate-email DB error to 409', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ is_concierge: true })
      .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "profiles_email_key"'))

    const res = await POST(buildReq('POST', validCreate()))
    expect(res.status).toBe(409)
  })

  it('falls back to 500 on other DB errors', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ is_concierge: true })
      .mockRejectedValueOnce(new Error('connection refused'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildReq('POST', validCreate()))
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})
