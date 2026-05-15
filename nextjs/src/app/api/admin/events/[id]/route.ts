import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await ctx.params
  const deleted = await queryOne<{ id: string }>(
    'DELETE FROM events WHERE id = $1 RETURNING id',
    [id]
  )
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
