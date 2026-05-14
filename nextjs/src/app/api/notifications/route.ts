import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getEffectiveUserId } from '@/lib/acting-as'

export async function GET(req: NextRequest) {
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await query(
      `SELECT id, type, title, body, link_url, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    )
    return NextResponse.json(rows)
  } catch {
    // Table may not exist yet (admin hasn't initialized it). Treat as empty.
    return NextResponse.json([])
  }
}
