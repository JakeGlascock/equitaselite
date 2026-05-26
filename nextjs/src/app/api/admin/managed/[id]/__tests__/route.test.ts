import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne    = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db',    () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { PATCH } from '../route'

const ID = 'profile-1'

function patchReq(body: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest(`http://localhost/api/admin/managed/${ID}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  })
}
const params = () => Promise.resolve({ id: ID })

beforeEach(() => {
  mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PATCH /api/admin/managed/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await PATCH(patchReq({ managed_by: 'c-1' }), { params: params() })).status).toBe(403)
  })

  it('rejects payloads missing managed_by', async () => {
    expect((await PATCH(patchReq({}), { params: params() })).status).toBe(400)
  })

  it('blocks self-assignment (cycle defense)', async () => {
    const res = await PATCH(patchReq({ managed_by: ID }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('rejects assigning a non-concierge as manager', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ managed_by: 'rm-1' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('allows unassign with explicit null (no concierge lookup)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID, managed_by: null })
    const res = await PATCH(patchReq({ managed_by: null }), { params: params() })
    expect(res.status).toBe(200)
    // Only the UPDATE call should fire (no concierge-existence check)
    expect(mockQueryOne).toHaveBeenCalledTimes(1)
  })

  it('updates managed_by on a verified concierge', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'rm-1' })             // concierge exists
      .mockResolvedValueOnce({ id: ID, managed_by: 'rm-1' })
    const res = await PATCH(patchReq({ managed_by: 'rm-1' }), { params: params() })
    expect(res.status).toBe(200)
  })

  it('returns 404 if the profile does not exist', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'rm-1' })
      .mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ managed_by: 'rm-1' }), { params: params() })
    expect(res.status).toBe(404)
  })
})
