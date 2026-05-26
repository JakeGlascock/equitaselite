import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockIsUserAdmin     = vi.fn()
const mockListCognitoUsers = vi.fn()
const mockQuery           = vi.fn()
const mockQueryOne        = vi.fn()

vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/auth',  () => ({ listCognitoUsers: (...a: unknown[]) => mockListCognitoUsers(...a) }))
vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))

import { POST } from '../route'

function postReq(admin = true): NextRequest {
  const headers: Record<string, string> = {}
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/backfill-placeholders', { method: 'POST', headers })
}

beforeEach(() => {
  mockIsUserAdmin.mockReset(); mockListCognitoUsers.mockReset()
  mockQuery.mockReset();      mockQueryOne.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/backfill-placeholders', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(postReq())).status).toBe(403)
  })

  it('returns counts of {scanned, created, skipped}', async () => {
    mockListCognitoUsers.mockResolvedValueOnce([
      { sub: 'sub-1', email: 'a@x.com' },     // new — created
      { sub: 'sub-2', email: 'b@x.com' },     // exists — skipped
      { sub: null,    email: 'c@x.com' },     // no sub — skipped
    ])
    mockQueryOne
      .mockResolvedValueOnce(null)                    // sub-1 doesn't exist
      .mockResolvedValueOnce({ id: 'sub-2' })         // sub-2 exists
    mockQuery.mockResolvedValueOnce(undefined)        // insert sub-1

    const res = await POST(postReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, scanned: 3, created: 1, skipped: 2 })
  })

  it('returns ok with 0 counts when listCognitoUsers fails', async () => {
    mockListCognitoUsers.mockRejectedValueOnce(new Error('throttled'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, scanned: 0, created: 0, skipped: 0 })
    errSpy.mockRestore()
  })

  it('counts INSERT failure as skipped (idempotent)', async () => {
    mockListCognitoUsers.mockResolvedValueOnce([{ sub: 'sub-1', email: 'a@x.com' }])
    mockQueryOne.mockResolvedValueOnce(null)        // does not exist
    mockQuery.mockRejectedValueOnce(new Error('UNIQUE'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq())

    const body = await res.json()
    expect(body.scanned).toBe(1); expect(body.created).toBe(0); expect(body.skipped).toBe(1)
    errSpy.mockRestore()
  })
})
