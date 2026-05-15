import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { marked } from 'marked'
import { isUserAdmin } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'

const CreateSchema = z.object({
  recipient_user_id: z.string().min(1).max(120),
  title:             z.string().trim().min(3).max(200),
  summary:           z.string().trim().min(10).max(500),
  body:              z.string().trim().min(20).max(50000),
  publish_now:       z.boolean().optional().default(false),
})

interface BriefingRow {
  id:                string
  recipient_user_id: string
  recipient_name:    string | null
  title:             string
  summary:           string
  published_at:      string | null
  created_at:        string
  updated_at:        string
}

// Briefings can be authored by admins OR concierges. Anyone who's
// neither — or anyone trying to author for a recipient who isn't
// Sovereign-tier — is rejected.
async function isStaffAuthor(userId: string | null, userEmail: string | null): Promise<boolean> {
  if (!userId) return false
  if (await isUserAdmin(userId, userEmail)) return true
  const r = await queryOne<{ is_concierge: boolean | null }>(
    'SELECT is_concierge FROM profiles WHERE id = $1',
    [userId],
  ).catch(() => null)
  return !!r?.is_concierge
}

export async function POST(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isStaffAuthor(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }
  const { recipient_user_id, title, summary, body, publish_now } = parsed.data

  // Sanity check: recipient should be a Sovereign tier user. Soft-warn
  // by returning 400 — admin can re-tier the recipient and retry.
  const recipient = await queryOne<{ id: string; membership: string | null }>(
    'SELECT id, membership FROM profiles WHERE id = $1',
    [recipient_user_id],
  ).catch(() => null)
  if (!recipient) {
    return NextResponse.json({ error: 'Recipient profile not found' }, { status: 400 })
  }
  if (recipient.membership !== 'sovereign') {
    return NextResponse.json(
      { error: 'Bespoke briefings are a Sovereign-tier benefit. Upgrade the recipient first.' },
      { status: 400 },
    )
  }

  const bodyHtml = marked.parse(body, { async: false }) as string

  try {
    await query(
      `INSERT INTO portfolio_reports
         (recipient_user_id, title, summary, body, body_html, published_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        recipient_user_id, title, summary, body, bodyHtml,
        publish_now ? new Date() : null,
        userId,
      ],
    )
  } catch (err: unknown) {
    console.error('briefing insert failed:', err)
    return NextResponse.json({ error: 'Could not save briefing' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, published: publish_now }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isStaffAuthor(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await query<BriefingRow>(
    `SELECT pr.id, pr.recipient_user_id, p.full_name AS recipient_name,
            pr.title, pr.summary, pr.published_at, pr.created_at, pr.updated_at
     FROM portfolio_reports pr
     LEFT JOIN profiles p ON p.id = pr.recipient_user_id
     ORDER BY COALESCE(pr.published_at, pr.created_at) DESC
     LIMIT 200`,
  ).catch(() => [] as BriefingRow[])

  return NextResponse.json({ briefings: rows })
}
