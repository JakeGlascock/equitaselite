import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { getTier, type Tier } from '@/lib/membership'
import EventsClient, { type EventItem } from './EventsClient'

interface EventRow {
  id:          string
  title:       string
  description: string
  type:        EventItem['type']
  date:        Date | string
  duration:    string
  location:    string
  capacity:    number
  registered:  number    // pg COUNT()::int comes back as number
  min_tier:    Tier
  rsvped:      boolean
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : d
}

export default async function EventsPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')
  const tier = await getTier(userId)

  // Pull every event with its RSVP count and whether the caller has RSVPed.
  // The table may not yet exist if migration 010 hasn't landed — fall back
  // to an empty list so the page still renders cleanly.
  let upcoming: EventItem[] = []
  let past:     EventItem[] = []
  try {
    const rows = await query<EventRow>(
      `SELECT e.id, e.title, e.description, e.type, e.date, e.duration,
              e.location, e.capacity, e.min_tier,
              COUNT(r.user_id)::int                        AS registered,
              BOOL_OR(r.user_id = $1) IS TRUE              AS rsvped
       FROM events e
       LEFT JOIN event_rsvps r ON r.event_id = e.id
       GROUP BY e.id
       ORDER BY e.date ASC`,
      [userId]
    )
    const items: EventItem[] = rows.map(r => ({
      id:          r.id,
      title:       r.title,
      description: r.description,
      type:        r.type,
      date:        toIso(r.date),
      duration:    r.duration,
      location:    r.location,
      capacity:    r.capacity,
      registered:  Number(r.registered ?? 0),
      minTier:     r.min_tier,
      rsvped:      Boolean(r.rsvped),
    }))
    const now = Date.now()
    upcoming = items.filter(e => new Date(e.date).getTime() >= now)
    past     = items
      .filter(e => new Date(e.date).getTime() < now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch { /* events table not yet migrated */ }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Member-only</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Events</h1>
          <p className="text-ee-muted text-sm mt-1">
            Invitation-only summits, virtual roundtables with portfolio principals, and exclusive deal-flow showcases.
          </p>
        </div>

        <EventsClient currentTier={tier} upcoming={upcoming} past={past} />
      </div>
    </div>
  )
}
