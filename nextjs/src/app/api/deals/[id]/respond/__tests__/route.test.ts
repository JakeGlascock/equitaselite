import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery                = vi.fn()
const mockQueryOne             = vi.fn()
const mockGetInvitation        = vi.fn()
const mockRespondToInvitation  = vi.fn()
const mockGetDeal              = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/deals', () => ({
  getInvitation:        (...a: unknown[]) => mockGetInvitation(...a),
  respondToInvitation:  (...a: unknown[]) => mockRespondToInvitation(...a),
  getDeal:              (...a: unknown[]) => mockGetDeal(...a),
}))

import { POST } from '../route'

const USER_ID  = 'user-abc'
const DEAL_ID  = 'deal-xyz'
const INV_ID   = 'inv-1'

function postReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? USER_ID
  return new NextRequest(`http://localhost/api/deals/${INV_ID}/respond`, {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}
const params = () => Promise.resolve({ id: INV_ID })

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
  mockGetInvitation.mockReset(); mockRespondToInvitation.mockReset(); mockGetDeal.mockReset()
})

describe('POST /api/deals/[id]/respond', () => {
  it('requires authentication', async () => {
    const res = await POST(postReq({ status: 'interested' }, { userId: null }), { params: params() })
    expect(res.status).toBe(401)
    expect(mockRespondToInvitation).not.toHaveBeenCalled()
  })

  it('rejects an invalid status enum', async () => {
    const res = await POST(postReq({ status: 'pending' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed JSON body', async () => {
    const res = await POST(postReq('nope'), { params: params() })
    expect(res.status).toBe(400)
  })

  it('records an interested response and notifies the deal creator', async () => {
    mockRespondToInvitation.mockResolvedValueOnce({
      id: INV_ID, deal_id: DEAL_ID, user_id: USER_ID, status: 'interested',
    })
    mockGetDeal.mockResolvedValueOnce({
      id: DEAL_ID, title: 'AI Underwriting Series B', created_by: 'admin-1',
    })
    mockQueryOne.mockResolvedValueOnce({ full_name: 'Test User', firm_name: 'Test Capital' })
    mockQuery.mockResolvedValueOnce(undefined)

    const res = await POST(postReq({ status: 'interested' }), { params: params() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'interested' })
    // user_id is bound in the WHERE clause — security-critical.
    expect(mockRespondToInvitation).toHaveBeenCalledWith(INV_ID, USER_ID, 'interested')
    // Notification was inserted with deal_interest type targeting the creator.
    const [sql, paramsArr] = mockQuery.mock.calls[0]
    expect(sql).toContain("'deal_interest'")
    expect(paramsArr[0]).toBe('admin-1')
    expect(paramsArr[1]).toContain('Test User')
  })

  it('falls back to a generic name when the responder has no profile', async () => {
    mockRespondToInvitation.mockResolvedValueOnce({
      id: INV_ID, deal_id: DEAL_ID, user_id: USER_ID, status: 'interested',
    })
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'X', created_by: 'admin-1' })
    mockQueryOne.mockResolvedValueOnce(null)
    mockQuery.mockResolvedValueOnce(undefined)

    const res = await POST(postReq({ status: 'interested' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockQuery.mock.calls[0][1][1]).toContain('Sovereign member')
  })

  it('records a declined response WITHOUT notifying the creator', async () => {
    mockRespondToInvitation.mockResolvedValueOnce({
      id: INV_ID, deal_id: DEAL_ID, user_id: USER_ID, status: 'declined',
    })

    const res = await POST(postReq({ status: 'declined' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockGetDeal).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 404 when the invitation belongs to a different user (stolen-session defense)', async () => {
    mockRespondToInvitation.mockResolvedValueOnce(null)
    mockGetInvitation.mockResolvedValueOnce({
      id: INV_ID, deal_id: DEAL_ID, user_id: 'someone-else', status: 'pending',
    })

    const res = await POST(postReq({ status: 'interested' }), { params: params() })

    expect(res.status).toBe(404)
  })

  it('returns 404 when the invitation does not exist', async () => {
    mockRespondToInvitation.mockResolvedValueOnce(null)
    mockGetInvitation.mockResolvedValueOnce(null)

    const res = await POST(postReq({ status: 'interested' }), { params: params() })

    expect(res.status).toBe(404)
  })

  it('returns 409 when the user has already responded (idempotency)', async () => {
    mockRespondToInvitation.mockResolvedValueOnce(null)
    mockGetInvitation.mockResolvedValueOnce({
      id: INV_ID, deal_id: DEAL_ID, user_id: USER_ID, status: 'interested',
    })

    const res = await POST(postReq({ status: 'interested' }), { params: params() })

    expect(res.status).toBe(409)
  })

  it('skips the creator notification if the deal has no created_by', async () => {
    mockRespondToInvitation.mockResolvedValueOnce({
      id: INV_ID, deal_id: DEAL_ID, user_id: USER_ID, status: 'interested',
    })
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'Orphan', created_by: null })

    const res = await POST(postReq({ status: 'interested' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
