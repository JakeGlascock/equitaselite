import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockGetDeal             = vi.fn()
const mockIsMemberOfDealRoom  = vi.fn()
const mockPostDealMessage     = vi.fn()
const mockListDealMessages    = vi.fn()
const mockListDealRoomUserIds = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/deals', () => ({
  getDeal:              (...a: unknown[]) => mockGetDeal(...a),
  isMemberOfDealRoom:   (...a: unknown[]) => mockIsMemberOfDealRoom(...a),
  postDealMessage:      (...a: unknown[]) => mockPostDealMessage(...a),
  listDealMessages:     (...a: unknown[]) => mockListDealMessages(...a),
  listDealRoomUserIds:  (...a: unknown[]) => mockListDealRoomUserIds(...a),
}))

import { GET, POST } from '../route'

const DEAL_ID = 'deal-1'
const USER_ID = 'sov-1'

function buildReq(method: 'GET' | 'POST', body?: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? USER_ID
  return new NextRequest(`http://localhost/api/deals/${DEAL_ID}/messages`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const params = () => Promise.resolve({ id: DEAL_ID })
const tick = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
  mockGetDeal.mockReset()
  mockIsMemberOfDealRoom.mockReset()
  mockPostDealMessage.mockReset()
  mockListDealMessages.mockReset()
  mockListDealRoomUserIds.mockReset()
})

describe('GET /api/deals/[id]/messages', () => {
  it('requires authentication', async () => {
    const res = await GET(buildReq('GET', undefined, { userId: null }), { params: params() })
    expect(res.status).toBe(401)
  })

  it('forbids non-members of the room', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(false)
    const res = await GET(buildReq('GET'), { params: params() })
    expect(res.status).toBe(403)
    expect(mockListDealMessages).not.toHaveBeenCalled()
  })

  it('returns the message list for a room member', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    mockListDealMessages.mockResolvedValueOnce([{ id: 'm-1', body: 'hi' }])
    const res = await GET(buildReq('GET'), { params: params() })
    expect(res.status).toBe(200)
    expect((await res.json()).messages).toHaveLength(1)
    expect(mockListDealMessages).toHaveBeenCalledWith(DEAL_ID)
  })

  it('returns [] when the list query throws (table missing or transient error)', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    mockListDealMessages.mockRejectedValueOnce(new Error('relation missing'))
    expect((await (await GET(buildReq('GET'), { params: params() })).json()).messages).toEqual([])
  })
})

describe('POST /api/deals/[id]/messages', () => {
  it('requires authentication', async () => {
    const res = await POST(buildReq('POST', { body: 'hi' }, { userId: null }), { params: params() })
    expect(res.status).toBe(401)
  })

  it('forbids non-members of the room (stolen-session defense)', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(false)
    const res = await POST(buildReq('POST', { body: 'hi' }), { params: params() })
    expect(res.status).toBe(403)
    expect(mockPostDealMessage).not.toHaveBeenCalled()
  })

  it('rejects empty body', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    const res = await POST(buildReq('POST', { body: '   ' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('rejects over-long body (>4000 chars)', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    const res = await POST(buildReq('POST', { body: 'x'.repeat(4001) }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('persists the message and returns it', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    mockPostDealMessage.mockResolvedValueOnce({ id: 'm-1', body: 'hello', user_id: USER_ID })
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'AI Co' })
    mockListDealRoomUserIds.mockResolvedValueOnce([USER_ID, 'sov-2', 'sov-3'])
    mockQueryOne.mockResolvedValueOnce({ full_name: 'Alice' })
    mockQuery.mockResolvedValue(undefined)

    const res = await POST(buildReq('POST', { body: 'hello' }), { params: params() })
    expect(res.status).toBe(201)
    expect((await res.json()).message.body).toBe('hello')
    expect(mockPostDealMessage).toHaveBeenCalledWith(DEAL_ID, USER_ID, 'hello')
  })

  it('fan-outs notifications to every OTHER room member (poster excluded)', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    mockPostDealMessage.mockResolvedValueOnce({ id: 'm-1', body: 'hello', user_id: USER_ID })
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'AI Co' })
    mockListDealRoomUserIds.mockResolvedValueOnce([USER_ID, 'sov-2', 'sov-3'])
    mockQueryOne.mockResolvedValueOnce({ full_name: 'Alice' })
    mockQuery.mockResolvedValue(undefined)

    await POST(buildReq('POST', { body: 'hello' }), { params: params() })
    await tick()

    const notifInserts = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes("'deal_message'"),
    )
    expect(notifInserts).toHaveLength(2)             // sov-2 + sov-3, NOT USER_ID
    const recipientIds = notifInserts.map(c => c[1][0])
    expect(recipientIds).toContain('sov-2')
    expect(recipientIds).toContain('sov-3')
    expect(recipientIds).not.toContain(USER_ID)
  })

  it('still returns 201 even if notification fan-out fails (write is the source of truth)', async () => {
    mockIsMemberOfDealRoom.mockResolvedValueOnce(true)
    mockPostDealMessage.mockResolvedValueOnce({ id: 'm-1', body: 'hello', user_id: USER_ID })
    mockGetDeal.mockResolvedValueOnce({ id: DEAL_ID, title: 'AI Co' })
    mockListDealRoomUserIds.mockResolvedValueOnce(['sov-2'])
    mockQueryOne.mockRejectedValueOnce(new Error('author lookup failed'))
    mockQuery.mockResolvedValue(undefined)

    const res = await POST(buildReq('POST', { body: 'hello' }), { params: params() })
    expect(res.status).toBe(201)
    await tick()   // let the fan-out IIFE finish
  })
})
