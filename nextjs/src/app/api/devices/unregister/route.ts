import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

const Schema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  token:    z.string().min(16).max(512),
})

// POST /api/devices/unregister
//   Body: { platform, token }
//
// Marks the device's row as revoked (revoked_at = NOW()). Keeps the
// row for audit. Caller is the user who owns the token; the WHERE clause
// scopes by user_id so a stolen-session attacker can't drop someone
// else's tokens.
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { platform, token } = parsed.data

  await query(
    `UPDATE device_tokens
        SET revoked_at = NOW(),
            updated_at = NOW()
      WHERE user_id  = $1
        AND platform = $2
        AND token    = $3
        AND revoked_at IS NULL`,
    [userId, platform, token],
  )

  return NextResponse.json({ ok: true })
}
