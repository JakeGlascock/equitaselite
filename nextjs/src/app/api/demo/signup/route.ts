import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { verifyTurnstile } from '@/lib/turnstile'
import { sendDemoMagicLink } from '@/lib/demo-mail'
import { publicUrl } from '@/lib/public-url'
import { generateToken } from '@/lib/preview'

// Public demo signup. Phase F2 of the role-types expansion + public
// demo work. Flow:
//   1. Validates the lead form
//   2. Verifies Turnstile (gated on TURNSTILE_SECRET_KEY presence)
//   3. Soft rate-limit per IP (3 signups / 10 min)
//   4. Creates a demo_signups row with a 30-minute magic-link window
//   5. Emails the prospect a magic link
//
// On success the client redirects to /try/check-email. No preview
// token is minted here — that happens at /try/start/[token] after the
// magic link is clicked. Staff are notified at the verify step, not
// here, so unverified attempts don't generate noise.

const AUM_OPTIONS = ['<$10M', '$10M–$50M', '$50M–$250M', '$250M–$1B', '>$1B'] as const
const USE_OPTIONS = [
  'Learning about LPs',
  'Actively allocating',
  'Evaluating for our family office',
  'Just curious',
] as const
const ROLE_OPTIONS = ['angel', 'family_office', 'next_gen', 'family_foundation', 'daf'] as const

const MAGIC_TTL_MIN = 30

const SignupSchema = z.object({
  full_name:        z.string().trim().min(2).max(120),
  email:            z.string().trim().email().max(254),
  firm_name:        z.string().trim().min(2).max(160),
  aum_range:        z.enum(AUM_OPTIONS),
  intended_use:     z.enum(USE_OPTIONS),
  viewing_as_role:  z.enum(ROLE_OPTIONS),
  turnstile_token:  z.string().min(1).max(4096).optional(),
})

function clientIp(req: NextRequest): string | null {
  // ALB forwards client IP in x-forwarded-for. The first hop is the
  // public client; subsequent hops are AWS internals.
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || null
  return req.headers.get('x-real-ip') || null
}

export async function POST(req: NextRequest) {
  const parsed = SignupSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid submission' },
      { status: 400 },
    )
  }

  const ip = clientIp(req)

  // Turnstile (silently skips if not configured — see lib/turnstile.ts).
  const turnstileOk = await verifyTurnstile(parsed.data.turnstile_token, ip)
  if (!turnstileOk) {
    return NextResponse.json({ error: 'Anti-spam check failed. Refresh and try again.' }, { status: 400 })
  }

  // Soft rate limit per IP: 3 signups / 10 minutes. The WAF rate-limit
  // rule is the hard ceiling; this is a friendly app-level check.
  if (ip) {
    const recent = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM demo_signups
        WHERE ip_address = $1::inet
          AND created_at > NOW() - INTERVAL '10 minutes'`,
      [ip],
    ).catch(() => null)
    if (recent && recent.n >= 3) {
      return NextResponse.json(
        { error: 'Too many signups from this network recently. Try again in a few minutes.' },
        { status: 429 },
      )
    }
  }

  const magicToken = generateToken()
  const magicUrl   = publicUrl(req, `/try/start/${magicToken}`).toString()

  try {
    await query(
      `INSERT INTO demo_signups (
         magic_token, full_name, email, firm_name,
         aum_range, intended_use, viewing_as_role,
         ip_address, magic_expires_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         $8::inet, NOW() + ($9 || ' minutes')::interval
       )`,
      [
        magicToken,
        parsed.data.full_name,
        parsed.data.email.toLowerCase(),
        parsed.data.firm_name,
        parsed.data.aum_range,
        parsed.data.intended_use,
        parsed.data.viewing_as_role,
        ip,
        String(MAGIC_TTL_MIN),
      ],
    )
  } catch (err) {
    console.error('demo signup insert failed:', err)
    return NextResponse.json({ error: 'Could not record signup. Please try again.' }, { status: 500 })
  }

  try {
    await sendDemoMagicLink({
      toEmail:        parsed.data.email,
      fullName:       parsed.data.full_name,
      magicUrl,
      expiresMinutes: MAGIC_TTL_MIN,
    })
  } catch (err) {
    console.error('demo magic-link email failed:', err)
    // Don't surface the SES error to the prospect; the row is on file
    // and staff can manually re-trigger. Return generic-success so the
    // client redirects to the check-email page consistently.
  }

  return NextResponse.json({ ok: true, expires_in_minutes: MAGIC_TTL_MIN })
}
