import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { inviteUser } from '@/lib/auth'
import { isUserAdmin } from '@/lib/admin'
import { query } from '@/lib/db'

const InviteSchema = z.object({
  email: z.string().email(),
})

// Derive a friendly first-name placeholder from the email's local-part.
// 'alex.chen+demo@example.com' -> 'Alex Chen'. The user overwrites this
// when they complete /onboarding, so it doesn't have to be perfect.
function placeholderFullName(email: string): string {
  const local = email.split('@')[0].split('+')[0]
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .slice(0, 120) || email
}

export async function POST(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = InviteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  const email = parsed.data.email

  let sub: string
  try {
    ({ sub } = await inviteUser(email))
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invite failed' },
      { status: 500 }
    )
  }

  // Seed a placeholder profile so admins can toggle Admin / Concierge /
  // Tier / RM for this user BEFORE they sign in and complete onboarding.
  // `onboarding_completed = FALSE` keeps them out of every match query.
  // Values get overwritten cleanly when the user POSTs /api/onboarding
  // (which uses ON CONFLICT (id) DO UPDATE).
  //
  // We tolerate failure here — the invite has already gone out via
  // Cognito, and onboarding can still recreate the row if needed.
  let placeholderCreated = false
  try {
    const fullName = placeholderFullName(email)
    await query(
      `INSERT INTO profiles (id, email, role, full_name, firm_name, onboarding_completed)
       VALUES ($1, $2, 'angel', $3, 'Pending', FALSE)
       ON CONFLICT (id) DO NOTHING`,
      [sub, email, fullName]
    )
    placeholderCreated = true
  } catch (err: unknown) {
    // Most likely a duplicate-email UNIQUE violation if there's a stale
    // profile row from a previous Cognito user with the same email.
    // Soft-fail: admin can clean it up from MembersTable.
    console.error('invite: placeholder profile insert failed:', err)
  }

  return NextResponse.json({ ok: true, email, sub, placeholderCreated }, { status: 201 })
}
