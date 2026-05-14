import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getEffectiveUserId } from '@/lib/acting-as'

export async function POST(req: NextRequest) {
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  )
  return NextResponse.json({ ok: true })
}
