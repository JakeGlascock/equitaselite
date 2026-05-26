import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockSignOut = vi.fn()

vi.mock('@/lib/auth', () => ({
  signOut: (...a: unknown[]) => mockSignOut(...a),
}))
vi.mock('@/lib/public-url', () => ({
  publicUrl: (req: NextRequest, p: string) => new URL(p, 'http://localhost'),
}))

import { GET, POST } from '../route'

function req(method: 'GET' | 'POST', cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/auth/signout', { method, headers })
}

beforeEach(() => mockSignOut.mockReset())

describe('Signout — common behavior', () => {
  it('clears session cookies but NOT device-trust cookies', async () => {
    const res = await POST(req('POST', 'ee_access=t; ee_device_key=dk'))
    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie().join('\n').toLowerCase()
    // Session cookies cleared
    expect(setCookies).toMatch(/ee_access=/)
    expect(setCookies).toMatch(/ee_id=/)
    expect(setCookies).toMatch(/ee_refresh=/)
    expect(setCookies).toMatch(/max-age=0|expires=thu, 01 jan 1970/)
    // Device cookies must NOT be touched — "drop session, not trust"
    expect(setCookies).not.toMatch(/ee_device_key=/)
    expect(setCookies).not.toMatch(/ee_device_group=/)
    expect(setCookies).not.toMatch(/ee_device_password=/)
  })

  it('calls signOut when an access token is present', async () => {
    mockSignOut.mockResolvedValueOnce(undefined)
    await POST(req('POST', 'ee_access=access-jwt'))
    expect(mockSignOut).toHaveBeenCalledWith('access-jwt')
  })

  it('still succeeds when no access token is present', async () => {
    const res = await POST(req('POST'))
    expect(res.status).toBe(200)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('swallows signOut errors (expired token is fine)', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('expired'))
    const res = await POST(req('POST', 'ee_access=t'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/auth/signout — redirects', () => {
  it('redirects to / after clearing session', async () => {
    const res = await GET(req('GET', 'ee_access=t'))
    expect([302, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain('/')
  })
})
