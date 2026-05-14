import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'

// Mocks must be declared before importing the SUT so the dynamic-import-style
// resolution picks up the mocked module.
const mockQueryOne = vi.fn()
const mockHeaders  = vi.fn()
const mockCookies  = vi.fn()

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  query:    vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}))

import { getActingAsState, getEffectiveUserId, ACTING_AS_COOKIE } from '../acting-as'

function makeHeaders(map: Record<string, string | null>) {
  return {
    get: (k: string) => map[k] ?? null,
  }
}
function makeCookieStore(value: string | undefined) {
  return {
    get: (name: string) => name === ACTING_AS_COOKIE && value !== undefined ? { value } : undefined,
  }
}

beforeEach(() => {
  mockQueryOne.mockReset()
  mockHeaders.mockReset()
  mockCookies.mockReset()
})

describe('ACTING_AS_COOKIE', () => {
  it('uses the documented cookie name', () => {
    expect(ACTING_AS_COOKIE).toBe('ee_acting_as')
  })
})

describe('getActingAsState', () => {
  it('returns null when there is no signed-in user', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': null }))
    mockCookies.mockResolvedValue(makeCookieStore(undefined))
    expect(await getActingAsState()).toBeNull()
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('returns the actual user when no acting-as cookie is set', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-1' }))
    mockCookies.mockResolvedValue(makeCookieStore(undefined))

    const state = await getActingAsState()
    expect(state).toEqual({
      effectiveUserId: 'user-1',
      actualUserId:    'user-1',
      managedProfile:  null,
    })
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('switches to the managed profile when the caller owns that assignment', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'concierge-1' }))
    mockCookies.mockResolvedValue(makeCookieStore('managed_abc'))
    mockQueryOne.mockResolvedValue({
      id: 'managed_abc', full_name: 'Aria Mendes', firm_name: 'Apex FO', role: 'family_office',
    })

    const state = await getActingAsState()
    expect(state).toEqual({
      effectiveUserId: 'managed_abc',
      actualUserId:    'concierge-1',
      managedProfile: { id: 'managed_abc', full_name: 'Aria Mendes', firm_name: 'Apex FO', role: 'family_office' },
    })
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('managed_by = $2'),
      ['managed_abc', 'concierge-1']
    )
  })

  it('falls back to the actual user when the cookie points to a profile the caller does not manage', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'concierge-1' }))
    mockCookies.mockResolvedValue(makeCookieStore('managed_other'))
    mockQueryOne.mockResolvedValue(null)

    const state = await getActingAsState()
    expect(state).toEqual({
      effectiveUserId: 'concierge-1',
      actualUserId:    'concierge-1',
      managedProfile:  null,
    })
  })

  it('swallows DB errors and falls back to the actual user (stale-schema safety)', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'concierge-1' }))
    mockCookies.mockResolvedValue(makeCookieStore('managed_abc'))
    mockQueryOne.mockRejectedValue(new Error('column "managed_by" does not exist'))

    const state = await getActingAsState()
    expect(state).toEqual({
      effectiveUserId: 'concierge-1',
      actualUserId:    'concierge-1',
      managedProfile:  null,
    })
  })
})

describe('getEffectiveUserId', () => {
  function makeReq(userId: string | null, cookieVal?: string): NextRequest {
    return {
      headers: { get: (k: string) => (k === 'x-user-id' ? userId : null) },
      cookies: { get: (name: string) => (name === ACTING_AS_COOKIE && cookieVal !== undefined ? { value: cookieVal } : undefined) },
    } as unknown as NextRequest
  }

  it('returns null when unauthenticated', async () => {
    expect(await getEffectiveUserId(makeReq(null))).toBeNull()
  })

  it('returns the actual user id when no acting-as cookie is present', async () => {
    expect(await getEffectiveUserId(makeReq('user-1'))).toBe('user-1')
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('returns the managed profile id when the assignment is valid', async () => {
    mockQueryOne.mockResolvedValue({ id: 'managed_abc' })
    expect(await getEffectiveUserId(makeReq('concierge-1', 'managed_abc'))).toBe('managed_abc')
  })

  it('falls back to the actual user when the assignment lookup returns null', async () => {
    mockQueryOne.mockResolvedValue(null)
    expect(await getEffectiveUserId(makeReq('concierge-1', 'managed_other'))).toBe('concierge-1')
  })

  it('falls back to the actual user when the DB throws', async () => {
    mockQueryOne.mockRejectedValue(new Error('connection refused'))
    expect(await getEffectiveUserId(makeReq('concierge-1', 'managed_abc'))).toBe('concierge-1')
  })
})
