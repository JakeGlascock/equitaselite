import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { declineLinkRequest, getLinkRequest } from '@/lib/family'

// POST /api/me/family-link-requests/[id]/decline
//
// Caller is the target of a pending request — declining marks the
// request and notifies the requester. No profile mutation. Same
// 404 / 409 split as accept.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = await declineLinkRequest(id, userId)
  if (!result.ok) {
    const isOwnership = /not found/i.test(result.error)
    return NextResponse.json(
      { error: result.error },
      { status: isOwnership ? 404 : 409 },
    )
  }

  void (async () => {
    const request = await getLinkRequest(id).catch(() => null)
    if (!request) return
    await query(
      `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
            VALUES ($1, 'family_link_declined', $2, $3, $4, $5)`,
      [
        request.requester_id,
        'Family seat link request declined',
        'They chose not to link this account to your seat.',
        '/profile',
        request.id,
      ],
    ).catch(err => console.error('family_link_declined notification failed:', err))
  })()

  return NextResponse.json({ ok: true })
}
