import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery       = vi.fn()
const mockQueryOne    = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { DELETE } from '../route'

const ID = 'event-1'

function buildReq(admin = true): NextRequest {
  const headers: Record<string, string> = {}
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest(`http://localhost/api/admin/events/${ID}`, { method: 'DELETE', headers })
}
const params = () => Promise.resolve({ id: ID })

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('DELETE /api/admin/events/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await DELETE(buildReq(), { params: params() })).status).toBe(403)
  })

  it('returns 404 when the row does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await DELETE(buildReq(), { params: params() })).status).toBe(404)
  })

  it('deletes the event', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    const res = await DELETE(buildReq(), { params: params() })
    expect(res.status).toBe(200)
    expect(mockQueryOne.mock.calls[0][0]).toMatch(/DELETE FROM events/)
  })
})
