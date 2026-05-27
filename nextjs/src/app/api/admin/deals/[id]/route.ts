import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { query } from '@/lib/db'
import { getDeal, updateDealStatus, updateDealConciergeNote } from '@/lib/deals'

// PATCH accepts either {status} or {concierge_note} or both. At least
// one must be present. Caller's user id becomes the note's author
// when the concierge_note path is taken — keeps the attribution
// honest even when an admin edits a previously-set note.
const PatchSchema = z.object({
  status:         z.enum(['open', 'closed', 'filled']).optional(),
  // P3 — empty string / null both clear the note + author + ts.
  concierge_note: z.string().max(4000).nullable().optional(),
}).refine(
  d => d.status !== undefined || d.concierge_note !== undefined,
  { message: 'Provide a status or concierge_note to update.' },
)

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
  if (parsed.data.status !== undefined) {
    await updateDealStatus(id, parsed.data.status)
  }
  if (parsed.data.concierge_note !== undefined) {
    await updateDealConciergeNote(id, parsed.data.concierge_note, adminId!)
  }
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
