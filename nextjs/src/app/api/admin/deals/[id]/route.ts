import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { query } from '@/lib/db'
import { getDeal, updateDealStatus } from '@/lib/deals'

const PatchSchema = z.object({
  status: z.enum(['open', 'closed', 'filled']),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await ctx.params
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const deal = await getDeal(id)
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await updateDealStatus(id, parsed.data.status)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await ctx.params
  await query(`DELETE FROM deals WHERE id = $1`, [id])
  return NextResponse.json({ ok: true })
}
