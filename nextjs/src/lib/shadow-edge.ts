import { NextResponse, type NextRequest } from 'next/server'

// P5b/P5e — edge-safe slice of the shadow lib.
//
// Why this exists: `middleware.ts` runs in the Next.js EDGE runtime,
// which cannot load Node-only packages (`pg`, anything pulling in
// `net`, `crypto.createHash` of the Node flavour, etc.). The full
// `@/lib/shadow` module imports `./db` (pg), so a transitive import
// from middleware would bundle pg into the edge worker, which fails
// at instantiation and makes every request return 500 — including
// /api/health, which then trips the ALB health-check and ECS
// circuit-breaks the deployment back to the previous task definition.
// (Exactly that silent rollback was happening from 2026-05-27 P5b
// onward, masquerading as "deploy succeeded" for two days.)
//
// This file holds the constants + `applyShadowGate` pure function
// that middleware needs, with ZERO db / Node-API dependencies.
// `lib/shadow.ts` re-exports from here so existing consumers keep
// importing from `@/lib/shadow` and pick up these names transparently.

export const SHADOW_COOKIE = 'ee_shadow_parent'

/** Set on enable, cleared on disable. 8h matches the acting-as cookie
 *  cadence — long enough for a working session, short enough that a
 *  forgotten enable doesn't shadow indefinitely. */
export const SHADOW_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60

// Paths the next-gen can hit even while a shadow cookie is active.
// Anything else with a mutating HTTP method is hard-403'd by the
// shadow gate below. The list intentionally stays tiny — exit + auth
// upkeep only. POST /api/me/shadow is allowed so a stale cookie can
// be refreshed; the route itself rechecks parent_profile_id.
export const SHADOW_WRITE_ALLOWLIST = [
  '/api/me/shadow',
  '/api/auth/signout',
  '/api/auth/refresh',
]

// P5e — parameterized routes the next-gen can additionally hit while
// shadowing. Patterns anchor with ^ and $ so a lookalike like
// `/api/deals/X/messages/extra` is still blocked. Two product calls
// landed here: comment on deal threads, RSVP to events.
//
// Important: these patterns are allowlist-only at the middleware tier.
// The routes themselves are responsible for:
//   - checking the parent's authorization (not the next-gen's), since
//     the action is "on behalf of" the parent,
//   - writing user_id = the actual next-gen,
//   - capturing shadowed_parent_id for attribution,
//   - fan-out notifications including a parent-audit entry.
export const SHADOW_WRITE_ALLOWLIST_PATTERNS: RegExp[] = [
  /^\/api\/deals\/[^/]+\/messages$/,
  /^\/api\/events\/[^/]+\/rsvp$/,
]

/**
 * Edge-runtime mutation gate. Called from middleware after the JWT
 * has been verified. Returns:
 *   - a 403 NextResponse if the request is a mutating call to a
 *     non-allowlisted route while the shadow cookie is set,
 *   - null otherwise (caller continues with the request).
 *
 * On every non-null cookie path it also sets `x-shadow-mode=1` on the
 * passed headers so downstream pages can render the banner without a
 * fresh DB lookup.
 *
 * The cookie VALUE is intentionally NOT validated here — middleware
 * runs in the edge runtime with no DB access. Validation happens at
 * the route layer (getShadowState) for reads; this gate's contract
 * is "if the cookie is set, writes are blocked." That's a strict
 * superset of what the user could ever validly do while shadowing,
 * so a stale cookie can't be used to escalate.
 */
export function applyShadowGate(
  req:      NextRequest,
  headers:  Headers,
  pathname: string,
): NextResponse | null {
  if (!req.cookies.get(SHADOW_COOKIE)?.value) return null
  headers.set('x-shadow-mode', '1')
  const isMutating = req.method !== 'GET' && req.method !== 'HEAD'
  if (!isMutating) return null
  if (!pathname.startsWith('/api/')) return null
  const isAllowed =
       SHADOW_WRITE_ALLOWLIST.some(p => pathname === p || pathname.startsWith(p + '/'))
    || SHADOW_WRITE_ALLOWLIST_PATTERNS.some(re => re.test(pathname))
  if (isAllowed) return null
  return NextResponse.json(
    { error: 'Read-only while viewing as your parent seat. Exit shadow view to make changes.' },
    { status: 403 },
  )
}
