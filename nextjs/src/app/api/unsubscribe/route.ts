import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

// One-click unsubscribe endpoint. No auth — the token is the auth.
// Used by:
//   - The /unsubscribe page's confirm button (POST with `token` in JSON body)
//   - Gmail's one-click List-Unsubscribe button (POST with form-encoded body)
//
// On success, the recipient sees a JSON ok. The page that POSTs this
// renders its own confirmation UI.

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  // Accept token from JSON body, form body, or query string. Gmail's
  // one-click POSTs with body `List-Unsubscribe=One-Click` and the token
  // in the URL — so we look in the URL first.
  let token = req.nextUrl.searchParams.get('t')
  if (!token) {
    const ct = (req.headers.get('content-type') ?? '').toLowerCase()
    try {
      if (ct.includes('application/json')) {
        token = (await req.json())?.token ?? null
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        const text = await req.text()
        const params = new URLSearchParams(text)
        token = params.get('token')
      }
    } catch { /* fall through */ }
  }

  if (!token || !UUID_RX.test(token)) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })
  }

  const updated = await queryOne<{ id: string }>(
    `UPDATE profiles
     SET email_notifications_enabled = FALSE
     WHERE unsubscribe_token = $1
     RETURNING id`,
    [token]
  )
  if (!updated) {
    return NextResponse.json({ error: 'Token not recognized' }, { status: 404 })
  }

  // Also clear any pending-digest state so re-enabling later doesn't trigger
  // a one-time deluge.
  try {
    await query('UPDATE match_digest_state SET last_sent_at = NOW() WHERE user_id = $1', [updated.id])
  } catch { /* match_digest_state may not exist yet on pre-Phase-3 environments */ }

  return NextResponse.json({ ok: true })
}
