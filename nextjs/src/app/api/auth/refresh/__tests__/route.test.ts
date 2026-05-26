import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockRefreshTokens = vi.fn()

vi.mock('@/lib/auth', () => ({
  refreshTokens: (...a: unknown[]) => mockRefreshTokens(...a),
}))

import { POST } from '../route'

function req(cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/auth/refresh', { method: 'POST', headers })
}

beforeEach(() => mockRefreshTokens.mockReset())

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh cookie is present', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  it('issues new ee_id + ee_access cookies on success (refresh cookie NOT rotated)', async () => {
    mockRefreshTokens.mockResolvedValueOnce({
      accessToken: 'new-a', idToken: 'new-i', refreshToken: 'unused', expiresIn: 3600,
    })

    const res = await POST(req('ee_refresh=old-r'))

    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    const names = setCookies.map(c => c.split('=')[0])
    expect(names).toContain('ee_access')
    expect(names).toContain('ee_id')
    // ee_refresh is NOT rotated by Cognito; route should leave it alone.
    expect(names).not.toContain('ee_refresh')
  })

  it('returns 401 when refresh fails (expired refresh token)', async () => {
    mockRefreshTokens.mockRejectedValueOnce(new Error('NotAuthorizedException'))
    const res = await POST(req('ee_refresh=old'))
    expect(res.status).toBe(401)
  })
})
