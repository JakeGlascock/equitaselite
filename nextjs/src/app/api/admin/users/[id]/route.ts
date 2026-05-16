import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { deleteCognitoUser } from '@/lib/auth'

const PatchSchema = z.object({
  is_admin:     z.boolean().optional(),
  is_concierge: z.boolean().optional(),
  // null = clear back to "no tier" (rare; mostly the value flips between
  // access | select | sovereign as admins grant/downgrade).
  membership:   z.enum(['access', 'select', 'sovereign']).nullable().optional(),
  // null = unassign the user's relationship manager.
  relationship_manager_id: z.string().min(1).nullable().optional(),
}).refine(
  d => d.is_admin !== undefined
    || d.is_concierge !== undefined
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

  try {
    const updated = await queryOne<{
      id: string
      is_admin: boolean
      is_concierge: boolean
      membership: string | null
      relationship_manager_id: string | null
    }>(
      `UPDATE profiles
       SET is_admin                = COALESCE($2, is_admin),
           is_concierge            = COALESCE($3, is_concierge),
           membership              = CASE WHEN $4::boolean THEN $5::text ELSE membership              END,
           relationship_manager_id = CASE WHEN $6::boolean THEN $7::text ELSE relationship_manager_id END
       WHERE id = $1
       RETURNING id, is_admin, is_concierge, membership, relationship_manager_id`,
      [
        id,
        parsed.data.is_admin     ?? null,
        parsed.data.is_concierge ?? null,
        membershipParam !== undefined,
        membershipParam ?? null,
        rmParam !== undefined,
        rmParam ?? null,
      ]
    )
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('is_concierge')) {
      return NextResponse.json(
        { error: 'Initialize the concierge columns first.' },
        { status: 400 }
      )
    }
    if (msg.includes('membership')) {
      return NextResponse.json(
        { error: 'Initialize the membership column first.' },
        { status: 400 }
      )
    }
    if (msg.includes('relationship_manager_id')) {
      return NextResponse.json(
        { error: 'relationship_manager_id column missing — wait for the next deploy to run the migration.' },
        { status: 400 }
      )
    }
    console.error('admin user PATCH failed:', err)
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
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
        { error: 'Missing email — cannot resolve Cognito user.' },
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
