import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { validateTokenRow, PREVIEW_COOKIE_NAME, PREVIEW_COOKIE_MAX_AGE } from '@/lib/preview'

interface TokenRow {
  token:            string
  demo_profile_id:  string
  expires_at:       Date | string
  max_views:        number
  view_count:       number
  revoked_at:       Date | string | null
}

// GET /preview/[token] — token-gated entry into the investor preview.
//
// Implemented as a route handler (not a page) because we need to set the
// ee_preview cookie before redirecting, and Next.js only permits cookie
// mutations in route handlers and server actions — not in server-rendered
// pages.
//
// On success: bump view_count, set the ee_preview cookie, redirect to
// /dashboard. Middleware threads the demo profile id through as
// x-user-id so the (app) layout renders exactly what that demo user
// would see.
//
// On any failure: redirect to /preview-denied?reason=<reason>, which
// renders a styled error panel.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const deniedUrl = (reason: string) =>
    new URL(`/preview-denied?reason=${reason}`, req.url)

  // Cheap regex pre-check so DB doesn't get hit for obviously-bad inputs.
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(deniedUrl('not_found'))
  }

  const row = await queryOne<TokenRow>(
    `SELECT token, demo_profile_id, expires_at, max_views, view_count, revoked_at
     FROM preview_tokens WHERE token = $1`,
    [token],
  ).catch(() => null)

  const v = validateTokenRow(row, new Date())
  if (!v.ok) {
    return NextResponse.redirect(deniedUrl(v.reason ?? 'not_found'))
  }

  // The target demo profile must still exist. If the row was deleted
  // (or never seeded on this environment), fail gracefully.
  const profile = await queryOne<{ id: string }>(
    'SELECT id FROM profiles WHERE id = $1',
    [v.demoProfileId!],
  ).catch(() => null)
  if (!profile) {
    return NextResponse.redirect(deniedUrl('not_found'))
  }

  // Bump audit counters. Best-effort — if this UPDATE fails the cookie
  // still gets set and the preview still works, which is the user's
  // intent. We just lose a single view-count tick.
  await query(
    `UPDATE preview_tokens
        SET view_count = view_count + 1,
            last_viewed_at = NOW()
      WHERE token = $1`,
    [token],
  ).catch(err => console.error('preview view_count bump failed:', err))

  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  res.cookies.set(PREVIEW_COOKIE_NAME, v.demoProfileId!, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   PREVIEW_COOKIE_MAX_AGE,
  })
  return res
}
