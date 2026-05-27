import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { SHADOW_COOKIE, SHADOW_COOKIE_MAX_AGE_SECONDS } from '@/lib/shadow'

// P5b — caller-owned shadow-view session management.
//   POST   /api/me/shadow   — enable. No body required; the parent is
//                              resolved from the caller's profile so
//                              the client can't ask to shadow an
//                              arbitrary seat.
//   DELETE /api/me/shadow   — disable. Clears the cookie. Always
//                              succeeds, even if the cookie wasn't
//                              actually set.
//
// The shadow is gated server-side at every read pivot via
// getShadowState() and at every write via middleware. These two routes
// are the ONLY paths that mint or clear the cookie.

const SECURE = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The next-gen must (a) actually be a next-gen and (b) have a
  // parent linked. Resolve both in one query so the response doesn't
  // leak which check failed (single 400 either way).
  type Row = { id: string; parent_id: string; parent_name: string; parent_firm: string }
  const row = await queryOne<Row>(
    `SELECT me.id,
            p.id          AS parent_id,
            p.full_name   AS parent_name,
            p.firm_name   AS parent_firm
       FROM profiles me
       JOIN profiles p ON p.id = me.parent_profile_id
      WHERE me.id = $1
        AND me.is_next_gen = TRUE`,
    [userId],
  ).catch(() => null)

  if (!row) {
    return NextResponse.json(
      { error: 'Shadow view is only available to next-gen seats linked to a parent.' },
      { status: 400 },
    )
  }

  // Audit notification on the PARENT's feed. One row per enable;
  // per-view logging is intentionally not done (see lib/shadow.ts).
  await query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, 'next_gen_shadow', $2::jsonb)`,
    [row.parent_id, JSON.stringify({
      next_gen_id:   userId,
      enabled_at:    new Date().toISOString(),
    })],
  ).catch(err => {
    // Notification fan-out failure shouldn't block enabling the
    // shadow — the session is still safe, the parent just doesn't
    // get the bell. Log and continue.
    console.error('shadow audit notification failed:', err)
  })

  const res = NextResponse.json({
    ok: true,
    parent: { id: row.parent_id, full_name: row.parent_name, firm_name: row.parent_firm },
  })
  res.cookies.set(SHADOW_COOKIE, row.parent_id, {
    httpOnly: true,
    secure:   SECURE,
    sameSite: 'lax',
    path:     '/',
    maxAge:   SHADOW_COOKIE_MAX_AGE_SECONDS,
  })
  return res
}

export async function DELETE(req: NextRequest) {
  // No auth check beyond the middleware's x-user-id requirement —
  // clearing your own cookie is always allowed, even if the underlying
  // link has been revoked (in fact ESPECIALLY then, so stale cookies
  // can be evicted).
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SHADOW_COOKIE, '', {
    httpOnly: true,
    secure:   SECURE,
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  })
  return res
}
