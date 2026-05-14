import { NextRequest, NextResponse } from 'next/server'
import {
  signIn,
  respondToMfaChallenge,
  respondToNewPassword,
  getMfaSetupSecret,
  verifyMfaSetup,
  type AuthTokens,
} from '@/lib/auth'

const SECURE = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   SECURE,
  sameSite: 'lax' as const,
  path:     '/',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // New-password step: { step, username, newPassword, session }
    if (body.step === 'new_password') {
      const result = await respondToNewPassword(body.username, body.newPassword, body.session)
      if (result.tokens) return tokenResponse(result.tokens)
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
    // After the authenticator is paired (VerifySoftwareToken), Cognito still
    // wants a SOFTWARE_TOKEN_MFA challenge response to finish the original
    // sign-in. We chain that call here using the same TOTP code (still valid
    // in its 30s window) so the user isn't prompted a second time. If the
    // chain fails (clock skew, code at edge of window, etc.), fall back to
    // the normal MFA prompt.
    if (body.step === 'mfa_setup_verify') {
      const { session: nextSession } = await verifyMfaSetup(body.session, body.code)
      try {
        const tokens = await respondToMfaChallenge(body.username, body.code, nextSession)
        return tokenResponse(tokens)
      } catch {
        return NextResponse.json({ challenge: 'mfa', session: nextSession })
      }
    }

    // MFA step (backward compat): { email, code, session }
    if (body.session) {
      const tokens = await respondToMfaChallenge(body.email, body.code, body.session)
      return tokenResponse(tokens)
    }

    // Credentials step: { email, password }
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

    return tokenResponse(result.tokens!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

function tokenResponse(tokens: AuthTokens) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('ee_access',  tokens.accessToken,  { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_id',      tokens.idToken,      { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_refresh', tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 30 * 24 * 3600 })
  return res
}
