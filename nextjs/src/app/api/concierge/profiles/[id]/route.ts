import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'

const UpdateSchema = z.object({
  email:           z.string().email().optional(),
  full_name:       z.string().min(1).optional(),
  title:           z.string().optional(),
  firm_name:       z.string().min(1).optional(),
  location:        z.string().optional(),
  aum:             z.string().optional(),
  role:            z.enum(['angel', 'family_office']).optional(),
  sectors:         z.array(z.string()).optional(),
  stages:          z.array(z.string()).optional(),
  geography:       z.array(z.string()).optional(),
  check_size_min:  z.number().min(0).optional(),
  check_size_max:  z.number().min(0).optional(),
  risk_tolerance:  z.enum(['Conservative', 'Moderate', 'Aggressive']).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = UpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  // The WHERE clause is the auth check: only the concierge who manages this
  // profile can update it. Admins can re-assign via /api/admin/managed/[id].
  const updated = await queryOne(
    `UPDATE profiles SET
       email          = COALESCE($3,  email),
       full_name      = COALESCE($4,  full_name),
       title          = COALESCE($5,  title),
       firm_name      = COALESCE($6,  firm_name),
       location       = COALESCE($7,  location),
       aum            = COALESCE($8,  aum),
       role           = COALESCE($9,  role),
       sectors        = COALESCE($10, sectors),
       stages         = COALESCE($11, stages),
       geography      = COALESCE($12, geography),
       check_size_min = COALESCE($13, check_size_min),
       check_size_max = COALESCE($14, check_size_max),
       risk_tolerance = COALESCE($15, risk_tolerance)
     WHERE id = $1 AND managed_by = $2
     RETURNING *`,
    [
      id, userId,
      d.email ?? null, d.full_name ?? null, d.title ?? null,
      d.firm_name ?? null, d.location ?? null, d.aum ?? null,
      d.role ?? null,
      d.sectors ?? null, d.stages ?? null, d.geography ?? null,
      d.check_size_min ?? null, d.check_size_max ?? null,
      d.risk_tolerance ?? null,
    ]
  )

  if (!updated) {
    return NextResponse.json(
      { error: 'Not found, or you do not manage this profile.' },
      { status: 404 }
    )
  }
  return NextResponse.json(updated)
}
