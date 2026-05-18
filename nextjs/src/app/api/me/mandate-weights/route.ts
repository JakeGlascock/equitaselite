import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'

// PATCH handler for the per-user mandate_weights JSONB column. Each
// pillar weight is 0-100 and the six must sum to exactly 100 — the
// scoring code in lib/scoring.ts normalizes defensively, but enforcing
// the invariant on save keeps the data clean and the UX honest.

const WeightsSchema = z.object({
  scope:        z.number().int().min(0).max(100),
  capital:      z.number().int().min(0).max(100),
  timeRisk:     z.number().int().min(0).max(100),
  governance:   z.number().int().min(0).max(100),
  counterparty: z.number().int().min(0).max(100),
  values:       z.number().int().min(0).max(100),
}).refine(
  d => d.scope + d.capital + d.timeRisk + d.governance + d.counterparty + d.values === 100,
  { message: 'Weights must sum to 100.' }
)

export async function PATCH(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = WeightsSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first.message }, { status: 400 })
  }

  const updated = await queryOne(
    `UPDATE profiles
     SET mandate_weights = $2::jsonb
     WHERE id = $1
     RETURNING id, mandate_weights`,
    [userId, JSON.stringify(parsed.data)]
  )

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
