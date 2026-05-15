import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockGetEffectiveUserId  = vi.fn()
const mockGetTier             = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...args: unknown[]) => mockGetEffectiveUserId(...args),
}))

// Use the real priorityRank — it's a pure function. Only the DB-backed
// getTier is faked so we can dial the caller's tier per test.
vi.mock('@/lib/membership', async () => {
  const actual = await vi.importActual<typeof import('@/lib/membership')>('@/lib/membership')
  return {
    ...actual,
    getTier: (...args: unknown[]) => mockGetTier(...args),
  }
})

import { POST, DELETE } from '../route'

const EVENT_ID = '11111111-2222-3333-4444-555555555555'
const buildParams = () => Promise.resolve({ id: EVENT_ID })

function postReq(): NextRequest {
  return new NextRequest(`http://localhost/api/events/${EVENT_ID}/rsvp`, { method: 'POST' })
}
function deleteReq(): NextRequest {
  return new NextRequest(`http://localhost/api/events/${EVENT_ID}/rsvp`, { method: 'DELETE' })
}

beforeEach(() => {
  mockQuery.mockReset()
  mockQueryOne.mockReset()
  mockGetEffectiveUserId.mockReset()
  mockGetTier.mockReset()
})

const FUTURE = new Date('2027-01-01T12:00:00Z')
const PAST   = new Date('2024-01-01T12:00:00Z')

describe('POST /api/events/[id]/rsvp', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(401)
  })

  it('returns 404 when the event does not exist', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Event not found' })
  })

  it('returns 400 when the event has already passed', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne.mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'access', capacity: 100, date: PAST })
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Event has already passed' })
  })

  it('returns 402 with upgradeRequired when tier is too low (access caller, sovereign event)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne.mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'sovereign', capacity: 100, date: FUTURE })
    mockGetTier.mockResolvedValueOnce('access')
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.upgradeRequired).toBe('sovereign')
  })

  it('allows a select user to RSVP to a select event (tier equal)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'select', capacity: 100, date: FUTURE })  // event
      .mockResolvedValueOnce({ count: '5' })  // capacity check
    mockGetTier.mockResolvedValueOnce('select')
    mockQuery.mockResolvedValueOnce([])
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(200)
  })

  it('allows a sovereign user to RSVP to an access event (tier higher)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('sovereign')
    mockQuery.mockResolvedValueOnce([])
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(200)
  })

  it('returns 409 when the event is at capacity', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'access', capacity: 10, date: FUTURE })
      .mockResolvedValueOnce({ count: '10' })
    mockGetTier.mockResolvedValueOnce('access')
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Event is at capacity' })
  })

  it('inserts the RSVP with ON CONFLICT DO NOTHING (idempotent)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery.mockResolvedValueOnce([])
    await POST(postReq(), { params: buildParams() })
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('INSERT INTO event_rsvps')
    expect(sql).toContain('ON CONFLICT (event_id, user_id) DO NOTHING')
    expect(params).toEqual([EVENT_ID, 'user-1'])
  })

  it('returns 500 when the INSERT throws', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery.mockRejectedValueOnce(new Error('FK violation'))
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/events/[id]/rsvp', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    const res = await DELETE(deleteReq(), { params: buildParams() })
    expect(res.status).toBe(401)
  })

  it('runs DELETE FROM event_rsvps scoped to (event_id, user_id)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQuery.mockResolvedValueOnce([])
    const res = await DELETE(deleteReq(), { params: buildParams() })
    expect(res.status).toBe(200)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('DELETE FROM event_rsvps')
    expect(sql).toContain('WHERE event_id = $1 AND user_id = $2')
    expect(params).toEqual([EVENT_ID, 'user-1'])
  })
})
