import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const POOL_ID = process.env.COGNITO_USER_POOL_ID
const REGION  = process.env.AWS_REGION ?? 'us-east-1'
const ISSUER  = POOL_ID
  ? `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`
  : null

// Lazy JWKS fetch; jose caches the key set automatically
const JWKS = ISSUER
  ? createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))
  : null

const PUBLIC_PREFIXES = ['/_next/', '/favicon.ico', '/logo.png']
const PUBLIC_EXACT    = ['/', '/signin', '/pricing']
const PUBLIC_API      = ['/api/auth/', '/api/health']

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname))                   return true
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true
  if (PUBLIC_API.some(p => pathname.startsWith(p)))      return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // If Cognito is not configured (local dev without .env.local), skip auth
  if (!JWKS || !ISSUER) return NextResponse.next()

  const idToken = req.cookies.get('ee_id')?.value
  if (!idToken) return redirectToLogin(req)

  try {
    const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER })
    const headers = new Headers(req.headers)
    headers.set('x-user-id', payload.sub!)
    if (typeof payload.email === 'string') headers.set('x-user-email', payload.email)
    return NextResponse.next({ request: { headers } })
  } catch {
    return redirectToLogin(req)
  }
}

function redirectToLogin(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL('/signin', req.url))
  res.cookies.delete('ee_id')
  res.cookies.delete('ee_access')
  res.cookies.delete('ee_refresh')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
