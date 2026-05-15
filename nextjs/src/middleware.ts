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

const PUBLIC_PREFIXES = ['/_next/', '/favicon.ico', '/logo.png', '/preview/']
const PUBLIC_EXACT    = ['/', '/signin', '/pricing', '/request-access', '/unsubscribe', '/privacy', '/preview-denied']
const PUBLIC_API      = ['/api/auth/', '/api/health', '/api/request-access', '/api/unsubscribe', '/api/preview/']

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
    return redirectToLogin(req)
  }

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
