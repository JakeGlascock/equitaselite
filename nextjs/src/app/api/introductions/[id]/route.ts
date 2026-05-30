import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { emailIntroAccepted, emailIntroDeclined } from '@/lib/email'
import { getEffectiveUserId } from '@/lib/acting-as'

const RespondSchema = z.object({
  status: z.enum(['accepted', 'declined']),
})

interface UpdatedIntro {
  id: string
  requester_id: string
  recipient_id: string
  status: 'accepted' | 'declined'
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getEffectiveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = RespondSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const updated = await queryOne<UpdatedIntro>(
    `UPDATE introductions
     SET status = $3, responded_at = NOW()
     WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, userId, parsed.data.status]
  )

  if (!updated) {
    // Deliberately ambiguous: this single response covers "doesn't exist",
    // "already responded", and "wrong recipient" so the caller can't
    // enumerate intro ids by probing for the distinction.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Notify the requester that their intro got a response.
  try {
    const me = await queryOne<{ full_name: string; firm_name: string; email: string }>(
      'SELECT full_name, firm_name, email FROM profiles WHERE id = $1',
      [userId]
    )
    if (me) {
      const verb  = updated.status === 'accepted' ? 'accepted' : 'declined'
      const type  = updated.status === 'accepted' ? 'intro_accepted' : 'intro_declined'
      await query(
        `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
         VALUES ($1, $2, $3, $4, '/connections', $5)`,
        [
          updated.requester_id,
          type,
          `${me.full_name} ${verb} your introduction`,
          `${me.firm_name}`,
          updated.id,
        ]
      )

      // Email
      try {
        if (updated.status === 'accepted') {
          await emailIntroAccepted(updated.requester_id, me.full_name, me.firm_name, me.email)
        } else {
          await emailIntroDeclined(updated.requester_id, me.full_name, me.firm_name)
        }
      } catch (err) { console.error('email send failed:', err) }
    }
  } catch { /* notifications table not yet initialized */ }

  return NextResponse.json(updated)
}
