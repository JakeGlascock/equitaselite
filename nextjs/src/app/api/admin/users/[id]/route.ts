import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { deleteCognitoUser } from '@/lib/auth'

const PatchSchema = z.object({
  is_admin:         z.boolean().optional(),
  is_concierge:     z.boolean().optional(),
  // Multi-role identity (migration 034 + 035). Each profile can hold
  // any combination of Angel + FO + Concierge + Next-Gen + Foundation
  // + DAF. Admin grants are independent — flipping is_angel doesn't
  // touch is_family_office or any of the role-035 flags.
  is_angel:             z.boolean().optional(),
  is_family_office:     z.boolean().optional(),
  is_next_gen:          z.boolean().optional(),
  is_family_foundation: z.boolean().optional(),
  is_daf:               z.boolean().optional(),
  // null = clear back to "no tier" (rare; mostly the value flips between
  // access | select | sovereign as admins grant/downgrade).
  membership:   z.enum(['access', 'select', 'sovereign']).nullable().optional(),
  // null = unassign the user's relationship manager.
  relationship_manager_id: z.string().min(1).nullable().optional(),
}).refine(
  d => d.is_admin !== undefined
    || d.is_concierge !== undefined
    || d.is_angel !== undefined
    || d.is_family_office !== undefined
    || d.is_next_gen !== undefined
    || d.is_family_foundation !== undefined
    || d.is_daf !== undefined
    || d.membership !== undefined
    || d.relationship_manager_id !== undefined,
  { message: 'Provide at least one field to update.' }
)

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Safety: an admin can't revoke their own admin (lockout risk)
  if (id === userId && parsed.data.is_admin === false) {
    return NextResponse.json(
      { error: 'You cannot revoke your own admin access. Ask another admin to do it.' },
      { status: 400 }
    )
  }

  // Distinguish "not in payload" from "explicit null" so we can clear values
  // when the admin picks "— None —".
  const membershipParam   = parsed.data.membership
  const rmParam           = parsed.data.relationship_manager_id

  // Validate RM is actually a concierge (if assigning)
  if (rmParam) {
    if (rmParam === id) {
      return NextResponse.json({ error: 'A user cannot be their own relationship manager.' }, { status: 400 })
    }
    const rmRow = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = $1 AND is_concierge = TRUE',
      [rmParam]
    )
    if (!rmRow) {
      return NextResponse.json({ error: 'Relationship manager must be a concierge.' }, { status: 400 })
    }
  }

  type UpdatedRow = {
    id: string
    is_admin: boolean
    is_concierge: boolean
    is_angel: boolean
    is_family_office: boolean
    is_next_gen: boolean
    is_family_foundation: boolean
    is_daf: boolean
    membership: string | null
    relationship_manager_id: string | null
  }
  const params = [
    id,
    parsed.data.is_admin             ?? null,
    parsed.data.is_concierge         ?? null,
    membershipParam !== undefined,
    membershipParam ?? null,
    rmParam !== undefined,
    rmParam ?? null,
    parsed.data.is_angel             ?? null,
    parsed.data.is_family_office     ?? null,
    parsed.data.is_next_gen          ?? null,
    parsed.data.is_family_foundation ?? null,
    parsed.data.is_daf               ?? null,
  ]

  try {
    let updated: UpdatedRow | null
    try {
      updated = await queryOne<UpdatedRow>(
      `UPDATE profiles
       SET is_admin                = COALESCE($2, is_admin),
           is_concierge            = COALESCE($3, is_concierge),
           membership              = CASE WHEN $4::boolean THEN $5::text ELSE membership              END,
           relationship_manager_id = CASE WHEN $6::boolean THEN $7::text ELSE relationship_manager_id END,
           -- Multi-role identity (migration 034). Independent flags;
           -- toggling Angel doesn't touch Family Office.
           is_angel             = COALESCE($8,  is_angel),
           is_family_office     = COALESCE($9,  is_family_office),
           is_next_gen          = COALESCE($10, is_next_gen),
           is_family_foundation = COALESCE($11, is_family_foundation),
           is_daf               = COALESCE($12, is_daf),
           -- Keep the legacy role string in sync with the flags so
           -- Phase B/C read paths (still on the role column) do not
           -- drift. When both flags are TRUE, prefer the existing
           -- role value; when
           -- only one is TRUE, set role accordingly; when both are
           -- FALSE (e.g. concierge-only), null out role.
           role = CASE
             WHEN COALESCE($8, is_angel) = TRUE AND COALESCE($9, is_family_office) = FALSE THEN 'angel'
             WHEN COALESCE($8, is_angel) = FALSE AND COALESCE($9, is_family_office) = TRUE THEN 'family_office'
             WHEN COALESCE($8, is_angel) = FALSE AND COALESCE($9, is_family_office) = FALSE THEN NULL
             ELSE role
           END,
           -- Off-Market downgrade grace (migration 033). When a
           -- Sovereign drops tier while is_off_market = TRUE, start
           -- a 7-day countdown. Re-upgrading to Sovereign during
           -- grace clears the timer. No-ops on rows where the column
           -- doesn't exist yet — the outer try/catch falls back to
           -- the pre-033 update.
           off_market_grace_until = CASE
             WHEN $4::boolean
              AND $5::text IS DISTINCT FROM 'sovereign'
              AND membership = 'sovereign'
              AND is_off_market = TRUE
             THEN NOW() + INTERVAL '7 days'
             WHEN $4::boolean AND $5::text = 'sovereign'
             THEN NULL
             ELSE off_market_grace_until
           END,
           -- Off-Market default-on for Sovereign (F3). When membership
           -- is being PROMOTED to 'sovereign' from a different tier,
           -- auto-flip is_off_market = TRUE. Privacy is the headline
           -- Sovereign benefit; users explicitly opt OUT via /profile
           -- if they want to be visible. Existing Sovereigns whose tier
           -- isn't changing don't get touched. Re-upgrade-from-grace
           -- (Sovereign → lower → Sovereign during grace) hits this
           -- branch too IF the row was somehow flipped off in between,
           -- otherwise the row stays TRUE.
           is_off_market = CASE
             WHEN $4::boolean
              AND $5::text = 'sovereign'
              AND membership IS DISTINCT FROM 'sovereign'
             THEN TRUE
             ELSE is_off_market
           END
       WHERE id = $1
       RETURNING id, is_admin, is_concierge,
                 is_angel, is_family_office,
                 is_next_gen, is_family_foundation, is_daf,
                 membership, relationship_manager_id`,
        params,
      )
    } catch (innerErr: unknown) {
      // Pre-033/034 fallback: off_market_grace_until and/or is_angel/
      // is_family_office columns don't exist yet. Retry without those
      // clauses so tier changes still work on staging.
      const msg = innerErr instanceof Error ? innerErr.message : ''
      const isMigrationColumn =
        msg.includes('off_market_grace_until') ||
        msg.includes('is_off_market')          ||
        msg.includes('is_angel')               ||
        msg.includes('is_family_office')       ||
        msg.includes('is_next_gen')            ||
        msg.includes('is_family_foundation')   ||
        msg.includes('is_daf')
      if (!isMigrationColumn) throw innerErr
      updated = await queryOne<UpdatedRow>(
        `UPDATE profiles
         SET is_admin                = COALESCE($2, is_admin),
             is_concierge            = COALESCE($3, is_concierge),
             membership              = CASE WHEN $4::boolean THEN $5::text ELSE membership              END,
             relationship_manager_id = CASE WHEN $6::boolean THEN $7::text ELSE relationship_manager_id END
         WHERE id = $1
         RETURNING id, is_admin, is_concierge, membership, relationship_manager_id`,
        params,
      )
    }
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    // The three branches below catch migration-not-yet-applied states.
    // Surface the same user-facing copy in all three; the original DB
    // column names stay in the server log for the operator (not in the
    // response body — see the prior "relationship_manager_id column
    // missing" leak that made it to a UI alert).
    if (msg.includes('is_concierge') || msg.includes('membership') || msg.includes('relationship_manager_id')) {
      console.error('admin user PATCH blocked by pending migration:', msg)
      return NextResponse.json(
        { error: 'This admin field isn’t available yet — a database migration is pending.' },
        { status: 503 },
      )
    }
    console.error('admin user PATCH failed:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

// Hard-delete a user. Removes them from Cognito (so they can't sign back in)
// and deletes their profile row, which cascades FK cleanup across
// introductions, notifications, event_rsvps, concierge_requests, preview_tokens,
// portfolio_reports (as recipient), and NULLs them out from access_requests,
// reports, and any managed/RM relationships.
//
// Safety rails:
//   - Admin auth required.
//   - Cannot delete self (lockout risk).
//   - Cannot delete admins (must revoke admin first).
//   - Cannot delete concierges (must revoke first — they may author briefings,
//     RM real members, etc., and unwinding those silently is risky).
//   - Demo profiles are managed via the seed tooling, not this endpoint.
//
// Email is taken from the query string for users who exist in Cognito but
// have not yet completed onboarding (no profile row, so we can't look up
// the email server-side). When a profile exists, the profile's email wins.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (id === userId) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.' },
      { status: 400 }
    )
  }

  if (id.startsWith('demo_')) {
    return NextResponse.json(
      { error: 'Demo profiles are managed via the seed tooling, not deletable here.' },
      { status: 400 }
    )
  }

  // Profile may not exist (invited-but-not-onboarded users live only in Cognito).
  const target = await queryOne<{
    id: string; email: string; is_admin: boolean; is_concierge: boolean
  }>(
    'SELECT id, email, is_admin, is_concierge FROM profiles WHERE id = $1',
    [id]
  ).catch(() => null)

  if (target?.is_admin) {
    return NextResponse.json(
      { error: 'Cannot delete an admin. Revoke admin status first.' },
      { status: 400 }
    )
  }
  if (target?.is_concierge) {
    return NextResponse.json(
      { error: 'Cannot delete a concierge. Revoke concierge status first.' },
      { status: 400 }
    )
  }

  // Managed accounts have no Cognito user — DB-only.
  const isManaged = id.startsWith('managed_')

  // Cognito delete (real users only). Prefer the profile's email when known,
  // otherwise fall back to the query-string email passed by the caller.
  if (!isManaged) {
    const cognitoUsername =
      target?.email ?? req.nextUrl.searchParams.get('email') ?? null

    if (!cognitoUsername) {
      return NextResponse.json(
        { error: 'This account has no email on file, so we can’t delete the sign-in record.' },
        { status: 400 }
      )
    }

    try {
      await deleteCognitoUser(cognitoUsername)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      // If the user is already gone from Cognito, keep going so we can still
      // clean up any orphaned profile row.
      if (!/UserNotFound|does not exist/i.test(msg)) {
        console.error('Cognito delete failed:', err)
        return NextResponse.json(
          { error: `Cognito delete failed: ${msg || 'unknown error'}` },
          { status: 500 }
        )
      }
    }
  }

  // Profile delete (cascades clean up FK data). Skip if no profile row exists.
  if (target) {
    try {
      await queryOne<{ id: string }>(
        'DELETE FROM profiles WHERE id = $1 RETURNING id',
        [id]
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'profile delete failed'
      console.error('Profile delete failed:', err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
