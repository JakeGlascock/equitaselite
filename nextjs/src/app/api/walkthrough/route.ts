import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

const Schema = z.object({
  action: z.enum(['complete', 'replay']),
})

// POST /api/walkthrough
//   { action: 'complete' } → stamp walkthrough_seen_at = NOW() (idempotent)
//   { action: 'replay' }   → clear walkthrough_seen_at so the tour fires again
//
// "complete" is sent whether the user finished the tour or skipped it.
// "replay" is wired to the "Show the tour again" button on /profile.
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const sql = parsed.data.action === 'complete'
    ? 'UPDATE profiles SET walkthrough_seen_at = NOW()  WHERE id = $1'
    : 'UPDATE profiles SET walkthrough_seen_at = NULL   WHERE id = $1'

  await query(sql, [userId])
  return NextResponse.json({ ok: true })
}
