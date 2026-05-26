import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockStartPasskeyRegistration = vi.fn()

vi.mock('@/lib/auth', () => ({
  startPasskeyRegistration: (...a: unknown[]) => mockStartPasskeyRegistration(...a),
}))

import { POST } from '../route'

function req(opts: { userId?: string | null; access?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'u-1'
  if (opts.access !== null) headers.cookie = `ee_access=${opts.access ?? 'token'}`
  return new NextRequest('http://localhost/api/auth/passkey/register/start', { method: 'POST', headers })
}

beforeEach(() => mockStartPasskeyRegistration.mockReset())

describe('POST /api/auth/passkey/register/start', () => {
  it('requires x-user-id', async () => {
    expect((await POST(req({ userId: null }))).status).toBe(401)
  })

  it('requires ee_access cookie', async () => {
    expect((await POST(req({ access: null }))).status).toBe(401)
  })

  it('forwards the access token and returns the WebAuthn options', async () => {
    mockStartPasskeyRegistration.mockResolvedValueOnce({ rp: { name: 'EE' }, challenge: 'c' })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect((await res.json()).options).toEqual({ rp: { name: 'EE' }, challenge: 'c' })
    expect(mockStartPasskeyRegistration).toHaveBeenCalledWith('token')
  })

  it('maps Cognito errors to a generic 500', async () => {
    mockStartPasskeyRegistration.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(req())
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})
