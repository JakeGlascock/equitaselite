import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()
const mockQuery    = vi.fn()
const mockCookies  = vi.fn()
const mockHeaders  = vi.fn()

vi.mock('@/lib/db', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  query:    (...a: unknown[]) => mockQuery(...a),
}))
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
}))

import {
  applyShadowGate,
  getShadowState,
  getEffectiveReadUserId,
  logShadowView,
  listRecentShadowViews,
  notifyParentOfShadowAction,
  SHADOW_COOKIE,
  SHADOW_WRITE_ALLOWLIST,
  SHADOW_AUDIT_DEDUP_MINUTES,
} from '../shadow'

beforeEach(() => {
  mockQueryOne.mockReset()
  mockQuery.mockReset()
  mockCookies.mockReset()
  mockHeaders.mockReset()
  mockQuery.mockResolvedValue(undefined)
})

function buildReq(method: string, path: string, cookieVal?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookieVal !== undefined) headers['cookie'] = `${SHADOW_COOKIE}=${cookieVal}`
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
  })
}

describe('applyShadowGate — middleware mutation defense', () => {
  it('returns null when no shadow cookie is set, regardless of method', () => {
    const h = new Headers()
    expect(applyShadowGate(buildReq('POST', '/api/introductions'), h, '/api/introductions')).toBeNull()
    expect(h.has('x-shadow-mode')).toBe(false)
  })

  it('threads x-shadow-mode header when the cookie is present (read path passes through)', () => {
    const h = new Headers()
    const res = applyShadowGate(buildReq('GET', '/api/notifications', 'parent-1'), h, '/api/notifications')
    expect(res).toBeNull()
    expect(h.get('x-shadow-mode')).toBe('1')
  })

  it('lets HEAD pass through (treated like GET)', () => {
    const h = new Headers()
    expect(applyShadowGate(buildReq('HEAD', '/api/anything', 'parent-1'), h, '/api/anything')).toBeNull()
  })

  it('lets non-/api/ POSTs through — App Router page POSTs (form actions) are not routed via /api', () => {
    // We only gate /api/ since that's the boundary every mutating
    // operation crosses. Server actions to RSC are out of scope for
    // P5b v1.
    const h = new Headers()
    expect(applyShadowGate(buildReq('POST', '/profile', 'parent-1'), h, '/profile')).toBeNull()
  })

  it('returns 403 for a mutating /api/ call while shadowing', async () => {
    const h = new Headers()
    const res = applyShadowGate(buildReq('POST', '/api/introductions', 'parent-1'), h, '/api/introductions')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.error).toMatch(/Read-only while viewing as your parent seat/i)
  })

  it.each(['DELETE', 'PATCH', 'PUT'])('returns 403 for %s while shadowing (not just POST)', method => {
    const h = new Headers()
    const res = applyShadowGate(buildReq(method, '/api/me/mandate-weights', 'parent-1'), h, '/api/me/mandate-weights')
    expect(res!.status).toBe(403)
  })

  it.each(SHADOW_WRITE_ALLOWLIST)('lets the allowlisted path %s mutate (exit + auth upkeep)', path => {
    const h = new Headers()
    expect(applyShadowGate(buildReq('POST', path, 'parent-1'), h, path)).toBeNull()
    expect(applyShadowGate(buildReq('DELETE', path, 'parent-1'), h, path)).toBeNull()
  })

  it('treats /api/me/shadow/anything as allowlisted (subpath of /api/me/shadow)', () => {
    const h = new Headers()
    expect(applyShadowGate(buildReq('POST', '/api/me/shadow/whatever', 'parent-1'), h, '/api/me/shadow/whatever')).toBeNull()
  })

  it('does NOT treat /api/me/shadow-impostor as allowlisted (prefix-only match)', () => {
    // Guard against allowlist bypass via lookalike paths.
    const h = new Headers()
    const res = applyShadowGate(buildReq('POST', '/api/me/shadow-impostor', 'parent-1'), h, '/api/me/shadow-impostor')
    expect(res!.status).toBe(403)
  })

  // P5e — regex pattern allowlist for parameterized routes (deal
  // comments + event RSVPs). Anchored regex protects against suffix
  // lookalikes that a string prefix can't.
  it('lets POST /api/deals/<id>/messages through (P5e comment allowance)', () => {
    const h = new Headers()
    const path = '/api/deals/abc-123/messages'
    expect(applyShadowGate(buildReq('POST', path, 'parent-1'), h, path)).toBeNull()
  })

  it('lets POST /api/events/<id>/rsvp through (P5e RSVP allowance)', () => {
    const h = new Headers()
    const path = '/api/events/evt-77/rsvp'
    expect(applyShadowGate(buildReq('POST', path, 'parent-1'), h, path)).toBeNull()
  })

  it('lets DELETE /api/events/<id>/rsvp through too (un-RSVP reversibility)', () => {
    const h = new Headers()
    const path = '/api/events/evt-77/rsvp'
    expect(applyShadowGate(buildReq('DELETE', path, 'parent-1'), h, path)).toBeNull()
  })

  it('blocks lookalike /api/deals/<id>/messages/<mid> (no PATCH for moderation while shadowing)', () => {
    // Pin/remove must NOT be reachable while shadowing — the regex
    // is anchored with $ so the extra path segment doesn't match.
    const h = new Headers()
    const path = '/api/deals/abc-123/messages/msg-9'
    const res = applyShadowGate(buildReq('PATCH', path, 'parent-1'), h, path)
    expect(res!.status).toBe(403)
  })

  it('blocks lookalike /api/deals/<id>/messages-extra (no suffix match)', () => {
    const h = new Headers()
    const path = '/api/deals/abc-123/messages-extra'
    const res = applyShadowGate(buildReq('POST', path, 'parent-1'), h, path)
    expect(res!.status).toBe(403)
  })

  it('blocks /api/events/<id>/cancel-rsvp (anchored regex)', () => {
    const h = new Headers()
    const path = '/api/events/evt-77/cancel-rsvp'
    const res = applyShadowGate(buildReq('POST', path, 'parent-1'), h, path)
    expect(res!.status).toBe(403)
  })
})

describe('notifyParentOfShadowAction — P5e parent audit notification', () => {
  it('writes a next_gen_action notification with the formatted title + linked deep link', async () => {
    await notifyParentOfShadowAction({
      parentId:     'parent-1',
      nextGenId:    'ng-1',
      nextGenName:  'Avery',
      actionVerb:   'posted in',
      contextTitle: 'AI Co — Series B',
      bodySnippet:  'spoke to two LPs already',
      linkUrl:      '/deals/deal-1',
      relatedId:    'msg-9',
    })
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO notifications/i)
    expect(sql).toContain("'next_gen_action'")
    expect(params[0]).toBe('parent-1')
    expect(params[1]).toBe('Avery (your next-gen) posted in AI Co — Series B')
    expect(params[2]).toBe('spoke to two LPs already')
    expect(params[3]).toBe('/deals/deal-1')
    expect(params[4]).toBe('msg-9')
  })

  it('defaults snippet to "" and relatedId to null when omitted', async () => {
    await notifyParentOfShadowAction({
      parentId:     'parent-1',
      nextGenId:    'ng-1',
      nextGenName:  'Avery',
      actionVerb:   'RSVPed to',
      contextTitle: 'Aspen Roundtable',
      linkUrl:      '/events',
    })
    const [, params] = mockQuery.mock.calls[0]
    expect(params[2]).toBe('')
    expect(params[4]).toBeNull()
  })

  it('swallows db errors — never breaks the calling action', async () => {
    mockQuery.mockRejectedValueOnce(new Error('check constraint violated'))
    await expect(notifyParentOfShadowAction({
      parentId: 'p', nextGenId: 'n', nextGenName: 'A',
      actionVerb: 'did', contextTitle: 'X', linkUrl: '/',
    })).resolves.toBeUndefined()
  })
})

// Helper that wires up the next/headers mocks the way getShadowState
// expects: x-user-id + the shadow cookie.
function mockNextHeaders(opts: { userId: string | null; cookieParentId?: string }) {
  mockHeaders.mockResolvedValue({ get: (k: string) => k === 'x-user-id' ? opts.userId : null })
  mockCookies.mockResolvedValue({
    get: (k: string) => k === SHADOW_COOKIE ? { value: opts.cookieParentId } : undefined,
  })
}

describe('getShadowState — server-component cookie validation', () => {
  it('returns null when the viewer isn\'t signed in (no x-user-id)', async () => {
    mockNextHeaders({ userId: null, cookieParentId: 'parent-1' })
    expect(await getShadowState()).toBeNull()
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('returns null when no shadow cookie is set', async () => {
    mockNextHeaders({ userId: 'ng-1' })
    expect(await getShadowState()).toBeNull()
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('returns null when the viewer\'s parent_profile_id does NOT match the cookie (stale revoke)', async () => {
    mockNextHeaders({ userId: 'ng-1', cookieParentId: 'parent-1' })
    mockQueryOne.mockResolvedValueOnce(null)   // JOIN returns nothing
    expect(await getShadowState()).toBeNull()
  })

  it('returns shadow state on a valid link', async () => {
    mockNextHeaders({ userId: 'ng-1', cookieParentId: 'parent-1' })
    mockQueryOne.mockResolvedValueOnce({ id: 'parent-1', full_name: 'P', firm_name: 'PFirm' })
    const s = await getShadowState()
    expect(s).toEqual({
      actualUserId: 'ng-1',
      parentId:     'parent-1',
      parentProfile: { id: 'parent-1', full_name: 'P', firm_name: 'PFirm' },
    })
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('JOIN profiles p ON p.id = me.parent_profile_id')
    expect(sql).toContain('WHERE me.id = $1 AND p.id = $2')
    expect(params).toEqual(['ng-1', 'parent-1'])
  })

  it('returns null silently on db error (pre-043 safety)', async () => {
    mockNextHeaders({ userId: 'ng-1', cookieParentId: 'parent-1' })
    mockQueryOne.mockRejectedValueOnce(new Error('column parent_profile_id does not exist'))
    expect(await getShadowState()).toBeNull()
  })
})

describe('logShadowView — P5d per-view audit', () => {
  it('inserts with the NOT EXISTS dedup guard using the configured window', async () => {
    await logShadowView('parent-1', 'ng-1', '/dashboard')
    const [sql, params] = mockQuery.mock.calls[0]
    // Insert + dedup are a single SQL statement, not a separate read.
    // INSERT...SELECT...WHERE NOT EXISTS shape lets pg do the dedup
    // atomically — no race window where two concurrent renders both
    // see "no recent row" and both insert.
    expect(sql).toContain('INSERT INTO shadow_audit_logs')
    expect(sql).toContain('WHERE NOT EXISTS')
    expect(sql).toMatch(/viewed_at > NOW\(\)\s*-\s*\(\$4\s*\|\|\s*' minutes'\)::interval/i)
    expect(params).toEqual(['parent-1', 'ng-1', '/dashboard', String(SHADOW_AUDIT_DEDUP_MINUTES)])
  })

  it('swallows db errors — never breaks the page render', async () => {
    mockQuery.mockRejectedValueOnce(new Error('table shadow_audit_logs does not exist'))
    await expect(logShadowView('parent-1', 'ng-1', '/dashboard')).resolves.toBeUndefined()
  })
})

describe('listRecentShadowViews', () => {
  it('returns entries newest-first, joined to the next-gen name', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 'a', next_gen_id: 'ng-1', next_gen_name: 'Avery', pathname: '/dashboard', viewed_at: '2026-05-27T12:00:00Z' },
    ])
    const out = await listRecentShadowViews('parent-1', 5)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('FROM shadow_audit_logs l')
    expect(sql).toContain('LEFT JOIN profiles ng ON ng.id = l.next_gen_id')
    expect(sql).toContain('WHERE l.parent_id = $1')
    expect(sql).toContain('ORDER BY l.viewed_at DESC')
    expect(params).toEqual(['parent-1', 5])
    expect(out).toHaveLength(1)
    expect(out[0].next_gen_name).toBe('Avery')
  })

  it('returns [] on any db error (pre-045 safety)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation does not exist'))
    expect(await listRecentShadowViews('parent-1')).toEqual([])
  })
})

describe('getEffectiveReadUserId', () => {
  it('returns the parent id when shadowing', async () => {
    mockNextHeaders({ userId: 'ng-1', cookieParentId: 'parent-1' })
    mockQueryOne.mockResolvedValueOnce({ id: 'parent-1', full_name: 'P', firm_name: 'PFirm' })
    expect(await getEffectiveReadUserId('ng-1')).toBe('parent-1')
  })

  it('returns the fallback when not shadowing', async () => {
    mockNextHeaders({ userId: 'ng-1' })   // no cookie
    expect(await getEffectiveReadUserId('ng-1')).toBe('ng-1')
  })
})
