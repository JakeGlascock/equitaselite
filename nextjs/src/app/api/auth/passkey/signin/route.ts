import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { passkeySigninInit, passkeySigninVerify, type AuthTokens } from '@/lib/auth'

const SECURE = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   SECURE,
  sameSite: 'lax' as const,
  path:     '/',
}

const InitSchema = z.object({
  step:  z.literal('init'),
  email: z.string().email(),
})

const VerifySchema = z.object({
  step:       z.literal('verify'),
  email:      z.string().email(),
  session:    z.string(),
  credential: z.unknown(),
})

// Passkey-only signin path. Unauth (the WebAuthn ceremony IS the auth).
//   POST { step: 'init',   email }
//     → { session, challengeParameters: { CREDENTIAL_REQUEST_OPTIONS, ... } }
//   POST { step: 'verify', email, session, credential }
//     → { ok: true } + session cookies
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.step === 'init') {
      const parsed = InitSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
      const { session, challengeParameters } = await passkeySigninInit(parsed.data.email)
      return NextResponse.json({ session, challengeParameters })
    }

    if (body.step === 'verify') {
      const parsed = VerifySchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      const { tokens } = await passkeySigninVerify(parsed.data.email, parsed.data.session, parsed.data.credential)
      return tokenResponse(tokens)
    }

    return NextResponse.json({ error: 'Unknown step' }, { status: 400 })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[passkey-signin] ${name}: ${msg}`)
    // Cognito's WEB_AUTHN errors are not enumerable to "wrong email" vs
    // "no passkey" — both surface as NotAuthorizedException. Show a
    // generic message to avoid revealing which.
    if (name === 'NotAuthorizedException') {
      return NextResponse.json({ error: 'Passkey signin failed. Try email + password instead.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Passkey signin failed.' }, { status: 401 })
  }
}

function tokenResponse(tokens: AuthTokens) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('ee_access',  tokens.accessToken,  { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_id',      tokens.idToken,      { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_refresh', tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 30 * 24 * 3600 })
  return res
}
