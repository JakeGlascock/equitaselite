import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne     = vi.fn()
const mockIsUserAdmin  = vi.fn()

vi.mock('@/lib/db',    () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { POST, DELETE } from '../route'

const TARGET = 'target-1'

function buildReq(method: 'POST' | 'DELETE', opts: { userId?: string | null; email?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'caller-1'
  if (opts.email  !== null) headers['x-user-email'] = opts.email ?? 'c@x.com'
  return new NextRequest(`http://localhost/api/concierge/welcome/${TARGET}`, { method, headers })
}
const params = () => Promise.resolve({ id: TARGET })

beforeEach(() => {
  mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(false)
})

describe('POST /api/concierge/welcome/[id]', () => {
  it('requires authentication', async () => {
    expect((await POST(buildReq('POST', { userId: null }), { params: params() })).status).toBe(401)
  })

  it('forbids non-admin, non-concierge callers', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await POST(buildReq('POST'), { params: params() })).status).toBe(403)
  })

  it('admins are always allowed', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(true)
    mockQueryOne.mockResolvedValueOnce({ id: TARGET, welcomed_at: new Date() })
    expect((await POST(buildReq('POST'), { params: params() })).status).toBe(200)
  })

  it('concierges are allowed', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ is_concierge: true })
      .mockResolvedValueOnce({ id: TARGET, welcomed_at: new Date() })
    expect((await POST(buildReq('POST'), { params: params() })).status).toBe(200)
  })

  it('returns 404 if target row does not exist', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(true)
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await POST(buildReq('POST'), { params: params() })).status).toBe(404)
  })

  it('returns a friendly 400 if welcomed_at column is missing (pre-013 env)', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(true)
    mockQueryOne.mockRejectedValueOnce(new Error('column "welcomed_at" does not exist'))
    const res = await POST(buildReq('POST'), { params: params() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/welcomed_at column/)
  })
})

describe('DELETE /api/concierge/welcome/[id]', () => {
  it('requires authentication', async () => {
    expect((await DELETE(buildReq('DELETE', { userId: null }), { params: params() })).status).toBe(401)
  })

  it('admins or concierges can undo', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(true)
    mockQueryOne.mockResolvedValueOnce({ id: TARGET })
    expect((await DELETE(buildReq('DELETE'), { params: params() })).status).toBe(200)
  })

  it('returns 404 if target row does not exist', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(true)
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await DELETE(buildReq('DELETE'), { params: params() })).status).toBe(404)
  })

  it('forbids non-admin non-concierge callers', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await DELETE(buildReq('DELETE'), { params: params() })).status).toBe(403)
  })
})
