import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_concierge BOOLEAN NOT NULL DEFAULT FALSE`)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS managed_by   TEXT REFERENCES profiles(id) ON DELETE SET NULL`)
    await query(`CREATE INDEX IF NOT EXISTS profiles_is_concierge_idx ON profiles (is_concierge) WHERE is_concierge = TRUE`)
    await query(`CREATE INDEX IF NOT EXISTS profiles_managed_by_idx   ON profiles (managed_by) WHERE managed_by IS NOT NULL`)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
