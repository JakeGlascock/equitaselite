import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne    = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db',    () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { PATCH } from '../route'

const ID = 'req-1'

function patchReq(body: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest(`http://localhost/api/admin/access-requests/${ID}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  })
}
const params = () => Promise.resolve({ id: ID })

beforeEach(() => {
  mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PATCH /api/admin/access-requests/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await PATCH(patchReq({ status: 'invited' }), { params: params() })).status).toBe(403)
  })

  it('rejects an unknown status', async () => {
    expect((await PATCH(patchReq({ status: 'maybe' }), { params: params() })).status).toBe(400)
  })

  it('updates handled_at + handled_by on non-new statuses', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID, status: 'invited' })
    await PATCH(patchReq({ status: 'invited' }), { params: params() })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/handled_at = CASE WHEN \$2 = 'new'/)
  })

  it('returns 404 when the row does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await PATCH(patchReq({ status: 'invited' }), { params: params() })).status).toBe(404)
  })
})
