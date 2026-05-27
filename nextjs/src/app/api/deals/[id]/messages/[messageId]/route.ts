import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import {
  getDeal,
  getDealMessage,
  setDealMessagePinned,
  removeDealMessage,
} from '@/lib/deals'

const PatchSchema = z.object({
  // Three possible mutations. At least one must be present.
  pinned:  z.boolean().optional(),
  removed: z.literal(true).optional(),
}).refine(
  d => d.pinned !== undefined || d.removed !== undefined,
  { message: 'Provide pinned or removed.' },
)

// PATCH /api/deals/[id]/messages/[messageId] — moderation actions.
// Permission: admin OR the deal's created_by (the concierge/admin
// who set up the room). Non-creators can't moderate even if they're
// invited Sovereigns — keeps the curation role explicit.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: dealId, messageId } = await ctx.params

  const deal = await getDeal(dealId)
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = await isUserAdmin(userId, userEmail)
  const creator = deal.created_by === userId
  if (!admin && !creator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const message = await getDealMessage(messageId)
  if (!message || message.deal_id !== dealId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  if (parsed.data.pinned !== undefined) {
    await setDealMessagePinned(messageId, parsed.data.pinned)
  }
  if (parsed.data.removed === true) {
    await removeDealMessage(messageId, userId)
  }
  return NextResponse.json({ ok: true })
}
