import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockForgotPassword = vi.fn()

vi.mock('@/lib/auth', () => ({
  forgotPassword: (...a: unknown[]) => mockForgotPassword(...a),
}))

import { POST } from '../route'

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => mockForgotPassword.mockReset())

describe('POST /api/auth/forgot-password', () => {
  it('rejects malformed email', async () => {
    const res = await POST(postReq({ email: 'not-email' }))
    expect(res.status).toBe(400)
  })

  it('lowercases the email before passing to Cognito', async () => {
    mockForgotPassword.mockResolvedValueOnce(undefined)
    await POST(postReq({ email: 'Mixed@Case.com' }))
    expect(mockForgotPassword).toHaveBeenCalledWith('mixed@case.com')
  })

  it('returns ok:200 on success', async () => {
    mockForgotPassword.mockResolvedValueOnce(undefined)
    const res = await POST(postReq({ email: 'a@b.com' }))
    expect(res.status).toBe(200)
  })

  it('returns ok:200 even when Cognito errors (enumeration defense)', async () => {
    const e = new Error('UserNotFoundException'); e.name = 'UserNotFoundException'
    mockForgotPassword.mockRejectedValueOnce(e)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({ email: 'unknown@x.com' }))

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    errSpy.mockRestore()
  })

  it('surfaces 429 on LimitExceededException', async () => {
    const e = new Error('rate'); e.name = 'LimitExceededException'
    mockForgotPassword.mockRejectedValueOnce(e)
    const res = await POST(postReq({ email: 'a@b.com' }))
    expect(res.status).toBe(429)
  })

  it('surfaces 429 on TooManyRequestsException', async () => {
    const e = new Error('rate'); e.name = 'TooManyRequestsException'
    mockForgotPassword.mockRejectedValueOnce(e)
    const res = await POST(postReq({ email: 'a@b.com' }))
    expect(res.status).toBe(429)
  })
})
