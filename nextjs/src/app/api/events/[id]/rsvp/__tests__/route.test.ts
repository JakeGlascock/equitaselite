import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockGetEffectiveUserId  = vi.fn()
const mockGetTier             = vi.fn()
const mockGetShadowState      = vi.fn()
const mockNotifyParent        = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...args: unknown[]) => mockGetEffectiveUserId(...args),
}))

vi.mock('@/lib/shadow', () => ({
  getShadowState:              (...a: unknown[]) => mockGetShadowState(...a),
  notifyParentOfShadowAction:  (...a: unknown[]) => mockNotifyParent(...a),
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
  mockGetShadowState.mockReset()
  mockNotifyParent.mockReset()
  mockGetShadowState.mockResolvedValue(null)   // default: not shadowing
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

  it('inserts the RSVP with ON CONFLICT DO NOTHING (idempotent) — shadowed_parent_id NULL when not shadowing', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, title: 'Aspen Roundtable', min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery.mockResolvedValueOnce([])
    await POST(postReq(), { params: buildParams() })
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('INSERT INTO event_rsvps')
    expect(sql).toContain('ON CONFLICT (event_id, user_id) DO NOTHING')
    // P5e — third param is shadowed_parent_id; null when not shadowing.
    expect(params).toEqual([EVENT_ID, 'user-1', null])
  })

  it('falls back to the pre-046 INSERT shape when the column does not exist', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, title: 'X', min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery
      .mockRejectedValueOnce(new Error('column "shadowed_parent_id" does not exist'))
      .mockResolvedValueOnce([])
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(200)
    // Fallback INSERT shape — only event_id + user_id, no third column.
    const [fallbackSql, fallbackParams] = mockQuery.mock.calls[1]
    expect(fallbackSql).not.toContain('shadowed_parent_id')
    expect(fallbackParams).toEqual([EVENT_ID, 'user-1'])
  })

  it('returns 500 when both the new-shape and fallback INSERTs throw', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, title: 'X', min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery.mockRejectedValue(new Error('FK violation'))
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(500)
  })
})

// P5e — when a next-gen is shadowing, the tier check honors the
// PARENT'S tier (the action is on behalf of them), the RSVP row
// anchors to the next-gen, and the parent gets a next_gen_action
// audit notification.
describe('POST /api/events/[id]/rsvp — P5e shadow on behalf of parent', () => {
  const PARENT_ID  = 'parent-1'
  const NEXTGEN_ID = 'ng-1'
  beforeEach(() => {
    mockGetShadowState.mockResolvedValue({
      actualUserId:  NEXTGEN_ID,
      parentId:      PARENT_ID,
      parentProfile: { id: PARENT_ID, full_name: 'Parent', firm_name: 'Parent Capital' },
    })
  })

  it('uses the PARENT tier (not the next-gen) for the min_tier gate', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(NEXTGEN_ID)
    mockQueryOne.mockResolvedValueOnce({ id: EVENT_ID, title: 'Sovereign Summit', min_tier: 'sovereign', capacity: 100, date: FUTURE })
    mockGetTier.mockResolvedValueOnce('sovereign')   // parent's tier
    mockQueryOne.mockResolvedValueOnce({ count: '0' })
    mockQuery.mockResolvedValueOnce([])
    mockQueryOne.mockResolvedValueOnce({ full_name: 'Avery' })   // notify author lookup
    const res = await POST(postReq(), { params: buildParams() })
    expect(res.status).toBe(200)
    expect(mockGetTier).toHaveBeenCalledWith(PARENT_ID)
  })

  it('writes the row with user_id=next-gen and shadowed_parent_id=parent', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(NEXTGEN_ID)
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, title: 'X', min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery.mockResolvedValueOnce([])
    mockQueryOne.mockResolvedValueOnce({ full_name: 'Avery' })   // for the notify name lookup
    await POST(postReq(), { params: buildParams() })
    const [, params] = mockQuery.mock.calls[0]
    expect(params).toEqual([EVENT_ID, NEXTGEN_ID, PARENT_ID])
  })

  it('fires notifyParentOfShadowAction with RSVPed-to copy', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(NEXTGEN_ID)
    mockQueryOne
      .mockResolvedValueOnce({ id: EVENT_ID, title: 'Aspen Roundtable', min_tier: 'access', capacity: 100, date: FUTURE })
      .mockResolvedValueOnce({ count: '0' })
    mockGetTier.mockResolvedValueOnce('access')
    mockQuery.mockResolvedValueOnce([])
    mockQueryOne.mockResolvedValueOnce({ full_name: 'Avery' })
    await POST(postReq(), { params: buildParams() })

    expect(mockNotifyParent).toHaveBeenCalledTimes(1)
    const [opts] = mockNotifyParent.mock.calls[0]
    expect(opts).toMatchObject({
      parentId:     PARENT_ID,
      nextGenId:    NEXTGEN_ID,
      nextGenName:  'Avery',
      actionVerb:   'RSVPed to',
      contextTitle: 'Aspen Roundtable',
      linkUrl:      '/events',
    })
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
