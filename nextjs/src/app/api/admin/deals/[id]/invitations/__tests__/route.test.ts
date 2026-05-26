import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockIsUserAdmin           = vi.fn()
const mockQuery                 = vi.fn()
const mockGetDeal               = vi.fn()
const mockInviteToDeal          = vi.fn()
const mockListInvitationsForDeal = vi.fn()
const mockEmailDealInvitation   = vi.fn()
const mockSendPushToUser        = vi.fn()

vi.mock('@/lib/admin', () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}))
vi.mock('@/lib/db', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
}))
vi.mock('@/lib/deals', () => ({
  getDeal:                 (...a: unknown[]) => mockGetDeal(...a),
  inviteToDeal:            (...a: unknown[]) => mockInviteToDeal(...a),
  listInvitationsForDeal:  (...a: unknown[]) => mockListInvitationsForDeal(...a),
}))
vi.mock('@/lib/email', () => ({
  emailDealInvitation: (...a: unknown[]) => mockEmailDealInvitation(...a),
}))
vi.mock('@/lib/push', () => ({
  sendPushToUser: (...a: unknown[]) => mockSendPushToUser(...a),
}))

import { POST, GET } from '../route'

const DEAL_ID = 'deal-1'
const ADMIN   = { id: 'admin-1', email: 'admin@example.com' }

function buildReq(method: 'GET' | 'POST', body?: unknown, opts: { admin?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.admin !== false) {
    headers['x-user-id']    = ADMIN.id
    headers['x-user-email'] = ADMIN.email
  }
  return new NextRequest(`http://localhost/api/admin/deals/${DEAL_ID}/invitations`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const params = () => Promise.resolve({ id: DEAL_ID })

// Pause for fire-and-forget side effects to flush. The route deliberately
// doesn't await emailDealInvitation/sendPushToUser, so we yield to the
// microtask queue before asserting.
const tick = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  mockIsUserAdmin.mockReset(); mockQuery.mockReset(); mockGetDeal.mockReset()
  mockInviteToDeal.mockReset(); mockListInvitationsForDeal.mockReset()
  mockEmailDealInvitation.mockReset(); mockSendPushToUser.mockReset()
  // Default to admin so positive-path tests don't need to spell it out.
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('GET /api/admin/deals/[id]/invitations', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await GET(buildReq('GET'), { params: params() })
    expect(res.status).toBe(403)
  })

  it('returns the invitation list for the deal', async () => {
    mockListInvitationsForDeal.mockResolvedValueOnce([{ id: 'inv-1', status: 'pending' }])
    const res = await GET(buildReq('GET'), { params: params() })
    expect(res.status).toBe(200)
    expect((await res.json()).invitations).toHaveLength(1)
  })

  it('falls back to an empty list when the lookup throws', async () => {
    mockListInvitationsForDeal.mockRejectedValueOnce(new Error('boom'))
    const res = await GET(buildReq('GET'), { params: params() })
    expect((await res.json()).invitations).toEqual([])
  })
})

describe('POST /api/admin/deals/[id]/invitations — security-shaped invariants', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await POST(buildReq('POST', { user_ids: ['u-1'] }), { params: params() })
    expect(res.status).toBe(403)
    expect(mockInviteToDeal).not.toHaveBeenCalled()
  })

  it('rejects an empty user_ids list', async () => {
    const res = await POST(buildReq('POST', { user_ids: [] }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed body', async () => {
    const res = await POST(buildReq('POST', { user_ids: 'not-an-array' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the deal does not exist', async () => {
    mockGetDeal.mockResolvedValueOnce(null)
    const res = await POST(buildReq('POST', { user_ids: ['u-1'] }), { params: params() })
    expect(res.status).toBe(404)
  })

  it('re-filters server-side to Sovereign-tier non-demo profiles', async () => {
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'X', description: 'd' })
    // Caller posted u-1 (Sovereign) + u-2 (Select; should be dropped).
    mockQuery.mockResolvedValueOnce([{ id: 'u-1' }])    // eligibility filter
    mockInviteToDeal.mockResolvedValueOnce([
      { id: 'inv-1', deal_id: DEAL_ID, user_id: 'u-1' },
    ])
    mockQuery.mockResolvedValue(undefined)              // notifications inserts

    const res = await POST(
      buildReq('POST', { user_ids: ['u-1', 'u-2'] }),
      { params: params() },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 1, skipped: 1 })
    // inviteToDeal received ONLY the sovereign-eligible ids.
    expect(mockInviteToDeal).toHaveBeenCalledWith(DEAL_ID, ['u-1'])
  })

  it('short-circuits when no posted ids pass the sovereign filter', async () => {
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'X', description: 'd' })
    mockQuery.mockResolvedValueOnce([])                 // eligibility filter empty

    const res = await POST(
      buildReq('POST', { user_ids: ['u-1', 'u-2'] }),
      { params: params() },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 0, skipped: 2 })
    expect(mockInviteToDeal).not.toHaveBeenCalled()
  })

  it('inserts a deal_invitation notification for every new invitee', async () => {
    mockGetDeal.mockResolvedValueOnce({
      id: DEAL_ID, title: 'AI Co Series B', description: 'thesis',
    })
    mockQuery.mockResolvedValueOnce([{ id: 'u-1' }, { id: 'u-2' }])
    mockInviteToDeal.mockResolvedValueOnce([
      { id: 'i-1', deal_id: DEAL_ID, user_id: 'u-1' },
      { id: 'i-2', deal_id: DEAL_ID, user_id: 'u-2' },
    ])
    mockQuery.mockResolvedValue(undefined)
    mockEmailDealInvitation.mockResolvedValue(undefined)
    mockSendPushToUser.mockResolvedValue(undefined)

    await POST(
      buildReq('POST', { user_ids: ['u-1', 'u-2'] }),
      { params: params() },
    )

    // 1 eligibility SELECT + 2 notification INSERTs = 3 query calls.
    const insertCalls = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes("'deal_invitation'"),
    )
    expect(insertCalls).toHaveLength(2)
  })

  it('treats email + push as fire-and-forget — failures do not surface', async () => {
    mockGetDeal.mockResolvedValueOnce({
      id: DEAL_ID, title: 'X', description: 'd',
    })
    mockQuery.mockResolvedValueOnce([{ id: 'u-1' }])
    mockInviteToDeal.mockResolvedValueOnce([
      { id: 'inv-1', deal_id: DEAL_ID, user_id: 'u-1' },
    ])
    mockQuery.mockResolvedValue(undefined)
    mockEmailDealInvitation.mockRejectedValueOnce(new Error('SES outage'))
    mockSendPushToUser.mockRejectedValueOnce(new Error('SNS outage'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildReq('POST', { user_ids: ['u-1'] }), { params: params() })

    expect(res.status).toBe(200)
    expect((await res.json()).created).toBe(1)
    // Yield once so the IIFE's awaits land before we tear down.
    await tick()
    errSpy.mockRestore()
  })
})
