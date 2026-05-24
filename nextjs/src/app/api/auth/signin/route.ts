import { NextRequest, NextResponse } from 'next/server'
import {
  signIn,
  signInWithDevice,
  srpInit,
  srpVerify,
  respondToMfaChallenge,
  respondToNewPassword,
  confirmAndRememberDevice,
  getMfaSetupSecret,
  verifyMfaSetup,
  completeMfaSetup,
  type AuthTokens,
  type DeviceMetadata,
} from '@/lib/auth'

const SECURE = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   SECURE,
  sameSite: 'lax' as const,
  path:     '/',
}

// 30-day device-trust window. After this, the device cookies expire and
// the user re-pairs through normal MFA. Picked to match Cognito's
// refresh-token validity so the two horizons collapse cleanly.
const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 3600

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // New-password step: { step, username, newPassword, session }
    if (body.step === 'new_password') {
      const result = await respondToNewPassword(body.username, body.newPassword, body.session)
      if (result.tokens) return tokenResponse(result.tokens, undefined, result.newDeviceMetadata)
      if (result.challengeName === 'MFA_SETUP') {
        const { secretCode, session } = await getMfaSetupSecret(result.session!)
        return NextResponse.json({ challenge: 'mfa_setup', secretCode, session })
      }
      if (result.challengeName === 'SOFTWARE_TOKEN_MFA') {
        return NextResponse.json({ challenge: 'mfa', session: result.session })
      }
      return NextResponse.json({ error: `Unexpected challenge: ${result.challengeName}` }, { status: 400 })
    }

    // MFA-setup verification step: { step, session, code, username }
    // After the authenticator is paired (VerifySoftwareToken), call
    // RespondToAuthChallenge with ChallengeName='MFA_SETUP' (NOT
    // SOFTWARE_TOKEN_MFA) to finish the original sign-in. The verification
    // state is carried by the session from VerifySoftwareToken — no new
    // TOTP code needed. The previous implementation re-sent the just-used
    // code under SOFTWARE_TOKEN_MFA, which Cognito frequently rejected,
    // triggering the second-prompt fallback. We still keep that fallback
    // as a defensive backstop.
    if (body.step === 'mfa_setup_verify') {
      const { session: nextSession } = await verifyMfaSetup(body.session, body.code)
      try {
        const completed = await completeMfaSetup(body.username, nextSession)
        return tokenResponse(completed.tokens, body.trustDevice ? body.username : undefined, completed.newDeviceMetadata)
      } catch {
        return NextResponse.json({ challenge: 'mfa', session: nextSession })
      }
    }

    // Client-side SRP — init step (Phase D).
    // Body: { step: 'srp_init', email, srpA }
    // The client has already done createSrpSession() locally; we
    // just relay SRP_A to Cognito's USER_SRP_AUTH flow and bubble
    // back the PASSWORD_VERIFIER challenge parameters.
    if (body.step === 'srp_init') {
      const deviceCookies = readDeviceCookies(req, body.email)
      const { session, challengeParameters } = await srpInit(
        body.email,
        body.srpA,
        deviceCookies?.deviceKey,
      )
      return NextResponse.json({ session, challengeParameters })
    }

    // Client-side SRP — verify step (Phase D).
    // Body: { step: 'srp_verify', email, session, srpA, srpSmallA,
    //         passwordClaimSignature, passwordClaimSecretBlock,
    //         timestamp, trustDevice }
    // The client computed the password proof from the challenge
    // parameters returned by srp_init. We forward it to Cognito.
    // If the user has a confirmed device, the same SRP ephemeral
    // (smallA/largeA/timestamp) is used to finish the device-SRP
    // dance server-side using the cookie-stored device password.
    if (body.step === 'srp_verify') {
      const deviceCookies = readDeviceCookies(req, body.email)
      const result = await srpVerify(
        body.email,
        body.session,
        {
          signature:   body.passwordClaimSignature,
          secretBlock: body.passwordClaimSecretBlock,
          timestamp:   body.timestamp,
          largeA:      body.srpA,
          smallA:      body.srpSmallA,
        },
        deviceCookies?.deviceKey,
        deviceCookies?.deviceGroupKey,
        deviceCookies?.devicePassword,
      )
      if (result.tokens) return tokenResponse(result.tokens, undefined, result.newDeviceMetadata)
      if (result.challengeName === 'SOFTWARE_TOKEN_MFA') {
        return NextResponse.json({ challenge: 'mfa', session: result.session })
      }
      if (result.challengeName === 'MFA_SETUP') {
        const { secretCode, session } = await getMfaSetupSecret(result.session!)
        return NextResponse.json({ challenge: 'mfa_setup', secretCode, session })
      }
      if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
        return NextResponse.json({ challenge: 'new_password', session: result.session })
      }
      return NextResponse.json({ error: `Unexpected challenge: ${result.challengeName}` }, { status: 400 })
    }

    // MFA step (backward compat): { email, code, session, trustDevice }
    if (body.session) {
      const mfa = await respondToMfaChallenge(body.email, body.code, body.session)
      return tokenResponse(mfa.tokens, body.trustDevice ? body.email : undefined, mfa.newDeviceMetadata)
    }

    // Credentials step: { email, password }. If the client already has
    // a confirmed device for this user, route through the device-trusted
    // SRP flow which skips MFA entirely.
    const deviceCookies = readDeviceCookies(req, body.email)
    if (deviceCookies) {
      try {
        const result = await signInWithDevice(
          body.email,
          body.password,
          deviceCookies.deviceKey,
          deviceCookies.deviceGroupKey,
          deviceCookies.devicePassword,
        )
        if (result.tokens) {
          // No MFA challenge fired — pure device-trusted success.
          return tokenResponse(result.tokens)
        }
        // Device flow ended in MFA (server forgot the device, key
        // rotation, etc.) — fall through to the standard challenge UI.
        if (result.challengeName === 'SOFTWARE_TOKEN_MFA') {
          return NextResponse.json({ challenge: 'mfa', session: result.session })
        }
      } catch (err) {
        // Any device-flow failure (e.g. devicePassword stale) falls
        // back to plain USER_PASSWORD_AUTH below so a single stuck
        // device doesn't lock the user out — but log so a real
        // regression in the SRP code is visible in CloudWatch
        // instead of hiding behind the MFA fallback path.
        console.error('[signin] device-trust flow failed, falling back to USER_PASSWORD_AUTH', err)
      }
    }

    const result = await signIn(body.email, body.password)

    if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
      return NextResponse.json({ challenge: 'new_password', session: result.session })
    }
    if (result.challengeName === 'SOFTWARE_TOKEN_MFA') {
      return NextResponse.json({ challenge: 'mfa', session: result.session })
    }
    if (result.challengeName === 'MFA_SETUP') {
      const { secretCode, session } = await getMfaSetupSecret(result.session!)
      return NextResponse.json({ challenge: 'mfa_setup', secretCode, session })
    }

    return tokenResponse(result.tokens!, undefined, result.newDeviceMetadata)
  } catch (err: unknown) {
    // Log every failure with its name + message so CloudWatch surfaces
    // which class of error fired (SRP lib internals, Cognito rejection,
    // schema error, etc.) — userFacingError below intentionally hides
    // detail from the user.
    const name = (err as { name?: string })?.name ?? 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[signin] ${name}: ${msg}`)
    const { message, status } = userFacingError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

// Map AWS/Cognito error names to short user-facing strings. Server-side
// jargon (e.g. "Cognito SRP init did not return a session") never reaches
// the signin form. Anything we don't recognise falls back to a generic
// "Sign in failed" — surface details to CloudWatch via the calling code's
// own logging if needed.
function userFacingError(err: unknown): { message: string; status: number } {
  if (err instanceof Error) {
    const name = (err as { name?: string }).name ?? ''
    const msg  = err.message ?? ''
    if (name === 'NotAuthorizedException' ||
        name === 'UserNotFoundException'  ||
        msg.includes('Incorrect username or password')) {
      return { message: 'Incorrect email or password.', status: 401 }
    }
    if (name === 'PasswordResetRequiredException') {
      return { message: 'Your password needs to be reset — use "Forgot password" below.', status: 401 }
    }
    if (name === 'UserNotConfirmedException') {
      return { message: 'Please verify your email before signing in.', status: 401 }
    }
    if (name === 'CodeMismatchException') {
      return { message: 'Incorrect verification code.', status: 401 }
    }
    if (name === 'ExpiredCodeException') {
      return { message: 'Verification code expired. Request a new one.', status: 401 }
    }
    if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
      return { message: 'Too many attempts. Please wait a moment and try again.', status: 429 }
    }
    if (name === 'InvalidPasswordException') {
      return { message: msg || 'Password does not meet the policy requirements.', status: 400 }
    }
  }
  return { message: 'Sign in failed. Please try again.', status: 401 }
}

// Read the three device cookies (key + group key + password) along with
// the bound email. Returns null if any are missing or if the cookies
// were issued for a different user — a stale device cookie set for the
// previous user must not be replayed against a new account.
function readDeviceCookies(req: NextRequest, email: string): {
  deviceKey: string
  deviceGroupKey: string
  devicePassword: string
} | null {
  const deviceKey       = req.cookies.get('ee_device_key')?.value
  const deviceGroupKey  = req.cookies.get('ee_device_group')?.value
  const devicePassword  = req.cookies.get('ee_device_password')?.value
  const deviceUser      = req.cookies.get('ee_device_user')?.value
  if (!deviceKey || !deviceGroupKey || !devicePassword || !deviceUser) return null
  if (deviceUser.toLowerCase() !== email.toLowerCase())                return null
  return { deviceKey, deviceGroupKey, devicePassword }
}

// Final response writer. Sets the standard session cookies and — if the
// caller passed `trustEmail` and Cognito returned NewDeviceMetadata —
// also calls ConfirmDevice + UpdateDeviceStatus and bakes the device
// cookies. trustEmail is only set when the user ticked "Trust this
// device" during MFA.
async function tokenResponse(
  tokens: AuthTokens,
  trustEmail?: string,
  meta?:       DeviceMetadata,
) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('ee_access',  tokens.accessToken,  { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_id',      tokens.idToken,      { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_refresh', tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 30 * 24 * 3600 })

  if (trustEmail && meta) {
    try {
      const { devicePassword } = await confirmAndRememberDevice(
        tokens.accessToken,
        meta.deviceKey,
        meta.deviceGroupKey,
        deviceLabel(),
      )
      res.cookies.set('ee_device_key',      meta.deviceKey,      { ...COOKIE_OPTS, maxAge: DEVICE_COOKIE_MAX_AGE })
      res.cookies.set('ee_device_group',    meta.deviceGroupKey, { ...COOKIE_OPTS, maxAge: DEVICE_COOKIE_MAX_AGE })
      res.cookies.set('ee_device_password', devicePassword,      { ...COOKIE_OPTS, maxAge: DEVICE_COOKIE_MAX_AGE })
      res.cookies.set('ee_device_user',     trustEmail,          { ...COOKIE_OPTS, maxAge: DEVICE_COOKIE_MAX_AGE })
    } catch (err) {
      // Device confirmation failing is non-fatal — user is signed in
      // either way, they'll just see MFA again next time. Log so we
      // notice if the SRP code regresses.
      console.error('[auth] confirm-device failed', err)
    }
  }
  return res
}

function deviceLabel(): string {
  // Cognito stores this as the human-friendly device name in the user
  // pool. Fixed string for now; future: derive from User-Agent.
  return 'Equitas Elite trusted device'
}
