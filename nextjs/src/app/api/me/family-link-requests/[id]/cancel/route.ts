import { NextRequest, NextResponse } from 'next/server'
import { cancelLinkRequest } from '@/lib/family'

// POST /api/me/family-link-requests/[id]/cancel
//
// Caller is the REQUESTER withdrawing their own pending request
// before the target accepts or declines. Single 404 for the
// not-found-or-not-yours case (consistent with accept/decline) —
// no info leak about whether the request exists for someone else.
//
// No notification fires to the target — the row just disappears
// from their inbox on the next read.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = await cancelLinkRequest(id, userId)
  if (!result.ok) {
    const isOwnership = /not found/i.test(result.error)
    return NextResponse.json(
      { error: result.error },
      { status: isOwnership ? 404 : 409 },
    )
  }
  return NextResponse.json({ ok: true })
}
