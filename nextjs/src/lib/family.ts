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
