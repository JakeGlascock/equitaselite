import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getEffectiveUserId } from '@/lib/acting-as'
import { getTier, priorityRank, type Tier } from '@/lib/membership'

// POST /api/events/[id]/rsvp — caller RSVPs to the event.
// Tier-gated by the event's min_tier. Capacity is also enforced.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await queryOne<{ id: string; min_tier: Tier; capacity: number; date: Date }>(
    'SELECT id, min_tier, capacity, date FROM events WHERE id = $1',
    [id]
  )
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (new Date(event.date).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Event has already passed' }, { status: 400 })
  }

  const tier = await getTier(userId)
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
    await query(
      `INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [id, userId]
    )
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
