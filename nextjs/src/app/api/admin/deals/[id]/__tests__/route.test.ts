import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockIsUserAdmin     = vi.fn()
const mockQuery           = vi.fn()
const mockGetDeal         = vi.fn()
const mockUpdateDealStatus = vi.fn()

vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/db',    () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/deals', () => ({
  getDeal:           (...a: unknown[]) => mockGetDeal(...a),
  updateDealStatus:  (...a: unknown[]) => mockUpdateDealStatus(...a),
}))

import { PATCH, DELETE } from '../route'

const DEAL_ID = 'deal-1'

function buildReq(method: 'PATCH' | 'DELETE', body?: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) {
    headers['x-user-id']    = 'admin-1'
    headers['x-user-email'] = 'admin@x.com'
  }
  return new NextRequest(`http://localhost/api/admin/deals/${DEAL_ID}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const params = () => Promise.resolve({ id: DEAL_ID })

beforeEach(() => {
  mockIsUserAdmin.mockReset(); mockQuery.mockReset()
  mockGetDeal.mockReset();     mockUpdateDealStatus.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PATCH /api/admin/deals/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await PATCH(buildReq('PATCH', { status: 'closed' }), { params: params() })
    expect(res.status).toBe(403)
  })

  it('rejects an invalid status', async () => {
    const res = await PATCH(buildReq('PATCH', { status: 'haunted' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('rejects a non-JSON body', async () => {
    const res = await PATCH(buildReq('PATCH', 'not-an-object'), { params: params() })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the deal does not exist', async () => {
    mockGetDeal.mockResolvedValueOnce(null)
    const res = await PATCH(buildReq('PATCH', { status: 'closed' }), { params: params() })
    expect(res.status).toBe(404)
    expect(mockUpdateDealStatus).not.toHaveBeenCalled()
  })

  it('updates the status', async () => {
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID })
    mockUpdateDealStatus.mockResolvedValueOnce(undefined)

    const res = await PATCH(buildReq('PATCH', { status: 'filled' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockUpdateDealStatus).toHaveBeenCalledWith(DEAL_ID, 'filled')
  })
})

describe('DELETE /api/admin/deals/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await DELETE(buildReq('DELETE'), { params: params() })
    expect(res.status).toBe(403)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('deletes the deal row (cascades clean up invitations)', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await DELETE(buildReq('DELETE'), { params: params() })
    expect(res.status).toBe(200)
    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/DELETE FROM deals/)
    expect(args).toEqual([DEAL_ID])
  })
})
