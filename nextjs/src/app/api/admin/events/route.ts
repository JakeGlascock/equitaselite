import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

const CreateSchema = z.object({
  title:       z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(2000),
  type:        z.enum(['Summit', 'Roundtable', 'Webinar', 'Showcase']),
  date:        z.string().datetime(),
  duration:    z.string().trim().min(1).max(80),
  location:    z.string().trim().min(1).max(120),
  capacity:    z.number().int().positive().max(5000),
  min_tier:    z.enum(['access', 'select', 'sovereign']),
})

export async function GET(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const rows = await query(
    `SELECT e.id, e.title, e.type, e.date, e.duration, e.location, e.capacity,
            e.min_tier, COUNT(r.user_id)::int AS registered
     FROM events e
     LEFT JOIN event_rsvps r ON r.event_id = e.id
     GROUP BY e.id
     ORDER BY e.date DESC`
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: `${first.path.join('.')}: ${first.message}` },
      { status: 400 }
    )
  }
  const d = parsed.data
  try {
    const ev = await queryOne(
      `INSERT INTO events
         (title, description, type, date, duration, location, capacity, min_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [d.title, d.description, d.type, d.date, d.duration, d.location, d.capacity, d.min_tier]
    )
    return NextResponse.json(ev, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('relation "events" does not exist')) {
      return NextResponse.json(
        { error: 'events table missing — wait for the next deploy to run migration 010.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
  }
}
