import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // 1. Add the column + index (idempotent)
    await query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`
    )
    await query(
      `CREATE INDEX IF NOT EXISTS profiles_is_admin_idx
       ON profiles (is_admin) WHERE is_admin = TRUE`
    )

    // 2. Bootstrap: any profile whose email is in ADMIN_EMAILS gets is_admin=true
    const envAdmins = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    let bootstrapped = 0
    if (envAdmins.length > 0) {
      const row = await queryOne<{ count: string }>(
        `UPDATE profiles
         SET is_admin = TRUE
         WHERE LOWER(email) = ANY($1) AND is_admin = FALSE
         RETURNING 1`,
        [envAdmins]
      )
      // queryOne returns the first row only, but we want the count. Use a
      // separate count query for clarity.
      void row
      const all = await query<{ id: string }>(
        `SELECT id FROM profiles
         WHERE LOWER(email) = ANY($1) AND is_admin = TRUE`,
        [envAdmins]
      )
      bootstrapped = all.length
    }

    return NextResponse.json({ ok: true, bootstrapped })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
