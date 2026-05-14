import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

const PatchSchema = z.object({
  // null = unassign (orphan the managed profile until reassigned)
  managed_by: z.string().nullable(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const newConcierge = parsed.data.managed_by

  // Verify the target concierge actually exists + is a concierge
  if (newConcierge !== null) {
    const concierge = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = $1 AND is_concierge = TRUE',
      [newConcierge]
    )
    if (!concierge) {
      return NextResponse.json({ error: 'Target user is not a concierge.' }, { status: 400 })
    }
  }

  const updated = await queryOne<{ id: string; managed_by: string | null }>(
    `UPDATE profiles
     SET managed_by = $2
     WHERE id = $1 AND id LIKE 'managed_%'
     RETURNING id, managed_by`,
    [id, newConcierge]
  )

  if (!updated) {
    return NextResponse.json({ error: 'Managed account not found.' }, { status: 404 })
  }
  return NextResponse.json(updated)
}
