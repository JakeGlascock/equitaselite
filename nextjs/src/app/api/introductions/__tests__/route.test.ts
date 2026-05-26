import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockEmailIntroRequested = vi.fn()
const mockGetEffectiveUserId  = vi.fn()
const mockCheckIntroQuota     = vi.fn()
const mockSendPushToUser      = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/email', () => ({
  emailIntroRequested: (...a: unknown[]) => mockEmailIntroRequested(...a),
}))
vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...a: unknown[]) => mockGetEffectiveUserId(...a),
}))
vi.mock('@/lib/membership', () => ({
  checkIntroQuota: (...a: unknown[]) => mockCheckIntroQuota(...a),
}))
vi.mock('@/lib/push', () => ({
  sendPushToUser: (...a: unknown[]) => mockSendPushToUser(...a),
}))

import { GET, POST } from '../route'

const USER  = 'user-a'
const OTHER = 'user-b'

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/introductions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function getReq(): NextRequest {
  return new NextRequest('http://localhost/api/introductions')
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
  mockEmailIntroRequested.mockReset(); mockGetEffectiveUserId.mockReset()
  mockCheckIntroQuota.mockReset(); mockSendPushToUser.mockReset()
})

describe('GET /api/introductions', () => {
  it('requires authentication', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    const res = await GET(getReq())
    expect(res.status).toBe(401)
  })

  it('returns rows scoped to the caller (either party)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    mockQuery.mockResolvedValueOnce([{ id: 'intro-1' }])
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    // The WHERE clause must match either party — security-relevant.
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toContain('requester_id = $1 OR i.recipient_id = $1')
  })
})

describe('POST /api/introductions — auth + payload validation', () => {
  it('requires authentication', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    const res = await POST(postReq({ recipient_id: OTHER }))
    expect(res.status).toBe(401)
    expect(mockCheckIntroQuota).not.toHaveBeenCalled()
  })

  it('rejects a missing recipient_id', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    const res = await POST(postReq({}))
    expect(res.status).toBe(400)
  })

  it('rejects an over-long message', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    const res = await POST(postReq({ recipient_id: OTHER, message: 'x'.repeat(1001) }))
    expect(res.status).toBe(400)
  })

  it('rejects introducing to self', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    const res = await POST(postReq({ recipient_id: USER }))
    expect(res.status).toBe(400)
    expect(mockCheckIntroQuota).not.toHaveBeenCalled()
  })
})

describe('POST /api/introductions — tier quota enforcement', () => {
  it('returns 402 with upgradeRequired:select when Access tries to introduce', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    mockCheckIntroQuota.mockResolvedValueOnce({
      ok: false, tier: 'access', used: 0, limit: 0, remaining: 0,
    })

    const res = await POST(postReq({ recipient_id: OTHER }))

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.upgradeRequired).toBe('select')
    expect(body.error).toMatch(/not included on the Access plan/i)
  })

  it('returns 402 with upgradeRequired:sovereign when Select hits the cap', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    mockCheckIntroQuota.mockResolvedValueOnce({
      ok: false, tier: 'select', used: 5, limit: 5, remaining: 0,
    })

    const res = await POST(postReq({ recipient_id: OTHER }))

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.upgradeRequired).toBe('sovereign')
    expect(body.error).toMatch(/5 of your monthly introductions/i)
  })
})

describe('POST /api/introductions — happy path', () => {
  beforeEach(() => {
    mockGetEffectiveUserId.mockResolvedValue(USER)
    mockCheckIntroQuota.mockResolvedValue({
      ok: true, tier: 'select', used: 1, limit: 5, remaining: 4,
    })
  })

  it('returns 404 if the recipient is not found / not onboarded', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await POST(postReq({ recipient_id: OTHER }))
    expect(res.status).toBe(404)
  })

  it('inserts the introduction and fires notifications', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: OTHER })                                       // recipient lookup
      .mockResolvedValueOnce({ id: 'intro-1' })                                   // INSERT introductions
      .mockResolvedValueOnce({ full_name: 'Alice Angel', firm_name: 'Alpha LP' }) // me lookup
    mockQuery.mockResolvedValue(undefined)                                        // notifications insert
    mockEmailIntroRequested.mockResolvedValue(undefined)
    mockSendPushToUser.mockResolvedValue(undefined)

    const res = await POST(postReq({ recipient_id: OTHER, message: 'Hi' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'intro-1' })
    expect(mockEmailIntroRequested).toHaveBeenCalledWith(OTHER, 'Alice Angel', 'Alpha LP', 'Hi')
    expect(mockSendPushToUser).toHaveBeenCalledWith(OTHER, expect.objectContaining({
      category: 'intro',
    }))
  })

  it('truncates a long message in the bell snippet (UX invariant)', async () => {
    const long = 'x'.repeat(150)
    mockQueryOne
      .mockResolvedValueOnce({ id: OTHER })
      .mockResolvedValueOnce({ id: 'intro-1' })
      .mockResolvedValueOnce({ full_name: 'Alice', firm_name: 'Alpha' })
    mockQuery.mockResolvedValue(undefined)

    await POST(postReq({ recipient_id: OTHER, message: long }))

    const notifInsert = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('intro_requested'),
    )
    const body = notifInsert![1][2] as string
    expect(body).toContain('…')
    expect(body.length).toBeLessThan(long.length + 50)
  })

  it('survives a notifications-table failure (early-stage env)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: OTHER })
      .mockResolvedValueOnce({ id: 'intro-1' })
      .mockRejectedValueOnce(new Error('me lookup'))

    const res = await POST(postReq({ recipient_id: OTHER }))
    expect(res.status).toBe(201)
  })

  it('survives an email send failure', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: OTHER })
      .mockResolvedValueOnce({ id: 'intro-1' })
      .mockResolvedValueOnce({ full_name: 'A', firm_name: 'F' })
    mockQuery.mockResolvedValue(undefined)
    mockEmailIntroRequested.mockRejectedValueOnce(new Error('SES down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({ recipient_id: OTHER }))
    expect(res.status).toBe(201)
    errSpy.mockRestore()
  })

  it('survives a push send failure', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: OTHER })
      .mockResolvedValueOnce({ id: 'intro-1' })
      .mockResolvedValueOnce({ full_name: 'A', firm_name: 'F' })
    mockQuery.mockResolvedValue(undefined)
    mockSendPushToUser.mockRejectedValueOnce(new Error('APNs down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({ recipient_id: OTHER }))
    expect(res.status).toBe(201)
    errSpy.mockRestore()
  })

  it('maps a unique_pair conflict to 409 (idempotent duplicate request)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: OTHER })
    mockQueryOne.mockRejectedValueOnce(new Error('duplicate key on unique_pair'))

    const res = await POST(postReq({ recipient_id: OTHER }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already requested/i)
  })

  it('returns 500 with the message on an unknown DB error', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: OTHER })
    mockQueryOne.mockRejectedValueOnce(new Error('some other DB error'))

    const res = await POST(postReq({ recipient_id: OTHER }))

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('some other DB error')
  })
})
