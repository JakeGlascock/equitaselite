import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Reference test for Phase T0 — the pattern Phase T1 will copy across
// the rest of the security-shaped route handlers.
//
// Pattern: mock the libs the route imports (here: @/lib/auth) so we
// exercise the route's branching + cookie-setting + error-mapping
// logic without touching AWS. Lower-level lib tests (Phase T2) will
// mock the AWS SDK clients directly with `aws-sdk-client-mock` — at
// the route level that's needless ceremony.

const mockSignIn                   = vi.fn()
const mockSignInWithDevice         = vi.fn()
const mockSrpInit                  = vi.fn()
const mockSrpVerify                = vi.fn()
const mockRespondToMfaChallenge    = vi.fn()
const mockRespondToNewPassword     = vi.fn()
const mockConfirmAndRememberDevice = vi.fn()
const mockGetMfaSetupSecret        = vi.fn()
const mockVerifyMfaSetup           = vi.fn()
const mockCompleteMfaSetup         = vi.fn()

vi.mock('@/lib/auth', () => ({
  signIn:                   (...a: unknown[]) => mockSignIn(...a),
  signInWithDevice:         (...a: unknown[]) => mockSignInWithDevice(...a),
  srpInit:                  (...a: unknown[]) => mockSrpInit(...a),
  srpVerify:                (...a: unknown[]) => mockSrpVerify(...a),
  respondToMfaChallenge:    (...a: unknown[]) => mockRespondToMfaChallenge(...a),
  respondToNewPassword:     (...a: unknown[]) => mockRespondToNewPassword(...a),
  confirmAndRememberDevice: (...a: unknown[]) => mockConfirmAndRememberDevice(...a),
  getMfaSetupSecret:        (...a: unknown[]) => mockGetMfaSetupSecret(...a),
  verifyMfaSetup:           (...a: unknown[]) => mockVerifyMfaSetup(...a),
  completeMfaSetup:         (...a: unknown[]) => mockCompleteMfaSetup(...a),
}))

import { POST } from '../route'

// Helper — build a POST request with optional cookies. NextRequest's
// cookie API reads from the cookie header, so we set it directly.
function postReq(
  body: Record<string, unknown>,
  cookies?: Record<string, string>,
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ')
  }
  return new NextRequest('http://localhost/api/auth/signin', {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  })
}

const TOKENS = {
  accessToken:  'access-jwt',
  idToken:      'id-jwt',
  refreshToken: 'refresh-jwt',
  expiresIn:    3600,
}

function expectSessionCookiesSet(res: Response): void {
  const setCookies = res.headers.getSetCookie()
  const names = setCookies.map(c => c.split('=')[0])
  expect(names).toContain('ee_access')
  expect(names).toContain('ee_id')
  expect(names).toContain('ee_refresh')
}

beforeEach(() => {
  mockSignIn.mockReset()
  mockSignInWithDevice.mockReset()
  mockSrpInit.mockReset()
  mockSrpVerify.mockReset()
  mockRespondToMfaChallenge.mockReset()
  mockRespondToNewPassword.mockReset()
  mockConfirmAndRememberDevice.mockReset()
  mockGetMfaSetupSecret.mockReset()
  mockVerifyMfaSetup.mockReset()
  mockCompleteMfaSetup.mockReset()
})

describe('POST /api/auth/signin — credentials path', () => {
  it('issues session cookies on a clean USER_PASSWORD_AUTH success', async () => {
    mockSignIn.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
    expect(mockSignIn).toHaveBeenCalledWith('a@b.com', 'pw')
  })

  it('returns mfa challenge when SOFTWARE_TOKEN_MFA fires', async () => {
    mockSignIn.mockResolvedValueOnce({ challengeName: 'SOFTWARE_TOKEN_MFA', session: 'sess-1' })

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ challenge: 'mfa', session: 'sess-1' })
  })

  it('returns new_password challenge', async () => {
    mockSignIn.mockResolvedValueOnce({ challengeName: 'NEW_PASSWORD_REQUIRED', session: 'sess-2' })

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    const body = await res.json()
    expect(body).toEqual({ challenge: 'new_password', session: 'sess-2' })
  })

  it('returns mfa_setup challenge with the TOTP secret', async () => {
    mockSignIn.mockResolvedValueOnce({ challengeName: 'MFA_SETUP', session: 'sess-3' })
    mockGetMfaSetupSecret.mockResolvedValueOnce({ secretCode: 'JBSW...', session: 'sess-4' })

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    const body = await res.json()
    expect(body).toEqual({ challenge: 'mfa_setup', secretCode: 'JBSW...', session: 'sess-4' })
    expect(mockGetMfaSetupSecret).toHaveBeenCalledWith('sess-3')
  })
})

describe('POST /api/auth/signin — MFA verify step', () => {
  it('exchanges TOTP code + session for tokens', async () => {
    mockRespondToMfaChallenge.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(postReq({ email: 'a@b.com', code: '123456', session: 'sess' }))

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
    expect(mockRespondToMfaChallenge).toHaveBeenCalledWith('a@b.com', '123456', 'sess')
  })

  it('confirms + remembers device when trustDevice is set and Cognito returned NewDeviceMetadata', async () => {
    mockRespondToMfaChallenge.mockResolvedValueOnce({
      tokens: TOKENS,
      newDeviceMetadata: { deviceKey: 'dk', deviceGroupKey: 'dgk' },
    })
    mockConfirmAndRememberDevice.mockResolvedValueOnce({ devicePassword: 'dp' })

    const res = await POST(postReq({
      email: 'a@b.com', code: '123456', session: 'sess', trustDevice: true,
    }))

    expect(mockConfirmAndRememberDevice).toHaveBeenCalledWith(
      'access-jwt', 'dk', 'dgk', expect.any(String),
    )
    const setCookies = res.headers.getSetCookie()
    const names = setCookies.map(c => c.split('=')[0])
    expect(names).toContain('ee_device_key')
    expect(names).toContain('ee_device_group')
    expect(names).toContain('ee_device_password')
    expect(names).toContain('ee_device_user')
  })

  it('still signs in if device confirmation throws (best-effort)', async () => {
    mockRespondToMfaChallenge.mockResolvedValueOnce({
      tokens: TOKENS,
      newDeviceMetadata: { deviceKey: 'dk', deviceGroupKey: 'dgk' },
    })
    mockConfirmAndRememberDevice.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({
      email: 'a@b.com', code: '123456', session: 'sess', trustDevice: true,
    }))

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
    errSpy.mockRestore()
  })
})

describe('POST /api/auth/signin — SRP path (Phase D)', () => {
  it('srp_init relays SRP_A and returns challengeParameters', async () => {
    mockSrpInit.mockResolvedValueOnce({
      session: 'srp-sess',
      challengeParameters: { SRP_B: '...', SALT: '...' },
    })

    const res = await POST(postReq({ step: 'srp_init', email: 'a@b.com', srpA: 'A' }))

    const body = await res.json()
    expect(body).toEqual({ session: 'srp-sess', challengeParameters: { SRP_B: '...', SALT: '...' } })
    // No device cookies on this request — verify undefined was passed.
    expect(mockSrpInit).toHaveBeenCalledWith('a@b.com', 'A', undefined)
  })

  it('srp_verify with tokens result sets session cookies', async () => {
    mockSrpVerify.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(postReq({
      step: 'srp_verify', email: 'a@b.com', session: 's',
      srpA: 'A', srpSmallA: 'a',
      passwordClaimSignature: 'sig', passwordClaimSecretBlock: 'sb', timestamp: 't',
    }))

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
  })

  it('srp_verify can bubble an MFA challenge', async () => {
    mockSrpVerify.mockResolvedValueOnce({
      challengeName: 'SOFTWARE_TOKEN_MFA', session: 'mfa-sess',
    })

    const res = await POST(postReq({
      step: 'srp_verify', email: 'a@b.com', session: 's',
      srpA: 'A', srpSmallA: 'a',
      passwordClaimSignature: 'sig', passwordClaimSecretBlock: 'sb', timestamp: 't',
    }))

    expect(await res.json()).toEqual({ challenge: 'mfa', session: 'mfa-sess' })
  })

  it('srp_verify rejects an unexpected challenge with 400', async () => {
    mockSrpVerify.mockResolvedValueOnce({ challengeName: 'CUSTOM_CHALLENGE' })

    const res = await POST(postReq({
      step: 'srp_verify', email: 'a@b.com', session: 's',
      srpA: 'A', srpSmallA: 'a',
      passwordClaimSignature: 'sig', passwordClaimSecretBlock: 'sb', timestamp: 't',
    }))

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/signin — device-trusted path (Phase A)', () => {
  const DEVICE_COOKIES = {
    ee_device_key:      'dk',
    ee_device_group:    'dgk',
    ee_device_password: 'dp',
    ee_device_user:     'a@b.com',
  }

  it('skips MFA when device cookies are present and the device flow succeeds', async () => {
    mockSignInWithDevice.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(
      postReq({ email: 'a@b.com', password: 'pw' }, DEVICE_COOKIES),
    )

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
    expect(mockSignInWithDevice).toHaveBeenCalledWith('a@b.com', 'pw', 'dk', 'dgk', 'dp')
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('falls back to plain signIn when device flow throws (stale devicePassword)', async () => {
    mockSignInWithDevice.mockRejectedValueOnce(new Error('SRP fail'))
    mockSignIn.mockResolvedValueOnce({ tokens: TOKENS })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(
      postReq({ email: 'a@b.com', password: 'pw' }, DEVICE_COOKIES),
    )

    expect(res.status).toBe(200)
    expect(mockSignIn).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('falls through to MFA prompt when device flow ends in SOFTWARE_TOKEN_MFA', async () => {
    mockSignInWithDevice.mockResolvedValueOnce({
      challengeName: 'SOFTWARE_TOKEN_MFA', session: 'mfa-sess',
    })

    const res = await POST(
      postReq({ email: 'a@b.com', password: 'pw' }, DEVICE_COOKIES),
    )

    expect(await res.json()).toEqual({ challenge: 'mfa', session: 'mfa-sess' })
  })

  it('ignores device cookies bound to a different user (replay defense)', async () => {
    mockSignIn.mockResolvedValueOnce({ tokens: TOKENS })

    await POST(postReq(
      { email: 'new@user.com', password: 'pw' },
      { ...DEVICE_COOKIES, ee_device_user: 'old@user.com' },
    ))

    expect(mockSignInWithDevice).not.toHaveBeenCalled()
    expect(mockSignIn).toHaveBeenCalled()
  })

  it('ignores device cookies when any of the three are missing', async () => {
    mockSignIn.mockResolvedValueOnce({ tokens: TOKENS })

    // Missing ee_device_password
    await POST(postReq(
      { email: 'a@b.com', password: 'pw' },
      { ee_device_key: 'dk', ee_device_group: 'dgk', ee_device_user: 'a@b.com' },
    ))

    expect(mockSignInWithDevice).not.toHaveBeenCalled()
    expect(mockSignIn).toHaveBeenCalled()
  })
})

describe('POST /api/auth/signin — new_password step', () => {
  it('respondToNewPassword returns tokens', async () => {
    mockRespondToNewPassword.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(postReq({
      step: 'new_password', username: 'a@b.com', newPassword: 'newPW1!', session: 's',
    }))

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
  })

  it('respondToNewPassword bubbles MFA challenge', async () => {
    mockRespondToNewPassword.mockResolvedValueOnce({
      challengeName: 'SOFTWARE_TOKEN_MFA', session: 'mfa-sess',
    })

    const res = await POST(postReq({
      step: 'new_password', username: 'a@b.com', newPassword: 'newPW1!', session: 's',
    }))

    expect(await res.json()).toEqual({ challenge: 'mfa', session: 'mfa-sess' })
  })

  it('respondToNewPassword bubbles MFA_SETUP and surfaces secretCode', async () => {
    mockRespondToNewPassword.mockResolvedValueOnce({
      challengeName: 'MFA_SETUP', session: 'next-sess',
    })
    mockGetMfaSetupSecret.mockResolvedValueOnce({ secretCode: 'SECRET', session: 'final-sess' })

    const res = await POST(postReq({
      step: 'new_password', username: 'a@b.com', newPassword: 'newPW1!', session: 's',
    }))

    expect(await res.json()).toEqual({
      challenge: 'mfa_setup', secretCode: 'SECRET', session: 'final-sess',
    })
  })

  it('respondToNewPassword rejects unexpected challenge with 400', async () => {
    mockRespondToNewPassword.mockResolvedValueOnce({ challengeName: 'CUSTOM' })

    const res = await POST(postReq({
      step: 'new_password', username: 'a@b.com', newPassword: 'newPW1!', session: 's',
    }))

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/signin — mfa_setup_verify step', () => {
  it('completes setup and returns tokens', async () => {
    mockVerifyMfaSetup.mockResolvedValueOnce({ session: 'next-sess' })
    mockCompleteMfaSetup.mockResolvedValueOnce({ tokens: TOKENS })

    const res = await POST(postReq({
      step: 'mfa_setup_verify', session: 's', code: '123456', username: 'a@b.com',
    }))

    expect(res.status).toBe(200)
    expectSessionCookiesSet(res)
  })

  it('falls back to mfa challenge if completeMfaSetup throws', async () => {
    mockVerifyMfaSetup.mockResolvedValueOnce({ session: 'next-sess' })
    mockCompleteMfaSetup.mockRejectedValueOnce(new Error('Cognito rejected'))

    const res = await POST(postReq({
      step: 'mfa_setup_verify', session: 's', code: '123456', username: 'a@b.com',
    }))

    expect(await res.json()).toEqual({ challenge: 'mfa', session: 'next-sess' })
  })
})

describe('POST /api/auth/signin — error mapping', () => {
  // Build a Cognito-shaped error: { name, message } on a plain Error.
  function cognitoErr(name: string, message = 'message'): Error {
    const e = new Error(message)
    e.name = name
    return e
  }

  function expectErrSpyCleanup() {
    return vi.spyOn(console, 'error').mockImplementation(() => {})
  }

  it.each([
    ['NotAuthorizedException',           401, 'Incorrect email or password.'],
    ['UserNotFoundException',            401, 'Incorrect email or password.'],
    ['PasswordResetRequiredException',   401, 'Forgot password'],
    ['UserNotConfirmedException',        401, 'verify your email'],
    ['CodeMismatchException',            401, 'verification code'],
    ['ExpiredCodeException',             401, 'expired'],
    ['LimitExceededException',           429, 'Too many attempts'],
    ['TooManyRequestsException',         429, 'Too many attempts'],
  ])('maps %s to %i with a user-facing message containing %s', async (name, status, frag) => {
    const errSpy = expectErrSpyCleanup()
    mockSignIn.mockRejectedValueOnce(cognitoErr(name))

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(status)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain(frag.toLowerCase())
    errSpy.mockRestore()
  })

  it('maps InvalidPasswordException to 400 with the policy message', async () => {
    const errSpy = expectErrSpyCleanup()
    mockSignIn.mockRejectedValueOnce(cognitoErr('InvalidPasswordException', 'Password too short'))

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Password too short')
    errSpy.mockRestore()
  })

  it('falls back to a generic 401 for unknown errors', async () => {
    const errSpy = expectErrSpyCleanup()
    mockSignIn.mockRejectedValueOnce(cognitoErr('SomeUnseenError'))

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Sign in failed. Please try again.')
    errSpy.mockRestore()
  })

  it('also handles non-Error throws gracefully', async () => {
    const errSpy = expectErrSpyCleanup()
    mockSignIn.mockRejectedValueOnce('a plain string')

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(401)
    errSpy.mockRestore()
  })

  it('maps "Incorrect username or password" message text to 401', async () => {
    const errSpy = expectErrSpyCleanup()
    const e = new Error('Incorrect username or password.')
    // No `name` set — exercises the message-based branch.
    mockSignIn.mockRejectedValueOnce(e)

    const res = await POST(postReq({ email: 'a@b.com', password: 'pw' }))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Incorrect email or password.')
    errSpy.mockRestore()
  })
})
