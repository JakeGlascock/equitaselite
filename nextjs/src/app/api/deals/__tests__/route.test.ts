import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetTier                = vi.fn()
const mockListInvitationsForUser = vi.fn()

vi.mock('@/lib/membership', () => ({ getTier: (...a: unknown[]) => mockGetTier(...a) }))
vi.mock('@/lib/deals',      () => ({ listInvitationsForUser: (...a: unknown[]) => mockListInvitationsForUser(...a) }))

import { GET } from '../route'

function req(opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'u-1'
  return new NextRequest('http://localhost/api/deals', { headers })
}

beforeEach(() => {
  mockGetTier.mockReset(); mockListInvitationsForUser.mockReset()
})

describe('GET /api/deals', () => {
  it('requires authentication', async () => {
    expect((await GET(req({ userId: null }))).status).toBe(401)
  })

  it('refuses non-Sovereign tier (double-lock, even though only sovereigns get invitations)', async () => {
    mockGetTier.mockResolvedValueOnce('access')
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/Sovereign/)
    expect(mockListInvitationsForUser).not.toHaveBeenCalled()
  })

  it('also blocks Select tier', async () => {
    mockGetTier.mockResolvedValueOnce('select')
    expect((await GET(req())).status).toBe(403)
  })

  it('returns invitations for Sovereigns', async () => {
    mockGetTier.mockResolvedValueOnce('sovereign')
    mockListInvitationsForUser.mockResolvedValueOnce([{ id: 'inv-1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect((await res.json()).invitations).toHaveLength(1)
    expect(mockListInvitationsForUser).toHaveBeenCalledWith('u-1')
  })

  it('returns empty list when listInvitationsForUser throws', async () => {
    mockGetTier.mockResolvedValueOnce('sovereign')
    mockListInvitationsForUser.mockRejectedValueOnce(new Error('table missing'))
    expect((await (await GET(req())).json()).invitations).toEqual([])
  })
})
