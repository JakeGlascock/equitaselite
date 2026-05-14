import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { emailIntroRequested } from '@/lib/email'
import { getEffectiveUserId } from '@/lib/acting-as'

const CreateSchema = z.object({
  recipient_id: z.string().min(1),
  message:      z.string().max(1000).optional(),
})

export async function GET(req: NextRequest) {
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await query(
    `SELECT i.id, i.requester_id, i.recipient_id, i.status, i.message,
            i.created_at, i.responded_at,
            rp.full_name AS requester_name, rp.firm_name AS requester_firm,
            rp.email     AS requester_email,
            cp.full_name AS recipient_name, cp.firm_name AS recipient_firm,
            cp.email     AS recipient_email
     FROM introductions i
     JOIN profiles rp ON rp.id = i.requester_id
     JOIN profiles cp ON cp.id = i.recipient_id
     WHERE i.requester_id = $1 OR i.recipient_id = $1
     ORDER BY i.created_at DESC`,
    [userId]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { recipient_id, message } = parsed.data
  if (recipient_id === userId) {
    return NextResponse.json({ error: 'Cannot introduce to yourself' }, { status: 400 })
  }

  const recipient = await queryOne<{ id: string }>(
    'SELECT id FROM profiles WHERE id = $1 AND onboarding_completed = TRUE',
    [recipient_id]
  )
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  try {
    const intro = await queryOne<{ id: string }>(
      `INSERT INTO introductions (requester_id, recipient_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, recipient_id, message ?? null]
    )

    // Notify the recipient. Silently swallow errors so a missing notifications
    // table (e.g. before init-notifications has been run) doesn't break intros.
    try {
      const me = await queryOne<{ full_name: string; firm_name: string }>(
        'SELECT full_name, firm_name FROM profiles WHERE id = $1',
        [userId]
      )
      if (me) {
        const trimmed = message?.trim() ?? ''
        const snippet = trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed
        const body    = snippet
          ? `${me.firm_name} — “${snippet}”`
          : `From ${me.firm_name}`
        await query(
          `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
           VALUES ($1, 'intro_requested', $2, $3, '/connections', $4)`,
          [
            recipient_id,
            `${me.full_name} requested an introduction`,
            body,
            intro?.id ?? null,
          ]
        )

        // Email (gated on recipient's email_notifications_enabled inside the helper)
        try { await emailIntroRequested(recipient_id, me.full_name, me.firm_name, trimmed || null) }
        catch (err) { console.error('email send failed:', err) }
      }
    } catch { /* notifications table not yet initialized */ }

    return NextResponse.json(intro, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('unique_pair')) {
      return NextResponse.json({ error: 'Introduction already requested' }, { status: 409 })
    }
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
  }
}
