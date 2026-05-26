import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { PREVIEW_COOKIE_NAME, isDemoProfileId } from '@/lib/preview'

const POOL_ID = process.env.COGNITO_USER_POOL_ID
const REGION  = process.env.AWS_REGION ?? 'us-east-1'
const ISSUER  = POOL_ID
  ? `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`
  : null

// Lazy JWKS fetch; jose caches the key set automatically
const JWKS = ISSUER
  ? createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))
  : null

const PUBLIC_PREFIXES = ['/_next/', '/favicon.ico', '/logo.png', '/fonts/', '/preview/', '/deck/', '/try/', '/.well-known/']
const PUBLIC_EXACT    = ['/', '/signin', '/forgot-password', '/pricing', '/request-access', '/unsubscribe', '/privacy', '/terms', '/preview-denied', '/deck-denied', '/try', '/robots.txt', '/sitemap.xml']
// Note: `/api/auth/` is NOT a public prefix because the passkey
// management endpoints (register/start, register/complete, list, [id])
// live under `/api/auth/passkey/...` and DO require the middleware
// to set x-user-id from the JWT. Public entries listed explicitly.
const PUBLIC_API      = [
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/refresh',
  '/api/auth/session',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/passkey/signin',  // The passkey signin flow IS the auth — no JWT yet.
  '/api/health',
  '/api/request-access',
  '/api/unsubscribe',
  '/api/preview/',
  '/api/feedback/',
  '/api/demo/',
]

// Exported so the auth-gate test suite can assert which paths are reachable
// without a Cognito session. If you add a new public route, add it to the
// matching list above AND extend the test.
export function isPublic(pathname: string): boolean {
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

  // No Cognito session — try the investor-preview cookie before redirecting.
  // The cookie value is the demo profile id (validated start-with prefix +
  // length cap). If present, thread it through as x-user-id but block any
  // mutating API call so previewers can browse but not edit shared state.
  if (!idToken) {
    const previewId = req.cookies.get(PREVIEW_COOKIE_NAME)?.value
    if (isDemoProfileId(previewId)) {
      // Mutation gate. Preview visitors are explicitly read-only.
      if (req.method !== 'GET' && req.method !== 'HEAD' && pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Preview mode — sign up for an account to send.' },
          { status: 403 },
        )
      }
      const headers = new Headers(req.headers)
      headers.set('x-user-id', previewId)
      headers.set('x-preview-mode', '1')
      return NextResponse.next({ request: { headers } })
    }
    // Try silent refresh before sending the user back to /signin. Covers
    // the common case where a browser tab sits idle past the 1-hour ID
    // token expiry but the user still has a valid 30-day refresh token.
    const refreshed = await tryRefresh(req)
    if (refreshed) return refreshed
    return redirectToLogin(req)
  }

  try {
    const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER })
    const headers = new Headers(req.headers)
    headers.set('x-user-id', payload.sub!)
    if (typeof payload.email === 'string') headers.set('x-user-email', payload.email)
    return NextResponse.next({ request: { headers } })
  } catch {
    // ID token failed verification (most often: expired). Try silent
    // refresh — same path as the missing-cookie branch above.
    const refreshed = await tryRefresh(req)
    if (refreshed) return refreshed
    return redirectToLogin(req)
  }
}

// Silent re-issue of the ID + access cookies using the 30-day refresh
// token. Returns a NextResponse that lets the original request through
// with the new cookies attached, or null on any failure (in which case
// the caller redirects to /signin).
//
// Middleware runs in the edge runtime where the AWS SDK isn't loadable,
// so we delegate to /api/auth/refresh (which runs in node and owns the
// Cognito SDK call) via internal fetch. The refresh route sets two
// Set-Cookie headers (ee_id, ee_access) which we forward verbatim, and
// we also parse the new ee_id out of the Set-Cookie so we can verify
// the JWT and thread x-user-id into the downstream request — otherwise
// the page sees the new cookies but no x-user-id header.
async function tryRefresh(req: NextRequest): Promise<NextResponse | null> {
  const refreshToken = req.cookies.get('ee_refresh')?.value
  if (!refreshToken || !JWKS || !ISSUER) return null

  try {
    const refreshUrl = new URL('/api/auth/refresh', req.url)
    const refreshRes = await fetch(refreshUrl, {
      method:  'POST',
      headers: { cookie: `ee_refresh=${refreshToken}` },
    })
    if (!refreshRes.ok) return null

    const setCookies = refreshRes.headers.getSetCookie()
    let newIdToken: string | null = null
    for (const c of setCookies) {
      if (c.startsWith('ee_id=')) {
        const end = c.indexOf(';', 6)
        newIdToken = c.substring(6, end === -1 ? c.length : end)
        break
      }
    }
    if (!newIdToken) return null

    const { payload } = await jwtVerify(newIdToken, JWKS, { issuer: ISSUER })
    const headers = new Headers(req.headers)
    headers.set('x-user-id', payload.sub!)
    if (typeof payload.email === 'string') headers.set('x-user-email', payload.email)

    const response = NextResponse.next({ request: { headers } })
    for (const cookie of setCookies) {
      response.headers.append('set-cookie', cookie)
    }
    return response
  } catch {
    return null
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
