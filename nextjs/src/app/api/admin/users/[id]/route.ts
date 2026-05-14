import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

const PatchSchema = z.object({
  is_admin: z.boolean(),
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

  // Safety: don't let an admin revoke their own access (could lock everyone
  // out if they're the last admin).
  if (id === userId && parsed.data.is_admin === false) {
    return NextResponse.json(
      { error: 'You cannot revoke your own admin access. Ask another admin to do it.' },
      { status: 400 }
    )
  }

  const updated = await queryOne<{ id: string; is_admin: boolean }>(
    `UPDATE profiles
     SET is_admin = $2
     WHERE id = $1
     RETURNING id, is_admin`,
    [id, parsed.data.is_admin]
  )

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
