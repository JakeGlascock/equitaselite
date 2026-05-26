import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockCompletePasskeyRegistration = vi.fn()

vi.mock('@/lib/auth', () => ({
  completePasskeyRegistration: (...a: unknown[]) => mockCompletePasskeyRegistration(...a),
}))

import { POST } from '../route'

function postReq(
  body: unknown,
  opts: { userId?: string | null; accessToken?: string | null } = {},
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null)     headers['x-user-id'] = opts.userId ?? 'u-1'
  if (opts.accessToken !== null) headers.cookie = `ee_access=${opts.accessToken ?? 'access-jwt'}`
  return new NextRequest('http://localhost/api/auth/passkey/register/complete', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => mockCompletePasskeyRegistration.mockReset())

describe('POST /api/auth/passkey/register/complete', () => {
  it('requires x-user-id (set by middleware)', async () => {
    const res = await POST(postReq({ credential: {} }, { userId: null }))
    expect(res.status).toBe(401)
    expect(mockCompletePasskeyRegistration).not.toHaveBeenCalled()
  })

  it('requires the ee_access cookie', async () => {
    const res = await POST(postReq({ credential: {} }, { accessToken: null }))
    expect(res.status).toBe(401)
  })

  it('rejects a missing credential field', async () => {
    const res = await POST(postReq({}))
    expect(res.status).toBe(400)
  })

  it('rejects a non-JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/passkey/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'u-1', cookie: 'ee_access=t' },
      body: '{invalid',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('forwards the credential to lib/auth and returns ok', async () => {
    mockCompletePasskeyRegistration.mockResolvedValueOnce(undefined)
    const credential = { id: 'cred-1', response: { attestationObject: 'x' } }

    const res = await POST(postReq({ credential }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockCompletePasskeyRegistration).toHaveBeenCalledWith('access-jwt', credential)
  })

  it('returns 500 with a generic message when Cognito rejects the credential', async () => {
    const e = new Error('webauthn boom'); e.name = 'InvalidParameterException'
    mockCompletePasskeyRegistration.mockRejectedValueOnce(e)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({ credential: { id: 'cred' } }))

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Could not register passkey.')
    errSpy.mockRestore()
  })
})
