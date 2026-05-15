import { NextRequest, NextResponse } from 'next/server'
import { isUserAdmin } from '@/lib/admin'
import { listCognitoUsers } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

// Derive a friendly first-name placeholder from the email's local-part.
// Mirrors the same helper used by the invite endpoint so backfilled
// rows look identical to fresh-invite ones.
function placeholderFullName(email: string): string {
  const local = email.split('@')[0].split('+')[0]
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .slice(0, 120) || email
}

// POST /api/admin/backfill-placeholders
//
// For every Cognito user that doesn't have a profile row yet, insert a
// placeholder profile so admin toggles (tier / admin / concierge / RM)
// become live. The invite endpoint already does this for new invites
// (since f8e6905); this handles the historical set — anyone invited
// before that change still sits in the "Invited" state with disabled
// toggles. One click moves them all to "Onboarding" with active toggles.
//
// Idempotent: rows where the profile already exists are skipped via
// ON CONFLICT (id) DO NOTHING. Safe to re-run.
export async function POST(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cognitoUsers = await listCognitoUsers().catch(err => {
    console.error('listCognitoUsers failed:', err)
    return []
  })

  let scanned = 0
  let created = 0
  let skipped = 0

  for (const u of cognitoUsers) {
    scanned++
    // Need the sub to use as profile.id. Without it we can't create
    // a useable placeholder (the Cognito sub is the primary key downstream).
    if (!u.sub) { skipped++; continue }

    // Quick existence check first so we don't churn INSERT/conflict
    // round-trips when the profile already exists.
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = $1',
      [u.sub],
    ).catch(() => null)
    if (existing) { skipped++; continue }

    try {
      await query(
        `INSERT INTO profiles (id, email, role, full_name, firm_name, onboarding_completed)
         VALUES ($1, $2, 'angel', $3, 'Pending', FALSE)
         ON CONFLICT (id) DO NOTHING`,
        [u.sub, u.email, placeholderFullName(u.email)],
      )
      created++
    } catch (err: unknown) {
      // Most likely a UNIQUE(email) collision from a stale profile with
      // a different id. Skip and let the admin clean up by hand.
      console.error(`backfill: insert failed for ${u.email}:`, err)
      skipped++
    }
  }

  return NextResponse.json({ ok: true, scanned, created, skipped })
}
