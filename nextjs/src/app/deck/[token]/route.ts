import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { query, queryOne } from '@/lib/db'
import { validateTokenRow } from '@/lib/preview'
import { publicUrl } from '@/lib/public-url'

interface TokenRow {
  token:        string
  kind:         'preview' | 'deck'
  expires_at:   Date | string
  max_views:    number
  view_count:   number
  revoked_at:   Date | string | null
  // these aren't used by deck validation but the existing validateTokenRow
  // requires the shape — left here for type compatibility.
  demo_profile_id: string | null
}

// GET /deck/[token] — token-gated access to the pitch deck.
//
// Implemented as a route handler so it can:
//   1. Validate the token before serving any deck bytes
//   2. Stream the HTML directly with a private content-type header,
//      bypassing Next.js's root layout. The deck has its own
//      <html>/<head>/<body> from Marp; wrapping it inside our layout
//      would double the document structure
//
// The deck HTML lives at nextjs/decks/pitch.html (generated from
// pitch.md via Marp, NOT exposed under /public). The only way to
// reach the file's contents is through this token-validated route.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const deniedUrl = (reason: string) =>
    publicUrl(req, `/deck-denied?reason=${reason}`)

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(deniedUrl('not_found'))
  }

  const row = await queryOne<TokenRow>(
    `SELECT token, kind, expires_at, max_views, view_count, revoked_at, demo_profile_id
     FROM preview_tokens
     WHERE token = $1 AND kind = 'deck'`,
    [token],
  ).catch(() => null)

  const v = validateTokenRow(row, new Date())
  if (!v.ok) {
    return NextResponse.redirect(deniedUrl(v.reason ?? 'not_found'))
  }

  // Audit bump. Best-effort — if this UPDATE fails the deck still
  // serves; we just lose a view-count tick.
  await query(
    `UPDATE preview_tokens
        SET view_count = view_count + 1,
            last_viewed_at = NOW()
      WHERE token = $1`,
    [token],
  ).catch(err => console.error('deck view_count bump failed:', err))

  // Read the generated HTML from disk and return it directly. The
  // deck-content path is never exposed publicly — only this route can
  // reach the file's bytes.
  let html: string
  try {
    html = await readFile(path.join(process.cwd(), 'decks', 'pitch.html'), 'utf-8')
  } catch (err) {
    console.error('deck: pitch.html missing on disk:', err)
    return NextResponse.redirect(deniedUrl('not_found'))
  }

  // Substitute the __PREVIEW_URL__ placeholder. pitch.md / pitch.html
  // must NEVER contain a real preview URL — that leaks the token into
  // git history permanently. The placeholder is replaced here per
  // request with a CTA appropriate to the audience. If paired-token
  // infrastructure lands later, this substitution can become a real
  // per-recipient preview URL based on the deck token.
  const previewCta = 'Reply to the email this came with — happy to send a personal preview link'
  html = html.replaceAll('__PREVIEW_URL__', previewCta)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type':                'text/html; charset=utf-8',
      'Cache-Control':               'private, no-store, max-age=0',
      'X-Robots-Tag':                'noindex, nofollow, noarchive, nosnippet',
      'Referrer-Policy':             'no-referrer',
      'X-Content-Type-Options':      'nosniff',
    },
  })
}
