import { NextRequest, NextResponse } from 'next/server'
import { signIn, respondToMfaChallenge, type AuthTokens } from '@/lib/auth'

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

    // MFA step: { email, code, session }
    if (body.session) {
      const tokens = await respondToMfaChallenge(body.email, body.code, body.session)
      return tokenResponse(tokens)
    }

    // Credentials step: { email, password }
    const result = await signIn(body.email, body.password)

    if (result.challengeName === 'SOFTWARE_TOKEN_MFA') {
      return NextResponse.json({ challenge: 'mfa', session: result.session })
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
