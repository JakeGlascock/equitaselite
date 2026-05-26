import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { getInvitation, respondToInvitation, getDeal } from '@/lib/deals'

const PostSchema = z.object({
  status: z.enum(['interested', 'declined']),
})

// POST /api/deals/[id]/respond
// `id` is the deal_invitation row id (NOT the deal id). The member taps
// Interested / Pass on a card; we flip status + notify admin/concierge.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: invitationId } = await ctx.params
  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const updated = await respondToInvitation(invitationId, userId, parsed.data.status)
  if (!updated) {
    // Either wrong owner, already responded, or doesn't exist.
    // Re-load to disambiguate for the client.
    const existing = await getInvitation(invitationId)
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Already responded' }, { status: 409 })
  }

  // Notify the deal's creator (admin/concierge) when a member opts in,
  // so they know to broker the next step. Decline isn't notified —
  // it's signal, but not actionable in the same way.
  if (parsed.data.status === 'interested') {
    const deal = await getDeal(updated.deal_id)
    if (deal?.created_by) {
      const member = await queryOne<{ full_name: string; firm_name: string }>(
        `SELECT full_name, firm_name FROM profiles WHERE id = $1`,
        [userId],
      ).catch(() => null)
      const who = member
        ? `${member.full_name}${member.firm_name ? ` (${member.firm_name})` : ''}`
        : 'A Sovereign member'
      await query(
        `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
              VALUES ($1, 'deal_interest', $2, $3, $4, $5)`,
        [
          deal.created_by,
          `${who} is interested`,
          `${deal.title}`,
          '/admin',
          updated.deal_id,
        ],
      ).catch(() => undefined)
    }
  }

  return NextResponse.json({ ok: true, status: updated.status })
}
