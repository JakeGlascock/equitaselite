import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getEffectiveUserId } from '@/lib/acting-as'
import { getTier, priorityRank, type Tier } from '@/lib/membership'
import { getShadowState, notifyParentOfShadowAction } from '@/lib/shadow'

// POST /api/events/[id]/rsvp — caller RSVPs to the event.
// Tier-gated by the event's min_tier. Capacity is also enforced.
//
// P5e — if a next-gen is shadowing the parent, the tier check uses
// the PARENT'S tier (the action is on behalf of the parent) but the
// RSVP row anchors to the next-gen's user_id with shadowed_parent_id
// capturing the parent for attribution. Parent gets a notification.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shadow      = await getShadowState()
  const principalId = shadow?.parentId ?? userId

  const event = await queryOne<{ id: string; title: string; min_tier: Tier; capacity: number; date: Date }>(
    'SELECT id, title, min_tier, capacity, date FROM events WHERE id = $1',
    [id]
  )
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (new Date(event.date).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Event has already passed' }, { status: 400 })
  }

  const tier = await getTier(principalId)
  if (priorityRank(tier) > priorityRank(event.min_tier)) {
    return NextResponse.json(
      { error: `Your plan doesn't include this event.`, upgradeRequired: event.min_tier },
      { status: 402 }
    )
  }

  // Capacity check + insert in a single round trip
  const existing = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM event_rsvps WHERE event_id = $1`,
    [id]
  )
  if (Number(existing?.count ?? 0) >= event.capacity) {
    return NextResponse.json({ error: 'Event is at capacity' }, { status: 409 })
  }

  try {
    try {
      await query(
        `INSERT INTO event_rsvps (event_id, user_id, shadowed_parent_id) VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [id, userId, shadow?.parentId ?? null]
      )
    } catch {
      // Pre-046 fallback. Original column set; shadow attribution lost
      // until the migration lands.
      await query(
        `INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2)
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [id, userId]
      )
    }

    if (shadow) {
      const author = await queryOne<{ full_name: string }>(
        `SELECT full_name FROM profiles WHERE id = $1`, [userId],
      ).catch(() => null)
      void notifyParentOfShadowAction({
        parentId:     shadow.parentId,
        nextGenId:    userId,
        nextGenName:  author?.full_name ?? 'Your next-gen',
        actionVerb:   'RSVPed to',
        contextTitle: event.title,
        linkUrl:      `/events`,
        relatedId:    event.id,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/events/[id]/rsvp — caller un-RSVPs from the event.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await query(
    `DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2`,
    [id, userId]
  )
  return NextResponse.json({ ok: true })
}
