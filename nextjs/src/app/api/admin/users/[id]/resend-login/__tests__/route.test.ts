import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne          = vi.fn()
const mockIsUserAdmin       = vi.fn()
const mockResendInvite      = vi.fn()
const mockResetUserPassword = vi.fn()

vi.mock('@/lib/db',    () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/auth',  () => ({
  resendInvite:       (...a: unknown[]) => mockResendInvite(...a),
  resetUserPassword:  (...a: unknown[]) => mockResetUserPassword(...a),
}))

import { POST } from '../route'

const TARGET = 'target-1'

function postReq(id: string, opts: { admin?: boolean; emailQS?: string } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.admin !== false) {
    headers['x-user-id']    = 'admin-1'
    headers['x-user-email'] = 'admin@x.com'
  }
  const url = opts.emailQS
    ? `http://localhost/api/admin/users/${id}/resend-login?email=${encodeURIComponent(opts.emailQS)}`
    : `http://localhost/api/admin/users/${id}/resend-login`
  return new NextRequest(url, { method: 'POST', headers })
}
const params = (id: string) => () => Promise.resolve({ id })

beforeEach(() => {
  mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockResendInvite.mockReset(); mockResetUserPassword.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/users/[id]/resend-login', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await POST(postReq(TARGET), { params: params(TARGET)() })
    expect(res.status).toBe(403)
  })

  it('refuses demo/managed profiles (no Cognito user)', async () => {
    let res = await POST(postReq('demo_alice'),    { params: params('demo_alice')() })
    expect(res.status).toBe(400)
    res = await POST(postReq('managed_x'),         { params: params('managed_x')() })
    expect(res.status).toBe(400)
    expect(mockResendInvite).not.toHaveBeenCalled()
  })

  it('returns 400 when no profile exists and no ?email is passed', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await POST(postReq(TARGET), { params: params(TARGET)() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/no email on file/i)
  })

  it('resends invite when the Cognito user is in FORCE_CHANGE_PASSWORD', async () => {
    mockQueryOne.mockResolvedValueOnce({ email: 't@x.com' })
    mockResendInvite.mockResolvedValueOnce(undefined)

    const res = await POST(postReq(TARGET), { params: params(TARGET)() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, action: 'resend_invite' })
    expect(mockResetUserPassword).not.toHaveBeenCalled()
  })

  it('uses ?email when no profile row exists yet', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    mockResendInvite.mockResolvedValueOnce(undefined)

    const res = await POST(
      postReq(TARGET, { emailQS: 'invited@x.com' }),
      { params: params(TARGET)() },
    )

    expect(res.status).toBe(200)
    expect(mockResendInvite).toHaveBeenCalledWith('invited@x.com')
  })

  it('falls back to password reset when resend fails with "already confirmed"', async () => {
    mockQueryOne.mockResolvedValueOnce({ email: 't@x.com' })
    const e = new Error('NotAuthorizedException: User is already confirmed')
    mockResendInvite.mockRejectedValueOnce(e)
    mockResetUserPassword.mockResolvedValueOnce(undefined)

    const res = await POST(postReq(TARGET), { params: params(TARGET)() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, action: 'password_reset' })
  })

  it('does NOT fall back to password reset on an unrelated resend failure', async () => {
    mockQueryOne.mockResolvedValueOnce({ email: 't@x.com' })
    mockResendInvite.mockRejectedValueOnce(new Error('Network failure'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq(TARGET), { params: params(TARGET)() })

    expect(res.status).toBe(500)
    expect(mockResetUserPassword).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('returns 500 if both resend and reset fail', async () => {
    mockQueryOne.mockResolvedValueOnce({ email: 't@x.com' })
    mockResendInvite.mockRejectedValueOnce(new Error('already confirmed'))
    mockResetUserPassword.mockRejectedValueOnce(new Error('Cognito 5xx'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq(TARGET), { params: params(TARGET)() })

    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})
