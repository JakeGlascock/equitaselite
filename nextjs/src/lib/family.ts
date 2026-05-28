import { query, queryOne } from './db'

// P5 v1 — parent ↔ next-gen seat data access.
//
// Thin pg query wrappers. Permission gating lives in the route
// handlers (admin-only writes today; self-serve invite flow is
// P5b). The data model intentionally allows any profile to point
// at any other profile via parent_profile_id; semantic correctness
// (parent should be a wealth-holder, next-gen should be is_next_gen)
// is enforced by the caller, not the schema, so we can iterate.

export interface ParentSummary {
  id:         string
  full_name:  string
  firm_name:  string
  role:       'angel' | 'family_office' | null
}

export interface NextGenSummary {
  id:         string
  full_name:  string
  firm_name:  string
  email:      string
  // Whether the next-gen has completed onboarding — drives the
  // /profile copy ("Active" vs "Invited, hasn't joined").
  onboarding_completed: boolean
}

export async function getParent(profileId: string): Promise<ParentSummary | null> {
  return queryOne<ParentSummary>(
    `SELECT p.id, p.full_name, p.firm_name, p.role
       FROM profiles me
       JOIN profiles p ON p.id = me.parent_profile_id
      WHERE me.id = $1`,
    [profileId],
  ).catch(() => null)
}

export async function listNextGenSeats(parentId: string): Promise<NextGenSummary[]> {
  return query<NextGenSummary>(
    `SELECT id, full_name, firm_name, email, onboarding_completed
       FROM profiles
      WHERE parent_profile_id = $1
      ORDER BY full_name`,
    [parentId],
  ).catch(() => [])
}

/** Link a next-gen seat to a parent. Validates:
 *    - parentId !== nextGenId (CHECK constraint backs this up too)
 *    - both profiles exist
 *    - the next-gen has is_next_gen = TRUE (semantic correctness)
 *  Returns null on any validation failure; otherwise updates and
 *  returns the linked next-gen's id. */
export async function linkNextGen(
  parentId:   string,
  nextGenId:  string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (parentId === nextGenId) {
    return { ok: false, error: 'A profile cannot shadow itself.' }
  }
  const target = await queryOne<{ id: string; is_next_gen: boolean | null }>(
    `SELECT id, is_next_gen FROM profiles WHERE id = $1`,
    [nextGenId],
  ).catch(() => null)
  if (!target) return { ok: false, error: 'Next-gen profile not found.' }
  if (!target.is_next_gen) {
    return { ok: false, error: 'Target profile must have the Next-Gen role flag set.' }
  }
  const parent = await queryOne<{ id: string }>(
    `SELECT id FROM profiles WHERE id = $1`,
    [parentId],
  ).catch(() => null)
  if (!parent) return { ok: false, error: 'Parent profile not found.' }

  await query(
    `UPDATE profiles SET parent_profile_id = $2 WHERE id = $1`,
    [nextGenId, parentId],
  )
  return { ok: true }
}

/** Clear a next-gen's parent link. */
export async function unlinkNextGen(nextGenId: string): Promise<void> {
  await query(
    `UPDATE profiles SET parent_profile_id = NULL WHERE id = $1`,
    [nextGenId],
  )
}

// ─── P5f — cross-account link request lifecycle ──────────────────

export type LinkRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface FamilyLinkRequest {
  id:             string
  requester_id:   string
  target_id:      string
  status:         LinkRequestStatus
  created_at:     string
  responded_at:   string | null
  expires_at:     string
}

/** Joined shape used by the inbox + outgoing list UIs so they can
 *  render the counterparty's name + firm without an extra fetch. */
export interface FamilyLinkRequestView extends FamilyLinkRequest {
  requester_name:  string | null
  requester_firm:  string | null
  target_name:     string | null
  target_firm:     string | null
  target_email:    string | null
}

interface EligibilityTarget {
  id:                   string
  parent_profile_id:    string | null
  is_admin:             boolean | null
  is_concierge:         boolean | null
  is_demo:              boolean | null
  is_family_office:     boolean | null
  is_family_foundation: boolean | null
  is_daf:               boolean | null
}

/**
 * Whether a target profile can be a next-gen seat under a parent.
 * Used as a SILENT filter at link-request creation time so the
 * requester can't enumerate target eligibility (no info leak about
 * whether the target is admin / has a parent / etc).
 *
 * Returns true iff the target:
 *   - is not the requester themselves (CHECK on the table also
 *     enforces this, but we short-circuit before the INSERT),
 *   - is not already linked to another parent (one parent at a time),
 *   - is not an admin or concierge (those roles don't fit the model
 *     and can't shadow on someone's behalf),
 *   - is not a demo profile (same rule as the rest of the invite flow),
 *   - is not a wealth-holder themselves (FO/Foundation/DAF). They
 *     can't simultaneously hold a parent seat and be next-gen of
 *     another — the shadow model would conflict with their own
 *     wealth-holder dashboard.
 *
 * Tolerates pre-035 / pre-043 schemas — missing columns read as null
 * and don't block eligibility.
 */
export function isLinkEligible(
  target:     EligibilityTarget,
  requesterId: string,
): boolean {
  if (target.id === requesterId) return false
  if (target.parent_profile_id)  return false
  if (target.is_admin)           return false
  if (target.is_concierge)       return false
  if (target.is_demo)            return false
  if (target.is_family_office)     return false
  if (target.is_family_foundation) return false
  if (target.is_daf)               return false
  return true
}

/**
 * Create a pending link request. Returns the inserted row on success,
 * or null on any of:
 *   - target is ineligible (see isLinkEligible)
 *   - a pending request from this requester to this target already
 *     exists (idempotent — the partial unique index would fire)
 * Callers should treat null as "request not created, but don't leak
 * why" so the requester can't enumerate target state.
 */
export async function createLinkRequest(
  requesterId: string,
  targetId:    string,
): Promise<FamilyLinkRequest | null> {
  // Eligibility pre-check. Tolerant of older schemas: the LEFT
  // SELECT only loads columns that exist post-035/043; pre-migration
  // environments throw and we fall back to a minimal eligibility
  // (parent + admin/concierge are the load-bearing checks).
  let target: EligibilityTarget | null
  try {
    target = await queryOne<EligibilityTarget>(
      `SELECT id, parent_profile_id, is_admin, is_concierge, is_demo,
              is_family_office, is_family_foundation, is_daf
         FROM profiles WHERE id = $1`,
      [targetId],
    )
  } catch {
    target = await queryOne<EligibilityTarget>(
      `SELECT id, parent_profile_id, is_admin, is_concierge,
              FALSE AS is_demo,
              is_family_office,
              FALSE AS is_family_foundation,
              FALSE AS is_daf
         FROM profiles WHERE id = $1`,
      [targetId],
    ).catch(() => null)
  }
  if (!target || !isLinkEligible(target, requesterId)) return null

  try {
    const row = await queryOne<FamilyLinkRequest>(
      `INSERT INTO family_link_requests (requester_id, target_id)
            VALUES ($1, $2)
         RETURNING *`,
      [requesterId, targetId],
    )
    return row
  } catch {
    // Most likely: partial-unique fired because a pending request
    // already exists. Return null (callers treat as a no-op success).
    return null
  }
}

/** Pending requests the caller has received (their inbox).
 *  P5g: filters expired rows at read time so we don't need a cron
 *  prune — `expires_at > NOW()` keeps stale 14-day-old requests
 *  out of the UI even though they linger in the table. */
export async function listIncomingLinkRequests(
  targetId: string,
): Promise<FamilyLinkRequestView[]> {
  return query<FamilyLinkRequestView>(
    `SELECT r.id, r.requester_id, r.target_id, r.status,
            r.created_at, r.responded_at, r.expires_at,
            req.full_name AS requester_name,
            req.firm_name AS requester_firm,
            NULL::text    AS target_name,
            NULL::text    AS target_firm,
            NULL::text    AS target_email
       FROM family_link_requests r
       LEFT JOIN profiles req ON req.id = r.requester_id
      WHERE r.target_id = $1
        AND r.status = 'pending'
        AND r.expires_at > NOW()
      ORDER BY r.created_at DESC`,
    [targetId],
  ).catch(() => [])
}

/** Outgoing requests for the requester's "pending invitation" view.
 *  Same expiry filter as the incoming side. */
export async function listOutgoingLinkRequests(
  requesterId: string,
): Promise<FamilyLinkRequestView[]> {
  return query<FamilyLinkRequestView>(
    `SELECT r.id, r.requester_id, r.target_id, r.status,
            r.created_at, r.responded_at, r.expires_at,
            NULL::text    AS requester_name,
            NULL::text    AS requester_firm,
            tgt.full_name AS target_name,
            tgt.firm_name AS target_firm,
            tgt.email     AS target_email
       FROM family_link_requests r
       LEFT JOIN profiles tgt ON tgt.id = r.target_id
      WHERE r.requester_id = $1
        AND r.status = 'pending'
        AND r.expires_at > NOW()
      ORDER BY r.created_at DESC`,
    [requesterId],
  ).catch(() => [])
}

/** Single fetch by id. Used by accept/decline to validate ownership
 *  before mutating. */
export async function getLinkRequest(
  requestId: string,
): Promise<FamilyLinkRequest | null> {
  return queryOne<FamilyLinkRequest>(
    `SELECT * FROM family_link_requests WHERE id = $1`,
    [requestId],
  ).catch(() => null)
}

/**
 * Accept a pending request as the target. On success:
 *   - sets profiles.parent_profile_id = request.requester_id
 *   - sets profiles.is_next_gen = TRUE (the link implies the role)
 *   - marks the request accepted with responded_at = NOW()
 * Validates target eligibility AGAIN at accept time (the target's
 * account may have changed between request and accept — e.g., they
 * accepted another link request first).
 *
 * Returns {ok: true} on success or {ok: false, error} on validation
 * failure. The route surfaces the error message verbatim.
 */
export async function acceptLinkRequest(
  requestId: string,
  targetId:  string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const request = await getLinkRequest(requestId)
  if (!request)                        return { ok: false, error: 'Request not found.' }
  if (request.target_id !== targetId)  return { ok: false, error: 'Request not found.' }
  if (request.status !== 'pending')    return { ok: false, error: 'Request already responded to.' }

  // Re-check eligibility — guards the race where the target accepted
  // another link request after this one was created.
  let target: EligibilityTarget | null
  try {
    target = await queryOne<EligibilityTarget>(
      `SELECT id, parent_profile_id, is_admin, is_concierge, is_demo,
              is_family_office, is_family_foundation, is_daf
         FROM profiles WHERE id = $1`,
      [targetId],
    )
  } catch {
    target = await queryOne<EligibilityTarget>(
      `SELECT id, parent_profile_id, is_admin, is_concierge,
              FALSE AS is_demo,
              is_family_office,
              FALSE AS is_family_foundation,
              FALSE AS is_daf
         FROM profiles WHERE id = $1`,
      [targetId],
    ).catch(() => null)
  }
  if (!target)                                       return { ok: false, error: 'Profile not found.' }
  if (target.parent_profile_id)                      return { ok: false, error: 'You are already linked to a parent seat. Unlink first to switch.' }
  if (!isLinkEligible(target, request.requester_id)) return { ok: false, error: 'This account is not eligible to be linked as a next-gen seat.' }

  // Two writes; not atomic across the table boundary, but the worst
  // case (profile updated, request still pending) self-heals on
  // next accept attempt — the request status flips on the second
  // call without re-writing the profile.
  try {
    await query(
      `UPDATE profiles
          SET parent_profile_id = $2,
              is_next_gen        = TRUE
        WHERE id = $1`,
      [targetId, request.requester_id],
    )
  } catch {
    // Pre-035 / pre-043 fallback.
    await query(
      `UPDATE profiles SET parent_profile_id = $2 WHERE id = $1`,
      [targetId, request.requester_id],
    ).catch(() => undefined)
  }

  await query(
    `UPDATE family_link_requests
        SET status = 'accepted', responded_at = NOW()
      WHERE id = $1 AND status = 'pending'`,
    [requestId],
  )

  return { ok: true }
}

/** Decline a pending request as the target. No profile mutation —
 *  just marks the request declined. */
export async function declineLinkRequest(
  requestId: string,
  targetId:  string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const request = await getLinkRequest(requestId)
  if (!request)                        return { ok: false, error: 'Request not found.' }
  if (request.target_id !== targetId)  return { ok: false, error: 'Request not found.' }
  if (request.status !== 'pending')    return { ok: false, error: 'Request already responded to.' }

  await query(
    `UPDATE family_link_requests
        SET status = 'declined', responded_at = NOW()
      WHERE id = $1 AND status = 'pending'`,
    [requestId],
  )
  return { ok: true }
}

/**
 * P5g — requester withdraws their own pending request before the
 * target acts on it. Same ownership-by-404 pattern as accept/decline:
 * a request that doesn't exist OR doesn't belong to the caller is
 * indistinguishable. No notification to target — the row simply
 * disappears from their inbox at the next read.
 */
export async function cancelLinkRequest(
  requestId:   string,
  requesterId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const request = await getLinkRequest(requestId)
  if (!request)                              return { ok: false, error: 'Request not found.' }
  if (request.requester_id !== requesterId)  return { ok: false, error: 'Request not found.' }
  if (request.status !== 'pending')          return { ok: false, error: 'Request already responded to.' }

  await query(
    `UPDATE family_link_requests
        SET status = 'cancelled', responded_at = NOW()
      WHERE id = $1 AND status = 'pending'`,
    [requestId],
  )
  return { ok: true }
}
