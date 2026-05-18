import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'

// PATCH handler for the Phase 6 mandate-pillar fields. Each field is
// optional — the UI sends only what the user touched. Existing values
// (and DB defaults) are preserved via COALESCE for nullable columns,
// and the array columns use the same "send the full new list or omit"
// pattern as the legacy /api/me route.
//
// This endpoint deliberately does NOT touch the legacy mandate fields
// (sectors, stages, geography, etc.) — those still live on PATCH /api/me
// and the onboarding form. Splitting keeps the SQL bounded.

const ArrayField = z.array(z.string().trim().min(1).max(80)).max(40)

const PillarPatchSchema = z.object({
  // Pillar 1 — Strategic scope
  sub_sectors:    ArrayField.optional(),
  anti_sectors:   ArrayField.optional(),
  thematic_focus: ArrayField.optional(),

  // Pillar 2 — Capital mechanics
  lead_capacity: z.enum(['lead', 'follow', 'either']).nullable().optional(),

  // Pillar 3 — Time & risk
  holding_period_target_years: z.number().min(0).max(50).nullable().optional(),
  loss_appetite:               z.enum(['low', 'moderate', 'high']).nullable().optional(),

  // Pillar 4 — Governance & engagement
  engagement_style: z.enum(['board', 'observer', 'advisory', 'passive']).nullable().optional(),
  diligence_depth:  z.enum(['light', 'standard', 'deep']).nullable().optional(),

  // Pillar 5 — Counterparty
  min_counterparty_tier: z.enum(['access', 'select', 'sovereign']).nullable().optional(),

  // Pillar 6 — Values
  esg_required:      z.boolean().optional(),
  impact_themes:     ArrayField.optional(),
  values_exclusions: ArrayField.optional(),
}).refine(
  d => Object.keys(d).length > 0,
  { message: 'Provide at least one field to update.' }
)

export async function PATCH(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PillarPatchSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first.path.length ? `${first.path.join('.')}: ` : ''
    return NextResponse.json(
      { error: `${where}${first.message}`, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const d = parsed.data

  const updated = await queryOne(
    `UPDATE profiles SET
       sub_sectors                 = COALESCE($2,  sub_sectors),
       anti_sectors                = COALESCE($3,  anti_sectors),
       thematic_focus              = COALESCE($4,  thematic_focus),
       lead_capacity               = CASE WHEN $5::boolean  THEN $6::text     ELSE lead_capacity               END,
       holding_period_target_years = CASE WHEN $7::boolean  THEN $8::numeric  ELSE holding_period_target_years END,
       loss_appetite               = CASE WHEN $9::boolean  THEN $10::text    ELSE loss_appetite               END,
       engagement_style            = CASE WHEN $11::boolean THEN $12::text    ELSE engagement_style            END,
       diligence_depth             = CASE WHEN $13::boolean THEN $14::text    ELSE diligence_depth             END,
       min_counterparty_tier       = CASE WHEN $15::boolean THEN $16::text    ELSE min_counterparty_tier       END,
       esg_required                = COALESCE($17, esg_required),
       impact_themes               = COALESCE($18, impact_themes),
       values_exclusions           = COALESCE($19, values_exclusions)
     WHERE id = $1
     RETURNING id, sub_sectors, anti_sectors, thematic_focus,
               lead_capacity, holding_period_target_years, loss_appetite,
               engagement_style, diligence_depth, min_counterparty_tier,
               esg_required, impact_themes, values_exclusions`,
    [
      userId,
      d.sub_sectors    ?? null,
      d.anti_sectors   ?? null,
      d.thematic_focus ?? null,
      // The CASE-WHEN pattern lets the caller explicitly clear a value
      // (send null) without us conflating "not provided" with "set to null".
      d.lead_capacity              !== undefined, d.lead_capacity              ?? null,
      d.holding_period_target_years !== undefined, d.holding_period_target_years ?? null,
      d.loss_appetite              !== undefined, d.loss_appetite              ?? null,
      d.engagement_style           !== undefined, d.engagement_style           ?? null,
      d.diligence_depth            !== undefined, d.diligence_depth            ?? null,
      d.min_counterparty_tier      !== undefined, d.min_counterparty_tier      ?? null,
      d.esg_required      ?? null,
      d.impact_themes     ?? null,
      d.values_exclusions ?? null,
    ]
  )

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
