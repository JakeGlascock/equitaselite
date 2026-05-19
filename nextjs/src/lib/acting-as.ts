import { cookies, headers } from 'next/headers'
import { queryOne } from './db'
import type { NextRequest } from 'next/server'

export const ACTING_AS_COOKIE = 'ee_acting_as'

export interface ManagedProfileLite {
  id:        string
  full_name: string
  firm_name: string
  role:      'angel' | 'family_office'
}

export interface ActingAsState {
  effectiveUserId: string                   // who we act as in queries
  actualUserId:    string                   // signed-in user
  managedProfile:  ManagedProfileLite | null // present iff actively impersonating
}

/**
 * Server-component variant — uses next/headers' cookies() + headers().
 * Returns null if the user isn't signed in. If the acting-as cookie is set
 * but the caller doesn't actually manage that profile, falls back silently
 * to the real user (no error — handles stale cookies after a revoke).
 */
export async function getActingAsState(): Promise<ActingAsState | null> {
  const h = await headers()
  const actualUserId = h.get('x-user-id')
  if (!actualUserId) return null

  const c = await cookies()
  const target = c.get(ACTING_AS_COOKIE)?.value
  if (!target) {
    return { effectiveUserId: actualUserId, actualUserId, managedProfile: null }
  }

  try {
    // Authorised if the caller manages the target (concierge flow) OR the
    // target is an is_test fixture and the caller is an admin (test-flow).
    // The OR clause is added in a try/catch fallback below — pre-032
    // environments don't have is_test and would throw.
    const profile = await queryOne<ManagedProfileLite>(
      `SELECT t.id, t.full_name, t.firm_name, t.role FROM profiles t
       WHERE t.id = $1 AND (
         t.managed_by = $2
         OR (t.is_test = TRUE
             AND EXISTS (SELECT 1 FROM profiles a WHERE a.id = $2 AND a.is_admin = TRUE))
       )`,
      [target, actualUserId]
    )
    if (!profile) {
      return { effectiveUserId: actualUserId, actualUserId, managedProfile: null }
    }
    return { effectiveUserId: profile.id, actualUserId, managedProfile: profile }
  } catch {
    // Pre-032 fallback — only the managed_by gate exists.
    try {
      const profile = await queryOne<ManagedProfileLite>(
        `SELECT id, full_name, firm_name, role FROM profiles
         WHERE id = $1 AND managed_by = $2`,
        [target, actualUserId]
      )
      if (!profile) {
        return { effectiveUserId: actualUserId, actualUserId, managedProfile: null }
      }
      return { effectiveUserId: profile.id, actualUserId, managedProfile: profile }
    } catch {
      return { effectiveUserId: actualUserId, actualUserId, managedProfile: null }
    }
  }
}

/**
 * Route-handler variant — uses req.cookies + req.headers so it works in
 * Route Handlers where next/headers' cookies() requires opt-in.
 */
export async function getEffectiveUserId(req: NextRequest): Promise<string | null> {
  const actualUserId = req.headers.get('x-user-id')
  if (!actualUserId) return null

  const target = req.cookies.get(ACTING_AS_COOKIE)?.value
  if (!target) return actualUserId

  try {
    const profile = await queryOne<{ id: string }>(
      `SELECT t.id FROM profiles t
       WHERE t.id = $1 AND (
         t.managed_by = $2
         OR (t.is_test = TRUE
             AND EXISTS (SELECT 1 FROM profiles a WHERE a.id = $2 AND a.is_admin = TRUE))
       )`,
      [target, actualUserId]
    )
    return profile ? profile.id : actualUserId
  } catch {
    try {
      const profile = await queryOne<{ id: string }>(
        'SELECT id FROM profiles WHERE id = $1 AND managed_by = $2',
        [target, actualUserId]
      )
      return profile ? profile.id : actualUserId
    } catch {
      return actualUserId
    }
  }
}
