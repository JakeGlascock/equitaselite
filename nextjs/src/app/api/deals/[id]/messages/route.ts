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
import { getShadowState, notifyParentOfShadowAction } from '@/lib/shadow'

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

  // P5e — if the next-gen is shadowing, the action is "on behalf of"
  // the parent: authorization is checked against the parent's seat,
  // but the message row anchors to the actual next-gen's id (writes
  // never impersonate, see lib/shadow.ts). principalId is the seat
  // whose room membership we honor.
  const shadow      = await getShadowState()
  const principalId = shadow?.parentId ?? userId

  const { id: dealId } = await ctx.params
  if (!(await isMemberOfDealRoom(dealId, principalId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  const message = await postDealMessage(dealId, userId, parsed.data.body, shadow?.parentId ?? null)

  // Notify everyone in the room EXCEPT the poster (and the parent if
  // shadowing — they get a separate "next_gen_action" audit entry
  // below with attribution copy, so we don't double-bell them).
  // Fire-and-forget — a flaky notifications table shouldn't block
  // the message write.
  void (async () => {
    const deal = await getDeal(dealId).catch(() => null)
    if (!deal) return
    const recipients = (await listDealRoomUserIds(dealId))
      .filter(u => u !== userId && (!shadow || u !== shadow.parentId))
    const snippet = parsed.data.body.replace(/\s+/g, ' ').slice(0, 160)

    const author = await queryOne<{ full_name: string }>(
      `SELECT full_name FROM profiles WHERE id = $1`, [userId],
    ).catch(() => null)
    const authorName = author?.full_name ?? 'A member'

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

    if (shadow) {
      await notifyParentOfShadowAction({
        parentId:     shadow.parentId,
        nextGenId:    userId,
        nextGenName:  authorName,
        actionVerb:   'posted in',
        contextTitle: deal.title,
        bodySnippet:  snippet,
        linkUrl:      `/deals/${dealId}`,
        relatedId:    message.id,
      })
    }
  })()

  return NextResponse.json({ message }, { status: 201 })
}
