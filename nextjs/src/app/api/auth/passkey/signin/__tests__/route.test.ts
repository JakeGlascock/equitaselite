import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockPasskeySigninInit   = vi.fn()
const mockPasskeySigninVerify = vi.fn()

vi.mock('@/lib/auth', () => ({
  passkeySigninInit:   (...a: unknown[]) => mockPasskeySigninInit(...a),
  passkeySigninVerify: (...a: unknown[]) => mockPasskeySigninVerify(...a),
}))

import { POST } from '../route'

const TOKENS = {
  accessToken: 'a', idToken: 'i', refreshToken: 'r', expiresIn: 3600,
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/passkey/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockPasskeySigninInit.mockReset()
  mockPasskeySigninVerify.mockReset()
})

describe('POST /api/auth/passkey/signin', () => {
  it('init returns session + challengeParameters from Cognito', async () => {
    mockPasskeySigninInit.mockResolvedValueOnce({
      session: 's',
      challengeParameters: { CREDENTIAL_REQUEST_OPTIONS: '{}' },
    })
    const res = await POST(postReq({ step: 'init', email: 'a@b.com' }))
    expect(res.status).toBe(200)
    expect((await res.json()).session).toBe('s')
  })

  it('init rejects an invalid email', async () => {
    const res = await POST(postReq({ step: 'init', email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('verify exchanges credential for tokens + sets session cookies', async () => {
    mockPasskeySigninVerify.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(postReq({
      step: 'verify', email: 'a@b.com', session: 's', credential: { id: 'cred', response: {} },
    }))

    expect(res.status).toBe(200)
    const names = res.headers.getSetCookie().map(c => c.split('=')[0])
    expect(names).toContain('ee_access')
    expect(names).toContain('ee_id')
    expect(names).toContain('ee_refresh')
  })

  it('verify rejects a missing session field', async () => {
    const res = await POST(postReq({ step: 'verify', email: 'a@b.com', credential: {} }))
    expect(res.status).toBe(400)
  })

  it('unknown step returns 400', async () => {
    const res = await POST(postReq({ step: 'wat' }))
    expect(res.status).toBe(400)
  })

  it('maps NotAuthorizedException to a generic 401 (does not leak whether user / passkey exists)', async () => {
    const e = new Error('Not authorized'); e.name = 'NotAuthorizedException'
    mockPasskeySigninVerify.mockRejectedValueOnce(e)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({
      step: 'verify', email: 'a@b.com', session: 's', credential: {},
    }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Passkey signin failed/)
    expect(body.error).not.toMatch(/user.*not.*found/i)
    errSpy.mockRestore()
  })

  it('catches unknown errors with a generic 401', async () => {
    mockPasskeySigninInit.mockRejectedValueOnce('plain string')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({ step: 'init', email: 'a@b.com' }))

    expect(res.status).toBe(401)
    errSpy.mockRestore()
  })
})
