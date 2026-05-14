import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

const PatchSchema = z.object({
  status: z.enum(['new', 'contacted', 'invited', 'declined']),
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
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updated = await queryOne(
    `UPDATE access_requests
     SET status     = $2,
         handled_at = CASE WHEN $2 = 'new' THEN NULL ELSE NOW() END,
         handled_by = CASE WHEN $2 = 'new' THEN NULL ELSE $3 END
     WHERE id = $1
     RETURNING *`,
    [id, parsed.data.status, userId]
  )

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
