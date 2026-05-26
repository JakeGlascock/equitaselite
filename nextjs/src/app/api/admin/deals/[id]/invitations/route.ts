import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { query } from '@/lib/db'
import {
  getDeal,
  inviteToDeal,
  listInvitationsForDeal,
} from '@/lib/deals'
import { emailDealInvitation } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'

const PostSchema = z.object({
  user_ids: z.array(z.string().min(1)).min(1).max(500),
})

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await ctx.params
  const invitations = await listInvitationsForDeal(id).catch(() => [])
  return NextResponse.json({ invitations })
}

// POST /api/admin/deals/[id]/invitations — invite N Sovereigns to a deal.
// Fires the in-app bell notification synchronously (cheap insert) and the
// email + push asynchronously per recipient (best-effort; SES / SNS hiccups
// don't block the API response).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await ctx.params
  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const deal = await getDeal(id)
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Filter to Sovereign-tier, non-demo recipients. Admin UI already shows
  // only Sovereigns, but enforce server-side so a hand-crafted POST can't
  // leak the deal to Access/Select tiers.
  const eligible = await query<{ id: string }>(
    `SELECT id FROM profiles
      WHERE id = ANY($1::text[])
        AND membership = 'sovereign'
        AND onboarding_completed = TRUE
        AND id NOT LIKE 'demo\\_%' ESCAPE '\\'`,
    [parsed.data.user_ids],
  ).catch(() => [] as { id: string }[])
  const eligibleIds = eligible.map(r => r.id)
  if (eligibleIds.length === 0) {
    return NextResponse.json({ created: 0, skipped: parsed.data.user_ids.length })
  }

  const created = await inviteToDeal(id, eligibleIds)
  const newlyInvited = new Set(created.map(c => c.user_id))

  // In-app bell notifications — one INSERT per newly-invited user.
  await Promise.all(
    created.map(inv =>
      query(
        `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
              VALUES ($1, 'deal_invitation', $2, $3, $4, $5)`,
        [
          inv.user_id,
          `New opportunity: ${deal.title}`,
          deal.description.replace(/\s+/g, ' ').slice(0, 200),
          '/deals',
          id,
        ],
      ).catch(() => undefined),
    ),
  )

  // Email + push — fire-and-forget. We don't want a flaky SES call to
  // 500 the invitation request; the in-app bell is the source of truth.
  void (async () => {
    for (const userId of eligibleIds) {
      if (!newlyInvited.has(userId)) continue
      try { await emailDealInvitation(userId, deal.title, deal.description) } catch (e) {
        console.error('emailDealInvitation failed:', e)
      }
      try {
        await sendPushToUser(userId, {
          title:    'New opportunity',
          body:     deal.title,
          url:      '/deals',
          category: 'mandate',
        })
      } catch (e) {
        console.error('sendPushToUser(deal) failed:', e)
      }
    }
  })()

  return NextResponse.json({
    created: created.length,
    skipped: parsed.data.user_ids.length - created.length,
  })
}
