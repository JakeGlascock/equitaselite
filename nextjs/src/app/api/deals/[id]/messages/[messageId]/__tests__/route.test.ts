import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetDeal             = vi.fn()
const mockGetDealMessage      = vi.fn()
const mockSetDealMessagePinned = vi.fn()
const mockRemoveDealMessage   = vi.fn()
const mockIsUserAdmin         = vi.fn()

vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/deals', () => ({
  getDeal:                (...a: unknown[]) => mockGetDeal(...a),
  getDealMessage:         (...a: unknown[]) => mockGetDealMessage(...a),
  setDealMessagePinned:   (...a: unknown[]) => mockSetDealMessagePinned(...a),
  removeDealMessage:      (...a: unknown[]) => mockRemoveDealMessage(...a),
}))

import { PATCH } from '../route'

const DEAL_ID    = 'deal-1'
const MESSAGE_ID = 'msg-1'
const CONCIERGE  = 'concierge-1'

function patchReq(body: unknown, opts: { userId?: string | null; email?: string } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id']    = opts.userId ?? CONCIERGE
  if (opts.email !== null)  headers['x-user-email'] = opts.email  ?? 'c@x.com'
  return new NextRequest(`http://localhost/api/deals/${DEAL_ID}/messages/${MESSAGE_ID}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  })
}
const params = () => Promise.resolve({ id: DEAL_ID, messageId: MESSAGE_ID })

beforeEach(() => {
  mockGetDeal.mockReset(); mockGetDealMessage.mockReset()
  mockSetDealMessagePinned.mockReset(); mockRemoveDealMessage.mockReset()
  mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(false)
})

describe('PATCH /api/deals/[id]/messages/[messageId] — moderation gate', () => {
  it('requires authentication', async () => {
    const res = await PATCH(patchReq({ pinned: true }, { userId: null }), { params: params() })
    expect(res.status).toBe(401)
  })

  it('returns 404 when the deal does not exist', async () => {
    mockGetDeal.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ pinned: true }), { params: params() })
    expect(res.status).toBe(404)
  })

  it('forbids a non-admin who is NOT the deal creator', async () => {
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, created_by: 'someone-else' })
    const res = await PATCH(patchReq({ pinned: true }), { params: params() })
    expect(res.status).toBe(403)
    expect(mockSetDealMessagePinned).not.toHaveBeenCalled()
  })

  it('allows the deal creator to moderate', async () => {
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, created_by: CONCIERGE })
    mockGetDealMessage.mockResolvedValueOnce({ id: MESSAGE_ID, deal_id: DEAL_ID })
    const res = await PATCH(patchReq({ pinned: true }), { params: params() })
    expect(res.status).toBe(200)
  })

  it('allows admin to moderate even if they didn\'t create the deal', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(true)
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, created_by: 'someone-else' })
    mockGetDealMessage.mockResolvedValueOnce({ id: MESSAGE_ID, deal_id: DEAL_ID })
    const res = await PATCH(patchReq({ pinned: true }), { params: params() })
    expect(res.status).toBe(200)
  })

  it('returns 404 when the message doesn\'t exist OR belongs to a different deal', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(true)
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, created_by: CONCIERGE })
    // Wrong deal_id: message exists but is on a different deal
    mockGetDealMessage.mockResolvedValueOnce({ id: MESSAGE_ID, deal_id: 'other-deal' })
    const res = await PATCH(patchReq({ pinned: true }), { params: params() })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/deals/[id]/messages/[messageId] — actions', () => {
  beforeEach(() => {
    mockGetDeal.mockResolvedValue({ id: DEAL_ID, created_by: CONCIERGE })
    mockGetDealMessage.mockResolvedValue({ id: MESSAGE_ID, deal_id: DEAL_ID })
  })

  it('rejects empty payload (no pinned nor removed)', async () => {
    const res = await PATCH(patchReq({}), { params: params() })
    expect(res.status).toBe(400)
  })

  it('pins the message when pinned: true', async () => {
    const res = await PATCH(patchReq({ pinned: true }), { params: params() })
    expect(res.status).toBe(200)
    expect(mockSetDealMessagePinned).toHaveBeenCalledWith(MESSAGE_ID, true)
  })

  it('unpins when pinned: false', async () => {
    const res = await PATCH(patchReq({ pinned: false }), { params: params() })
    expect(res.status).toBe(200)
    expect(mockSetDealMessagePinned).toHaveBeenCalledWith(MESSAGE_ID, false)
  })

  it('removes (soft-deletes) when removed: true, recording the caller as the remover', async () => {
    const res = await PATCH(patchReq({ removed: true }), { params: params() })
    expect(res.status).toBe(200)
    expect(mockRemoveDealMessage).toHaveBeenCalledWith(MESSAGE_ID, CONCIERGE)
  })

  it('only accepts removed: true (literal); false is invalid', async () => {
    const res = await PATCH(patchReq({ removed: false }), { params: params() })
    expect(res.status).toBe(400)
  })
})
