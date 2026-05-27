import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { linkNextGen, unlinkNextGen } from '@/lib/family'

// P5 v1 — admin sets / clears a next-gen seat's parent link.
//
// Path: PUT /api/admin/users/:id/parent   { parent_profile_id: string | null }
//   :id is the NEXT-GEN profile id. parent_profile_id is the wealth-
//   holding seat the next-gen shadows. Self-serve "invite a next-gen"
//   is P5b; for v1 the admin is the only writer.
//
// Why a subroute instead of extending the big PATCH: the parent link
// has its own validation (target must have is_next_gen = TRUE, can't
// self-link) and will grow audit-log + notification fan-out in P5b.
// Keeping it isolated means those additions don't touch the role/
// membership/RM mutation path.

const PutSchema = z.object({
  parent_profile_id: z.string().min(1).nullable(),
})

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: nextGenId } = await ctx.params
  const parsed = PutSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Demo accounts opt out of every relational write — they're seed-
  // managed fixtures. Mirrors the guard on admin DELETE.
  if (nextGenId.startsWith('demo_')) {
    return NextResponse.json(
      { error: 'Demo profiles cannot be linked.' },
      { status: 400 },
    )
  }

  if (parsed.data.parent_profile_id === null) {
    await unlinkNextGen(nextGenId)
    return NextResponse.json({ ok: true, parent_profile_id: null })
  }

  const result = await linkNextGen(parsed.data.parent_profile_id, nextGenId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, parent_profile_id: parsed.data.parent_profile_id })
}
