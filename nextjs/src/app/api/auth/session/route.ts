import { NextRequest, NextResponse } from 'next/server'
import type { AuthTokens } from '@/lib/auth'

const SECURE = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   SECURE,
  sameSite: 'lax' as const,
  path:     '/',
}

export async function POST(req: NextRequest) {
  const tokens: AuthTokens = await req.json()

  const res = NextResponse.json({ ok: true })

  res.cookies.set('ee_access',  tokens.accessToken,  { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_id',      tokens.idToken,      { ...COOKIE_OPTS, maxAge: tokens.expiresIn })
  res.cookies.set('ee_refresh', tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 30 * 24 * 3600 })

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('ee_access')
  res.cookies.delete('ee_id')
  res.cookies.delete('ee_refresh')
  return res
}
