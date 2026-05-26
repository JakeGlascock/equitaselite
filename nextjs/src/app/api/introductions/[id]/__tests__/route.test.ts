import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockEmailIntroAccepted  = vi.fn()
const mockEmailIntroDeclined  = vi.fn()
const mockGetEffectiveUserId  = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/email', () => ({
  emailIntroAccepted: (...a: unknown[]) => mockEmailIntroAccepted(...a),
  emailIntroDeclined: (...a: unknown[]) => mockEmailIntroDeclined(...a),
}))
vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...a: unknown[]) => mockGetEffectiveUserId(...a),
}))

import { PATCH } from '../route'

const ME    = 'recipient-a'
const OTHER = 'requester-b'
const INTRO_ID = 'intro-1'

function patchReq(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/introductions/${INTRO_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const params = () => Promise.resolve({ id: INTRO_ID })

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
  mockEmailIntroAccepted.mockReset(); mockEmailIntroDeclined.mockReset()
  mockGetEffectiveUserId.mockReset()
})

describe('PATCH /api/introductions/[id]', () => {
  it('requires authentication', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ status: 'accepted' }), { params: params() })
    expect(res.status).toBe(401)
  })

  it('rejects invalid status values', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    const res = await PATCH(patchReq({ status: 'maybe' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('returns 404 if the row WHERE clause finds nothing (wrong recipient or already responded)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ status: 'accepted' }), { params: params() })
    expect(res.status).toBe(404)
    // Security-critical: UPDATE must scope by recipient_id = $userId
    const sql = mockQueryOne.mock.calls[0][0]
    expect(sql).toContain('recipient_id = $2')
    expect(sql).toContain("status = 'pending'")
  })

  it('accepts an intro and emails the requester', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    mockQueryOne
      .mockResolvedValueOnce({ id: INTRO_ID, requester_id: OTHER, recipient_id: ME, status: 'accepted' })
      .mockResolvedValueOnce({ full_name: 'Bob FO', firm_name: 'Beta Capital', email: 'bob@beta.com' })
    mockQuery.mockResolvedValue(undefined)
    mockEmailIntroAccepted.mockResolvedValue(undefined)

    const res = await PATCH(patchReq({ status: 'accepted' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockEmailIntroAccepted).toHaveBeenCalledWith(OTHER, 'Bob FO', 'Beta Capital', 'bob@beta.com')
    // Notification row type must be intro_accepted (not intro_declined)
    const notif = mockQuery.mock.calls[0][1]
    expect(notif[1]).toBe('intro_accepted')
  })

  it('declines an intro and emails the requester', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    mockQueryOne
      .mockResolvedValueOnce({ id: INTRO_ID, requester_id: OTHER, recipient_id: ME, status: 'declined' })
      .mockResolvedValueOnce({ full_name: 'Bob', firm_name: 'B', email: 'b@b.com' })
    mockQuery.mockResolvedValue(undefined)
    mockEmailIntroDeclined.mockResolvedValue(undefined)

    const res = await PATCH(patchReq({ status: 'declined' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockEmailIntroDeclined).toHaveBeenCalledWith(OTHER, 'Bob', 'B')
    expect(mockEmailIntroAccepted).not.toHaveBeenCalled()
  })

  it('survives a missing recipient profile (no notification, intro still updated)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    mockQueryOne
      .mockResolvedValueOnce({ id: INTRO_ID, requester_id: OTHER, recipient_id: ME, status: 'accepted' })
      .mockResolvedValueOnce(null)

    const res = await PATCH(patchReq({ status: 'accepted' }), { params: params() })

    expect(res.status).toBe(200)
    expect(mockEmailIntroAccepted).not.toHaveBeenCalled()
  })

  it('survives a notifications insert failure (table missing on early-stage env)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    mockQueryOne
      .mockResolvedValueOnce({ id: INTRO_ID, requester_id: OTHER, recipient_id: ME, status: 'accepted' })
      .mockRejectedValueOnce(new Error('me lookup failed'))

    const res = await PATCH(patchReq({ status: 'accepted' }), { params: params() })

    expect(res.status).toBe(200)
  })

  it('survives an email send failure', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(ME)
    mockQueryOne
      .mockResolvedValueOnce({ id: INTRO_ID, requester_id: OTHER, recipient_id: ME, status: 'accepted' })
      .mockResolvedValueOnce({ full_name: 'B', firm_name: 'F', email: 'e@e.com' })
    mockQuery.mockResolvedValue(undefined)
    mockEmailIntroAccepted.mockRejectedValueOnce(new Error('SES down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await PATCH(patchReq({ status: 'accepted' }), { params: params() })

    expect(res.status).toBe(200)
    errSpy.mockRestore()
  })
})
