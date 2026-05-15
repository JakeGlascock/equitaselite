import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

// POST /api/concierge/welcome/[id] — mark a paying member as welcomed
// by the concierge team. Removes them from the onboarding queue on
// /concierge. Idempotent: stamps welcomed_at to NOW() on every call.
//
// Gated on is_concierge OR is_admin — both roles can clear the queue.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin shortcut — admins always have access
  const admin = await isUserAdmin(userId, userEmail)
  let allowed = admin
  if (!allowed) {
    try {
      const me = await queryOne<{ is_concierge: boolean | null }>(
        'SELECT is_concierge FROM profiles WHERE id = $1',
        [userId]
      )
      allowed = !!me?.is_concierge
    } catch { /* is_concierge column not yet migrated */ }
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const updated = await queryOne<{ id: string; welcomed_at: Date }>(
      `UPDATE profiles
       SET welcomed_at = NOW()
       WHERE id = $1
       RETURNING id, welcomed_at`,
      [id]
    )
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('welcomed_at')) {
      return NextResponse.json(
        { error: 'welcomed_at column missing — wait for the next deploy to run migration 013.' },
        { status: 400 }
      )
    }
    console.error('welcome PATCH failed:', err)
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/concierge/welcome/[id] — undo the welcome (rarely needed,
// but useful if someone clicks by accident).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await isUserAdmin(userId, userEmail)
  let allowed = admin
  if (!allowed) {
    try {
      const me = await queryOne<{ is_concierge: boolean | null }>(
        'SELECT is_concierge FROM profiles WHERE id = $1',
        [userId]
      )
      allowed = !!me?.is_concierge
    } catch { /* swallow */ }
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updated = await queryOne<{ id: string }>(
    `UPDATE profiles SET welcomed_at = NULL WHERE id = $1 RETURNING id`,
    [id]
  )
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
