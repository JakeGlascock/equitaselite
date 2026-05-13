import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'

const RespondSchema = z.object({
  status: z.enum(['accepted', 'declined']),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = RespondSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const updated = await queryOne(
    `UPDATE introductions
     SET status = $3, responded_at = NOW()
     WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, userId, parsed.data.status]
  )

  if (!updated) {
    return NextResponse.json(
      { error: 'Not found, already responded, or you are not the recipient' },
      { status: 404 }
    )
  }

  return NextResponse.json(updated)
}
