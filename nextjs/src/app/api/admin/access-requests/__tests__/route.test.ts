import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery       = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db',    () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { GET } from '../route'

function req(admin = true): NextRequest {
  const headers: Record<string, string> = {}
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/access-requests', { headers })
}

beforeEach(() => {
  mockQuery.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('GET /api/admin/access-requests', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await GET(req())).status).toBe(403)
  })

  it('orders new -> contacted -> invited -> other, newest first', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'r-1', status: 'new' }])
    await GET(req())
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/CASE status WHEN 'new'/)
    expect(sql).toMatch(/created_at DESC/)
  })

  it('returns [] on DB error (table not initialized)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "access_requests" does not exist'))
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
