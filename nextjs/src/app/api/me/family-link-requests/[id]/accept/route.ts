import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { acceptLinkRequest, getLinkRequest } from '@/lib/family'

// POST /api/me/family-link-requests/[id]/accept
//
// Caller is the target of a pending request — accepting links
// their profile to the requester as a next-gen seat. acceptLink
// Request handles the schema work + revalidation; this route
// scopes auth and fires the back-notification to the requester
// (so they see "Avery accepted your link request" in their bell).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = await acceptLinkRequest(id, userId)
  if (!result.ok) {
    // 404 for not-found-or-not-yours (single error, no info leak).
    // 409 for the state-transition failures (already responded,
    // already has parent) — the target sees a concrete reason.
    const isOwnership = /not found/i.test(result.error)
    return NextResponse.json(
      { error: result.error },
      { status: isOwnership ? 404 : 409 },
    )
  }

  // Fire-and-forget notification back to the requester. Joining to
  // grab their full_name + the target's full_name in one trip so the
  // bell title reads "Avery (next-gen-firm) accepted your link request."
  void (async () => {
    const request = await getLinkRequest(id).catch(() => null)
    if (!request) return
    const names = await queryOne<{ target_name: string | null }>(
      `SELECT full_name AS target_name FROM profiles WHERE id = $1`,
      [userId],
    ).catch(() => null)
    await query(
      `INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
            VALUES ($1, 'family_link_accepted', $2, $3, $4, $5)`,
      [
        request.requester_id,
        `${names?.target_name ?? 'A next-gen seat'} accepted your link request`,
        'They now appear in your Family seats panel and can enter shadow view.',
        '/profile',
        request.id,
      ],
    ).catch(err => console.error('family_link_accepted notification failed:', err))
  })()

  return NextResponse.json({ ok: true })
}
