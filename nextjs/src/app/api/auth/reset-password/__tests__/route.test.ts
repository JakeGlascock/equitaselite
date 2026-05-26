import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockConfirmForgotPassword = vi.fn()

vi.mock('@/lib/auth', () => ({
  confirmForgotPassword: (...a: unknown[]) => mockConfirmForgotPassword(...a),
}))

import { POST } from '../route'

const valid = {
  email: 'a@b.com', code: '123456', newPassword: 'aValidLongPassword!2026',
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const errOf = (name: string, msg = '') => {
  const e = new Error(msg || name); e.name = name; return e
}

beforeEach(() => mockConfirmForgotPassword.mockReset())

describe('POST /api/auth/reset-password', () => {
  it('rejects an invalid payload', async () => {
    const res = await POST(postReq({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
  })

  it('rejects a password shorter than 16 chars', async () => {
    const res = await POST(postReq({ ...valid, newPassword: 'short' }))
    expect(res.status).toBe(400)
  })

  it('lowercases the email', async () => {
    mockConfirmForgotPassword.mockResolvedValueOnce(undefined)
    await POST(postReq({ ...valid, email: 'A@B.com' }))
    expect(mockConfirmForgotPassword).toHaveBeenCalledWith('a@b.com', '123456', valid.newPassword)
  })

  it('returns 200 on success', async () => {
    mockConfirmForgotPassword.mockResolvedValueOnce(undefined)
    const res = await POST(postReq(valid))
    expect(res.status).toBe(200)
  })

  it.each([
    ['CodeMismatchException',     401, 'Incorrect reset code'],
    ['ExpiredCodeException',      401, 'expired'],
    ['LimitExceededException',    429, 'Too many'],
    ['TooManyRequestsException',  429, 'Too many'],
  ])('maps %s to %i', async (name, status, frag) => {
    mockConfirmForgotPassword.mockRejectedValueOnce(errOf(name))
    const res = await POST(postReq(valid))
    expect(res.status).toBe(status)
    expect((await res.json()).error.toLowerCase()).toContain(frag.toLowerCase())
  })

  it('maps InvalidPasswordException to 400 with the policy message', async () => {
    mockConfirmForgotPassword.mockRejectedValueOnce(
      errOf('InvalidPasswordException', 'Password too short'),
    )
    const res = await POST(postReq(valid))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Password too short')
  })

  it('falls back to a generic 500 on unknown errors', async () => {
    mockConfirmForgotPassword.mockRejectedValueOnce(new Error('weird'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq(valid))

    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})
