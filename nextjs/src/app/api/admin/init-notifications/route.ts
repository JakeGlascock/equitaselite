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
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        type        TEXT NOT NULL CHECK (type IN ('intro_requested', 'intro_accepted', 'intro_declined')),
        title       TEXT NOT NULL,
        body        TEXT,
        link_url    TEXT,
        related_id  TEXT,
        is_read     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
        ON notifications (user_id, is_read) WHERE is_read = FALSE
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS notifications_user_created_idx
        ON notifications (user_id, created_at DESC)
    `)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
