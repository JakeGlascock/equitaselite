import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { ACTING_AS_COOKIE } from '@/lib/acting-as'

const SECURE = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const actualUserId = req.headers.get('x-user-id')
  if (!actualUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the caller manages this profile before issuing the cookie
  const profile = await queryOne<{ id: string; full_name: string }>(
    'SELECT id, full_name FROM profiles WHERE id = $1 AND managed_by = $2',
    [id, actualUserId]
  )
  if (!profile) {
    return NextResponse.json(
      { error: 'You do not manage this profile.' },
      { status: 403 }
    )
  }

  const res = NextResponse.json({ ok: true, profile })
  res.cookies.set(ACTING_AS_COOKIE, id, {
    httpOnly: true,
    secure:   SECURE,
    sameSite: 'lax',
    path:     '/',
    maxAge:   8 * 60 * 60, // 8h session
  })
  return res
}
