import { cookies } from 'next/headers'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const POOL_ID = process.env.COGNITO_USER_POOL_ID
const REGION  = process.env.AWS_REGION ?? 'us-east-1'
const ISSUER  = POOL_ID
  ? `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`
  : null

// JWKS is shared across requests; jose caches the key set.
const JWKS = ISSUER
  ? createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))
  : null

// Best-effort user-id resolution for public pages.
//
// Middleware skips JWT verification on routes in PUBLIC_EXACT (/pricing,
// /privacy, etc.) to save the JWKS round-trip, which means those pages
// see x-user-id = null even when the visitor is signed in. For pages
// that should behave differently per auth state (e.g. /pricing's "Back
// to dashboard" vs "Back to sign in" link, current-plan badge), call
// tryGetUserId() to decode the ee_id cookie ourselves.
//
// Returns the Cognito sub on a valid session, null otherwise. Never
// throws — designed to be called optimistically.
export async function tryGetUserId(): Promise<string | null> {
  if (!JWKS || !ISSUER) return null
  const jar = await cookies()
  const idToken = jar.get('ee_id')?.value
  if (!idToken) return null
  try {
    const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER })
    return payload.sub ?? null
  } catch {
    return null
  }
}
