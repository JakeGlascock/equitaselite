import { cookies, headers } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { queryOne } from './db'

// P5b — Next-Gen shadow view. A next-gen seat (Phase E role flag,
// migration 035) can elect to "view as" their linked parent seat
// (migration 043). The shadow lasts the lifetime of a single cookie,
// is server-validated on every request, and is read-only end-to-end:
// the middleware hard-blocks any mutating HTTP method while the cookie
// is set (see src/middleware.ts), independent of route-level checks.
//
// Why a cookie rather than a query-string flag:
//   - Survives navigations / page refreshes without explicit threading.
//   - HttpOnly, so a malicious script in the page can't enable shadow
//     mode on the user's behalf (cookie is set via POST /api/me/shadow,
//     which requires same-origin + the live session cookie).
//   - Mirrors the existing ACTING_AS_COOKIE shape so future ops can
//     reason about both impersonation mechanisms identically.
//
// IMPORTANT: shadow mode is NOT impersonation. The next-gen's
// notifications, mutations, and identity ALL stay anchored on their
// own profile. Only specific READ surfaces (dashboard / deals /
// connections / match) pivot to show the parent's data. Mutation
// blocking happens in middleware so a missed pivot can't become a
// privilege-escalation bug.

export const SHADOW_COOKIE = 'ee_shadow_parent'

/** Set on enable, cleared on disable. 8h matches the acting-as cookie
 *  cadence — long enough for a working session, short enough that a
 *  forgotten enable doesn't shadow indefinitely. */
export const SHADOW_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60

export interface ParentProfileLite {
  id:        string
  full_name: string
  firm_name: string
}

export interface ShadowState {
  /** The signed-in next-gen viewing the parent's data. */
  actualUserId:   string
  /** The parent seat being shadowed. Read paths substitute this for
   *  actualUserId; mutation paths are blocked by middleware. */
  parentId:       string
  parentProfile:  ParentProfileLite
}

/**
 * Server-component variant. Returns null when:
 *  - the user isn't signed in,
 *  - no shadow cookie is set,
 *  - the cookie is set but the viewer's parent_profile_id doesn't
 *    match the cookie's value (stale cookie after revoke).
 *
 * Stale cookies fall through silently — the page sees null (no shadow)
 * and renders the next-gen's own data. The cookie stays on the browser
 * until DELETE /api/me/shadow is called or it expires; this is fine
 * because middleware also keys off cookie presence to block mutations,
 * so a stale cookie can't be exploited.
 *
 * Both DB lookups (the cookie target + the parent join) are wrapped
 * in try/catch so /family + /dashboard still render on pre-043
 * environments — they just see "no shadow available."
 */
export async function getShadowState(): Promise<ShadowState | null> {
  const h = await headers()
  const actualUserId = h.get('x-user-id')
  if (!actualUserId) return null

  const c = await cookies()
  const cookieParentId = c.get(SHADOW_COOKIE)?.value
  if (!cookieParentId) return null

  // Single query: confirm me.parent_profile_id === cookie value AND
  // load the parent's display fields in one round trip. If the join
  // returns no row (stale cookie), shadow is silently inactive.
  const row = await queryOne<ParentProfileLite>(
    `SELECT p.id, p.full_name, p.firm_name
       FROM profiles me
       JOIN profiles p ON p.id = me.parent_profile_id
      WHERE me.id = $1 AND p.id = $2`,
    [actualUserId, cookieParentId],
  ).catch(() => null)

  if (!row) return null
  return { actualUserId, parentId: row.id, parentProfile: row }
}

/**
 * Convenience: returns the parent id if a valid shadow is active,
 * otherwise the next-gen's own id. Use in read paths that want to
 * pivot transparently. Never substitute on a write path — the
 * middleware blocks writes outright, but in defense-in-depth, the
 * lib intentionally has no write-side equivalent.
 */
export async function getEffectiveReadUserId(fallback: string): Promise<string> {
  const s = await getShadowState()
  return s?.parentId ?? fallback
}

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
  const isAllowed = SHADOW_WRITE_ALLOWLIST.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isAllowed) return null
  return NextResponse.json(
    { error: 'Read-only while viewing as your parent seat. Exit shadow view to make changes.' },
    { status: 403 },
  )
}
