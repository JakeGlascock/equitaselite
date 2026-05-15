import { randomBytes } from 'crypto'

// Cookie name set by /preview/[token] after a valid token is accepted.
// Middleware reads this to thread an x-user-id header through to the
// (app) layout without a Cognito session. Value is the demo profile id
// (must start with 'demo_' — middleware enforces).
export const PREVIEW_COOKIE_NAME = 'ee_preview'

// 1 hour. Long enough for an investor demo session, short enough to
// limit blast radius if the cookie leaks. The token itself enforces
// total-uses + absolute expiry; the cookie just remembers the chosen
// demo profile across page loads in one session.
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export interface ValidationResult {
  ok:           boolean
  reason?:      'not_found' | 'revoked' | 'expired' | 'exhausted'
  demoProfileId?: string
}

// Pure logic — given a candidate row (or null) and current time, decide
// whether the token is usable. Kept separate from the DB call so the
// branches are unit-testable without a Postgres instance.
export function validateTokenRow(
  row: { demo_profile_id: string; expires_at: Date | string; max_views: number; view_count: number; revoked_at: Date | string | null } | null,
  now: Date = new Date(),
): ValidationResult {
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.revoked_at) return { ok: false, reason: 'revoked' }
  const expires = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)
  if (expires.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  if (row.view_count >= row.max_views)    return { ok: false, reason: 'exhausted' }
  return { ok: true, demoProfileId: row.demo_profile_id }
}

// Is the value attached to ee_preview a plausible demo profile id?
// Belt-and-braces — the cookie is set by us so it should always be
// demo_*, but if it's tampered we refuse to honor it.
export function isDemoProfileId(id: string | undefined | null): id is string {
  return typeof id === 'string' && id.startsWith('demo_') && id.length <= 120
}
