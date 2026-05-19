import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getTier } from '@/lib/membership'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await queryOne(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(profile)
}

const UpdateSchema = z.object({
  email:           z.string().email().optional(),
  full_name:       z.string().min(1).optional(),
  title:           z.string().optional(),
  firm_name:       z.string().min(1).optional(),
  location:        z.string().optional(),
  aum:             z.string().optional(),
  sectors:         z.array(z.string()).optional(),
  stages:          z.array(z.string()).optional(),
  geography:       z.array(z.string()).optional(),
  check_size_min:  z.number().min(0).optional(),
  check_size_max:  z.number().min(0).optional(),
  risk_tolerance:  z.enum(['Conservative', 'Moderate', 'Aggressive']).optional(),
  expected_return: z.string().optional(),
  timeline:        z.string().optional(),
  mandate_type:    z.string().optional(),
  concentration:   z.string().optional(),
  email_notifications_enabled: z.boolean().optional(),
  // Off-Market mode (Sovereign-only). Tier-gating enforced below the schema —
  // a non-Sovereign caller is rejected with 403 before the UPDATE runs.
  is_off_market: z.boolean().optional(),
  // Multi-role identity (migration 034). User can self-toggle their
  // investor-side flags. is_concierge stays admin-only.
  is_angel:         z.boolean().optional(),
  is_family_office: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  // If the caller is trying to change `email`, it must match their JWT
  // email — same defense as in /api/onboarding. Prevents claiming
  // another invitee's unused email by editing your own profile.
  if (d.email !== undefined) {
    if (!userEmail || d.email.toLowerCase() !== userEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email can only be changed via Cognito.' },
        { status: 400 }
      )
    }
  }

  // Off-Market is Sovereign-only. Reject any non-Sovereign caller trying
  // to flip it on. (We also allow Sovereigns to flip it OFF freely;
  // the auto-flip on downgrade-grace expiry runs as the system in
  // lib/membership.ts, bypassing this gate.)
  if (d.is_off_market === true) {
    const tier = await getTier(userId)
    if (tier !== 'sovereign') {
      return NextResponse.json(
        { error: 'Off-Market mode requires the Sovereign tier.' },
        { status: 403 }
      )
    }
  }
  const profile = await queryOne(
    `UPDATE profiles SET
       email           = COALESCE($2,  email),
       full_name       = COALESCE($3,  full_name),
       title           = COALESCE($4,  title),
       firm_name       = COALESCE($5,  firm_name),
       location        = COALESCE($6,  location),
       aum             = COALESCE($7,  aum),
       sectors         = COALESCE($8,  sectors),
       stages          = COALESCE($9,  stages),
       geography       = COALESCE($10, geography),
       check_size_min  = COALESCE($11, check_size_min),
       check_size_max  = COALESCE($12, check_size_max),
       risk_tolerance  = COALESCE($13, risk_tolerance),
       expected_return = COALESCE($14, expected_return),
       timeline        = COALESCE($15, timeline),
       mandate_type    = COALESCE($16, mandate_type),
       concentration   = COALESCE($17, concentration),
       email_notifications_enabled = COALESCE($18, email_notifications_enabled),
       is_off_market   = COALESCE($19, is_off_market),
       -- Clearing off-market also clears any active grace timer — they're
       -- now visible by their own choice, no expiry needed.
       off_market_grace_until = CASE
         WHEN $19 = FALSE THEN NULL
         ELSE off_market_grace_until
       END,
       -- Multi-role identity (migration 034). User-controlled flags.
       is_angel         = COALESCE($20, is_angel),
       is_family_office = COALESCE($21, is_family_office),
       -- Keep the legacy role column in sync with the flags so Phase B/C
       -- read paths don't drift. Same CASE shape as the admin route.
       role = CASE
         WHEN COALESCE($20, is_angel) = TRUE AND COALESCE($21, is_family_office) = FALSE THEN 'angel'
         WHEN COALESCE($20, is_angel) = FALSE AND COALESCE($21, is_family_office) = TRUE THEN 'family_office'
         WHEN COALESCE($20, is_angel) = FALSE AND COALESCE($21, is_family_office) = FALSE THEN NULL
         ELSE role
       END
     WHERE id = $1
     RETURNING *`,
    [
      userId,
      d.email          ?? null,
      d.full_name      ?? null,
      d.title          ?? null,
      d.firm_name      ?? null,
      d.location       ?? null,
      d.aum            ?? null,
      d.sectors        ?? null,
      d.stages         ?? null,
      d.geography      ?? null,
      d.check_size_min ?? null,
      d.check_size_max ?? null,
      d.risk_tolerance ?? null,
      d.expected_return ?? null,
      d.timeline       ?? null,
      d.mandate_type   ?? null,
      d.concentration  ?? null,
      d.email_notifications_enabled ?? null,
      d.is_off_market  ?? null,
      d.is_angel         ?? null,
      d.is_family_office ?? null,
    ]
  )

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(profile)
}
