import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

function isAdmin(email: string | null): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return admins.includes(email.toLowerCase())
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req.headers.get('x-user-email'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await query(
      `ALTER TABLE profiles
       ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
