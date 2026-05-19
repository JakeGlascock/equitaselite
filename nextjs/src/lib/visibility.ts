import { queryOne } from './db'

// Visibility predicate for Off-Market profiles.
//
// A profile P is visible to a viewer V iff ANY of:
//   - V is P (self)
//   - P is not off-market
//   - V is P's assigned RM (P.relationship_manager_id === V.id)
//   - V is an admin
//   - V and P are connected via an accepted introduction (either direction)
//
// Demo profiles + preview viewers are out of scope here — the
// preview-cookie path is gated separately in middleware + matches.ts
// and never reaches profiles flagged is_off_market = TRUE.

export interface VisibilityContext {
  viewerId:                string
  viewerIsAdmin:           boolean
}

export interface ProfileVisibilityFields {
  id:                       string
  is_off_market?:           boolean | null
  relationship_manager_id?: string | null
}

// Fast in-process check. Use this when you already have the profile row
// loaded — avoids a SQL roundtrip for the common visible-by-default case.
// Returns null for the "need a connection check" case so the caller can
// decide whether to do the DB lookup or treat as not-visible.
export function quickVisibility(
  ctx:     VisibilityContext,
  profile: ProfileVisibilityFields,
): boolean | 'needs-connection-check' {
  if (profile.id === ctx.viewerId)                            return true
  if (!profile.is_off_market)                                 return true
  if (ctx.viewerIsAdmin)                                      return true
  if (profile.relationship_manager_id === ctx.viewerId)       return true
  return 'needs-connection-check'
}

// Full check with DB lookup when needed. Most callers should use this.
export async function isProfileVisibleTo(
  ctx:     VisibilityContext,
  profile: ProfileVisibilityFields,
): Promise<boolean> {
  const quick = quickVisibility(ctx, profile)
  if (quick !== 'needs-connection-check') return quick

  const row = await queryOne<{ one: number }>(
    `SELECT 1 AS one FROM introductions
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND recipient_id = $2)
          OR (requester_id = $2 AND recipient_id = $1))
      LIMIT 1`,
    [ctx.viewerId, profile.id],
  )
  return !!row
}

// SQL fragment for embedding in WHERE clauses to filter results down
// to profiles the viewer can see. Consumes ONE $-placeholder (viewerId).
//
// Example:
//   const sql = `
//     SELECT p.* FROM profiles p
//     WHERE p.onboarding_completed = TRUE
//       AND ${visibilityWhereFragment('p', 1)}
//   `
//   await query(sql, [viewerId])
//
// is_off_market = FALSE is the common case, so the rest of the OR chain
// short-circuits cheaply for the vast majority of rows.
export function visibilityWhereFragment(
  profileAlias: string,
  viewerIdParamIndex: number,
): string {
  return `(
    ${profileAlias}.is_off_market = FALSE
    -- Downgrade grace expired: the row hasn't been flipped back to
    -- visible yet (waiting on the user's next /profile load), but the
    -- effect of off-market is already over.
    OR ${profileAlias}.off_market_grace_until <= NOW()
    OR ${profileAlias}.id = $${viewerIdParamIndex}
    OR ${profileAlias}.relationship_manager_id = $${viewerIdParamIndex}
    OR EXISTS (SELECT 1 FROM profiles a WHERE a.id = $${viewerIdParamIndex} AND a.is_admin = TRUE)
    OR EXISTS (
      SELECT 1 FROM introductions i
       WHERE i.status = 'accepted'
         AND ((i.requester_id = $${viewerIdParamIndex} AND i.recipient_id = ${profileAlias}.id)
           OR (i.requester_id = ${profileAlias}.id AND i.recipient_id = $${viewerIdParamIndex}))
    )
  )`
}
