import { NextRequest, NextResponse } from 'next/server'
import { refreshTokens } from '@/lib/auth'

const SECURE = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   SECURE,
  sameSite: 'lax' as const,
  path:     '/',
}

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('ee_refresh')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  try {
    const tokens = await refreshTokens(refreshToken)
    const res = NextResponse.json({ ok: true })
    res.cookies.set('ee_access', tokens.accessToken, { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
    res.cookies.set('ee_id',     tokens.idToken,     { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
    // Refresh token itself is not rotated by Cognito by default
    return res
  } catch {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }
}
