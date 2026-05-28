import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { inviteUser } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { createLinkRequest } from '@/lib/family'

// P5c — self-serve next-gen invite. A wealth-holder (Family Office,
// Family Foundation, or DAF) invites a family member to shadow their
// seat. Mirrors the admin invite path (Cognito invite + placeholder
// profile row) but:
//   - the caller is the inviter, not an admin,
//   - the placeholder row is seeded with is_next_gen=TRUE and
//     parent_profile_id=caller, so the link exists from the moment
//     the invite is sent (the next-gen doesn't need an admin pass).
//
// Email collision is an explicit 409: if a profile already exists
// with this email, the parent has to coordinate with that user
// (and admin) to attach the existing account. Cross-account linking
// is intentionally NOT in P5c — see project_equitaselite_product_phase_plan
// memory for the rationale.

const Schema = z.object({
  email: z.string().email(),
})

// Same shape as admin/invite — keep the placeholder full_name
// readable so it shows up nicely in MembersTable / search until the
// next-gen completes onboarding.
function placeholderFullName(email: string): string {
  const local = email.split('@')[0].split('+')[0]
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .slice(0, 120) || email
}

export async function POST(req: NextRequest) {
  const callerId = req.headers.get('x-user-id')
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase()

  // Gate: only wealth-holder roles can seed a next-gen seat. The
  // schema doesn't prevent a plain Angel from inviting one, but
  // semantically the link is the parent→next-gen relationship of a
  // family wealth structure. Pre-035 fallback narrows to FO only.
  type CallerRow = {
    is_family_office:     boolean | null
    is_family_foundation: boolean | null
    is_daf:               boolean | null
  }
  const caller = await queryOne<CallerRow>(
    `SELECT is_family_office, is_family_foundation, is_daf
       FROM profiles WHERE id = $1`,
    [callerId],
  ).catch(async () => {
    // Pre-035 (no is_family_foundation / is_daf columns): fall back
    // to is_family_office only.
    const row = await queryOne<{ is_family_office: boolean | null }>(
      `SELECT is_family_office FROM profiles WHERE id = $1`,
      [callerId],
    ).catch(() => null)
    if (!row) return null
    return { is_family_office: row.is_family_office, is_family_foundation: null, is_daf: null }
  })
  if (!caller) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }
  const isWealthHolder = !!(caller.is_family_office || caller.is_family_foundation || caller.is_daf)
  if (!isWealthHolder) {
    return NextResponse.json(
      { error: 'Only Family Office, Family Foundation, or Donor-Advised Fund seats can invite a next-gen.' },
      { status: 403 },
    )
  }

  // Collision: if a profile already exists with this email, the
  // request becomes a P5f cross-account link request instead of a
  // new-profile invite. createLinkRequest silently no-ops if the
  // target is ineligible (admin/concierge/demo/wealth-holder, or
  // already has a parent, or a pending request from us already
  // exists) — we return 202 either way so the requester can't
  // enumerate target eligibility from the response.
  //
  // On accept, the target's parent_profile_id gets set + a
  // notification fires back to the requester. The target sees the
  // pending request on their /profile incoming panel and in the bell.
  const collision = await queryOne<{ id: string }>(
    `SELECT id FROM profiles WHERE LOWER(email) = $1`,
    [email],
  ).catch(() => null)
  if (collision) {
    const linkReq = await createLinkRequest(callerId, collision.id).catch(() => null)
    if (linkReq) {
      void (async () => {
        await query(
          `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
                VALUES ($1, 'family_link_request', $2, $3, $4, $5)`,
          [
            collision.id,
            'Family seat link request',
            'A wealth-holder on EE has invited you to join their family seat as a next-gen.',
            '/profile',
            linkReq.id,
          ],
        ).catch(err => console.error('family_link_request notification failed:', err))
      })()
    }
    return NextResponse.json(
      {
        ok: true,
        kind: 'link_request',
        message: 'If their account is eligible, we sent them a link request.',
      },
      { status: 202 },
    )
  }

  // Cognito invite — same code path as admin/invite. The Cognito-side
  // duplicate (UsernameExistsException) is a 500 here because it's
  // unexpected (we just confirmed no profile row has this email).
  // Most likely cause: an orphaned Cognito user from a deleted profile.
  let sub: string
  try {
    ({ sub } = await inviteUser(email))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invite failed'
    if (/UsernameExistsException|already exists/i.test(msg)) {
      return NextResponse.json(
        { error: 'That email is already in our identity provider. Ask an admin to clean it up.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Seed the placeholder row WITH is_next_gen=TRUE + parent_profile_id
  // set to the inviter. From this moment forward, the link exists —
  // even before the next-gen signs in for the first time.
  //
  // role='angel' matches the admin/invite placeholder shape (the legacy
  // role column still defaults to angel). The 035 flags are what
  // actually drive the runtime — is_next_gen TRUE is what we care about.
  try {
    await query(
      `INSERT INTO profiles (
         id, email, role, full_name, firm_name, onboarding_completed,
         is_next_gen, parent_profile_id
       ) VALUES ($1, $2, 'angel', $3, 'Pending', FALSE, TRUE, $4)
       ON CONFLICT (id) DO NOTHING`,
      [sub, email, placeholderFullName(email), callerId],
    )
  } catch (err: unknown) {
    // Pre-043 environment (no parent_profile_id column) or pre-035
    // (no is_next_gen). Fall back to a minimal seed; admin can attach
    // the link from /admin once migrations land.
    const msg = err instanceof Error ? err.message : ''
    const isMigrationColumn =
      msg.includes('parent_profile_id') ||
      msg.includes('is_next_gen')
    if (!isMigrationColumn) {
      console.error('next-gen invite: placeholder insert failed:', err)
    } else {
      await query(
        `INSERT INTO profiles (id, email, role, full_name, firm_name, onboarding_completed)
         VALUES ($1, $2, 'angel', $3, 'Pending', FALSE)
         ON CONFLICT (id) DO NOTHING`,
        [sub, email, placeholderFullName(email)],
      ).catch(e => console.error('next-gen invite: fallback insert failed:', e))
    }
  }

  return NextResponse.json({ ok: true, email, sub }, { status: 201 })
}
