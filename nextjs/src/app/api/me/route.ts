import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
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
  // Multi-role identity (migration 034 + 035). User can self-toggle
  // all investor-side flags. is_concierge stays admin-only.
  is_angel:             z.boolean().optional(),
  is_family_office:     z.boolean().optional(),
  is_next_gen:          z.boolean().optional(),
  is_family_foundation: z.boolean().optional(),
  is_daf:               z.boolean().optional(),
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
       -- Multi-role identity (migration 034 + 035). User-controlled
       -- investor-side flags. is_concierge stays admin-only.
       is_angel             = COALESCE($20, is_angel),
       is_family_office     = COALESCE($21, is_family_office),
       is_next_gen          = COALESCE($22, is_next_gen),
       is_family_foundation = COALESCE($23, is_family_foundation),
       is_daf               = COALESCE($24, is_daf),
       -- Keep the legacy role column in sync with Angel/FO only. The
       -- three migration-035 roles don't map back to the binary role
       -- column — they live exclusively in their boolean flags and the
       -- mandates table. role stays as Angel-or-FO-or-null for now.
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
      d.is_angel             ?? null,
      d.is_family_office     ?? null,
      d.is_next_gen          ?? null,
      d.is_family_foundation ?? null,
      d.is_daf               ?? null,
    ]
  )

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Per-role mandate edit (Phase D2). When ?role=angel|family_office is
  // present, also upsert the mandate fields to mandates(profile_id, role).
  // Lets multi-role users keep distinct mandates per role; the profile
  // columns stay populated as a denormalized cache (Phase D drops them).
  // Profile-level fields (name, firm, title, location, email pref, flags)
  // are NEVER per-role — they always go to profiles only.
  const url       = new URL(req.url)
  const roleParam = url.searchParams.get('role')
  const validMandateRoles = ['angel', 'family_office', 'next_gen', 'family_foundation', 'daf'] as const
  if (validMandateRoles.includes(roleParam as typeof validMandateRoles[number])) {
    const anyMandateField = d.sectors !== undefined
      || d.stages !== undefined  || d.geography !== undefined
      || d.check_size_min !== undefined || d.check_size_max !== undefined
      || d.risk_tolerance !== undefined
      || d.expected_return !== undefined || d.timeline !== undefined
      || d.mandate_type !== undefined  || d.concentration !== undefined
      || d.aum !== undefined
    if (anyMandateField) {
      try {
        await query(
          `INSERT INTO mandates (
             profile_id, role,
             sectors, stages, geography,
             check_size_min, check_size_max, risk_tolerance,
             expected_return, timeline, mandate_type, concentration,
             aum
           ) VALUES (
             $1, $2,
             COALESCE($3, '{}'), COALESCE($4, '{}'), COALESCE($5, '{}'),
             COALESCE($6, 0),    COALESCE($7, 0),    $8,
             $9, $10, $11, $12,
             $13
           )
           ON CONFLICT (profile_id, role) DO UPDATE SET
             sectors        = COALESCE($3,  mandates.sectors),
             stages         = COALESCE($4,  mandates.stages),
             geography      = COALESCE($5,  mandates.geography),
             check_size_min = COALESCE($6,  mandates.check_size_min),
             check_size_max = COALESCE($7,  mandates.check_size_max),
             risk_tolerance = COALESCE($8,  mandates.risk_tolerance),
             expected_return = COALESCE($9, mandates.expected_return),
             timeline       = COALESCE($10, mandates.timeline),
             mandate_type   = COALESCE($11, mandates.mandate_type),
             concentration  = COALESCE($12, mandates.concentration),
             aum            = COALESCE($13, mandates.aum),
             updated_at = NOW()`,
          [
            userId, roleParam,
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
            d.aum            ?? null,
          ],
        )
      } catch {
        // Pre-034 — mandates table absent. Profile UPDATE above already
        // saved the data to denormalized columns; the COALESCE fallback
        // in getCandidates handles it. Silent no-op.
      }
    }
  }

  return NextResponse.json(profile)
}
