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
    await query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership TEXT
         CHECK (membership IN ('access','select','sovereign'))`
    )
    await query(
      `CREATE INDEX IF NOT EXISTS profiles_membership_idx
         ON profiles (membership) WHERE membership IS NOT NULL`
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
