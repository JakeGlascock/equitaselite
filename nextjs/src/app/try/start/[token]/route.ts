import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { generateToken, PREVIEW_COOKIE_NAME, PREVIEW_COOKIE_MAX_AGE } from '@/lib/preview'
import { notifyStaffOfDemoSignup } from '@/lib/demo-mail'
import { publicUrl } from '@/lib/public-url'

// GET /try/start/[token] — magic-link consume.
//
// The prospect clicks the link in their email; we:
//   1. Validate the magic token (exists, not expired, not used)
//   2. Pick a random demo profile matching their requested role
//   3. Mint a preview_tokens row (kind='preview', short TTL, max_views)
//   4. Stamp demo_signups.verified_at + preview_token reference
//   5. Email staff with the verified lead
//   6. Set the ee_preview cookie + redirect to /dashboard
//
// On any failure, redirect to /try/expired with a reason in the query
// string for telemetry. The page treats any reason as "this link
// didn't work — request a fresh demo."

const DEMO_TTL_DAYS  = 1   // preview session lives 1 day from verify
const DEMO_MAX_VIEWS = 50

interface SignupRow {
  id:               string
  full_name:        string
  email:            string
  firm_name:        string
  aum_range:        string
  intended_use:     string
  viewing_as_role:  string
  ip_address:       string | null
  created_at:       Date | string
  magic_expires_at: Date | string
  verified_at:      Date | string | null
}

const ROLE_FLAG_COLUMN: Record<string, string> = {
  angel:             'is_angel',
  family_office:     'is_family_office',
  next_gen:          'is_next_gen',
  family_foundation: 'is_family_foundation',
  daf:               'is_daf',
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const expiredUrl = (reason: string) =>
    publicUrl(req, `/try/expired?reason=${reason}`)

  // Cheap pre-check before DB.
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(expiredUrl('not_found'))
  }

  const signup = await queryOne<SignupRow>(
    `SELECT id, full_name, email, firm_name, aum_range, intended_use,
            viewing_as_role, ip_address::text AS ip_address,
            created_at, magic_expires_at, verified_at
       FROM demo_signups
      WHERE magic_token = $1`,
    [token],
  ).catch(() => null)

  if (!signup) return NextResponse.redirect(expiredUrl('not_found'))
  if (signup.verified_at) {
    // Already used — clicking the link twice. Surface as expired
    // for simplicity; prospect can request a new demo.
    return NextResponse.redirect(expiredUrl('used'))
  }
  if (new Date(signup.magic_expires_at).getTime() <= Date.now()) {
    return NextResponse.redirect(expiredUrl('expired'))
  }

  // Pick a random demo profile matching the viewing-as role. The
  // boolean-flag column has a partial index, so this is cheap.
  const flagCol = ROLE_FLAG_COLUMN[signup.viewing_as_role]
  if (!flagCol) return NextResponse.redirect(expiredUrl('bad_role'))

  const demoProfile = await queryOne<{ id: string }>(
    `SELECT id FROM profiles
      WHERE id LIKE 'demo_%' AND ${flagCol} = TRUE
      ORDER BY random()
      LIMIT 1`,
  ).catch(() => null)

  if (!demoProfile) {
    // No demo profile of the requested role exists — staging gap.
    return NextResponse.redirect(expiredUrl('no_demo_profile'))
  }

  // Mint the preview token. Tagged kind='preview' so it surfaces in
  // /admin's existing audit list.
  const previewToken = generateToken()
  try {
    await query(
      `INSERT INTO preview_tokens
         (token, label, kind, demo_profile_id, expires_at, max_views, created_by)
       VALUES (
         $1,
         $2,
         'preview',
         $3,
         NOW() + ($4 || ' days')::interval,
         $5,
         -- created_by is FK to profiles(id) NOT NULL ON DELETE SET NULL.
         -- For self-service demo signups there's no admin user; use the
         -- demo profile itself so the FK is satisfied.
         $3
       )`,
      [previewToken, `Demo: ${signup.full_name}`, demoProfile.id, String(DEMO_TTL_DAYS), DEMO_MAX_VIEWS],
    )
  } catch (err) {
    console.error('demo preview-token mint failed:', err)
    return NextResponse.redirect(expiredUrl('mint_failed'))
  }

  // Stamp the verification + link the preview token. Best-effort —
  // if this fails the demo still works, just the audit row is stale.
  await query(
    `UPDATE demo_signups
        SET verified_at = NOW(), preview_token = $1
      WHERE id = $2`,
    [previewToken, signup.id],
  ).catch(err => console.error('demo_signups verify update failed:', err))

  // Staff notify — runs AFTER verify so unverified attempts stay quiet.
  await notifyStaffOfDemoSignup({
    fullName:        signup.full_name,
    email:           signup.email,
    firmName:        signup.firm_name,
    aumRange:        signup.aum_range,
    intendedUse:     signup.intended_use,
    viewingAsRole:   signup.viewing_as_role,
    ip:              signup.ip_address,
    signupCreatedAt: new Date(signup.created_at),
  }).catch(err => console.error('demo staff-notify failed:', err))

  // Set the ee_preview cookie and redirect to /dashboard. Middleware +
  // /lib/matches.ts already scope this session to demo profiles only.
  const res = NextResponse.redirect(publicUrl(req, '/dashboard'))
  res.cookies.set(PREVIEW_COOKIE_NAME, demoProfile.id, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   PREVIEW_COOKIE_MAX_AGE,
  })
  return res
}
