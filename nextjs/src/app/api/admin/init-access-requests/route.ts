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
    await query(`
      CREATE TABLE IF NOT EXISTS access_requests (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email        TEXT NOT NULL,
        full_name    TEXT NOT NULL,
        firm_name    TEXT NOT NULL,
        role         TEXT NOT NULL CHECK (role IN ('angel', 'family_office')),
        notes        TEXT,
        status       TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'invited', 'declined')) DEFAULT 'new',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        handled_at   TIMESTAMPTZ,
        handled_by   TEXT REFERENCES profiles(id) ON DELETE SET NULL
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests (status, created_at DESC)`)
    await query(`CREATE INDEX IF NOT EXISTS access_requests_email_idx  ON access_requests (LOWER(email))`)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
