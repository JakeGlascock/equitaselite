import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import {
  getDeal,
  isMemberOfDealRoom,
  postDealMessage,
  listDealMessages,
  listDealRoomUserIds,
} from '@/lib/deals'

const PostSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

// GET /api/deals/[id]/messages — list visible messages in a deal room.
// Permission: caller must be an invited Sovereign OR the deal's
// concierge creator. Non-invited members get 403. Pinned messages
// surface first (handled in the lib SELECT), then chronological.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: dealId } = await ctx.params
  if (!(await isMemberOfDealRoom(dealId, userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const messages = await listDealMessages(dealId).catch(() => [])
  return NextResponse.json({ messages })
}

// POST /api/deals/[id]/messages — post into the room.
// Same permission gate as GET. Fan-out notifications to every other
// member of the room (in-app bell only for v1 — email digest can
// come later if message volume justifies it).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: dealId } = await ctx.params
  if (!(await isMemberOfDealRoom(dealId, userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  const message = await postDealMessage(dealId, userId, parsed.data.body)

  // Notify everyone in the room EXCEPT the poster. Fire-and-forget —
  // a flaky notifications table shouldn't block the message write.
  void (async () => {
    const deal = await getDeal(dealId).catch(() => null)
    if (!deal) return
    const recipients = (await listDealRoomUserIds(dealId)).filter(u => u !== userId)
    if (recipients.length === 0) return

    const author = await queryOne<{ full_name: string }>(
      `SELECT full_name FROM profiles WHERE id = $1`, [userId],
    ).catch(() => null)
    const authorName = author?.full_name ?? 'A member'
    const snippet    = parsed.data.body.replace(/\s+/g, ' ').slice(0, 160)

    for (const recipient of recipients) {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
              VALUES ($1, 'deal_message', $2, $3, $4, $5)`,
        [
          recipient,
          `${authorName} posted in ${deal.title}`,
          snippet,
          `/deals/${dealId}`,
          message.id,
        ],
      ).catch(() => undefined)
    }
  })()

  return NextResponse.json({ message }, { status: 201 })
}
