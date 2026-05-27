import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()
const mockCookies  = vi.fn()
const mockHeaders  = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
}))

import {
  applyShadowGate,
  getShadowState,
  getEffectiveReadUserId,
  SHADOW_COOKIE,
  SHADOW_WRITE_ALLOWLIST,
} from '../shadow'

beforeEach(() => {
  mockQueryOne.mockReset()
  mockCookies.mockReset()
  mockHeaders.mockReset()
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
