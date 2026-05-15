import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
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

export const dynamic = 'force-dynamic'

// /preview/[token] — token-gated entry into the investor preview.
// On a valid token: increment view_count, set the ee_preview cookie,
// redirect to /dashboard. The middleware threads the demo profile id
// through as x-user-id so the (app) layout renders exactly what that
// demo user would see.
export default async function PreviewEntryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Defensive token shape check — limits log volume from bad bots.
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return <Denied reason="not_found" />
  }

  const row = await queryOne<TokenRow>(
    `SELECT token, demo_profile_id, expires_at, max_views, view_count, revoked_at
     FROM preview_tokens WHERE token = $1`,
    [token],
  ).catch(() => null)

  const v = validateTokenRow(row, new Date())
  if (!v.ok) return <Denied reason={v.reason ?? 'not_found'} />

  // Confirm the target demo profile still exists. If the row was deleted
  // (or never seeded on this environment), fail gracefully.
  const profile = await queryOne<{ id: string }>(
    'SELECT id FROM profiles WHERE id = $1',
    [v.demoProfileId!],
  ).catch(() => null)
  if (!profile) return <Denied reason="not_found" />

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

  const jar = await cookies()
  jar.set(PREVIEW_COOKIE_NAME, v.demoProfileId!, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   PREVIEW_COOKIE_MAX_AGE,
  })

  redirect('/dashboard')
}

function Denied({ reason }: { reason: string }) {
  const copy: Record<string, { title: string; body: string }> = {
    not_found: { title: 'Link not found',  body: 'This preview link is no longer valid. Ask the person who shared it for a new one.' },
    revoked:   { title: 'Link revoked',    body: 'This preview link has been revoked. Reach out for a fresh one.' },
    expired:   { title: 'Link expired',    body: 'This preview link has expired. Ask for a new one — they\'re quick to issue.' },
    exhausted: { title: 'View limit reached', body: 'This preview link has been used too many times. Ask for a new one.' },
  }
  const { title, body } = copy[reason] ?? copy.not_found
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="glass-panel max-w-md w-full p-8 text-center space-y-3">
        <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-gold">Equitas Elite</p>
        <h1 className="font-display text-2xl text-ee-primary">{title}</h1>
        <p className="text-sm text-ee-muted leading-relaxed">{body}</p>
        <p className="pt-4">
          <a href="/" className="font-data text-[11px] tracking-widest uppercase text-ee-gold hover:underline">
            Back to home
          </a>
        </p>
      </div>
    </main>
  )
}
