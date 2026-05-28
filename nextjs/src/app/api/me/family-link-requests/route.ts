import { NextRequest, NextResponse } from 'next/server'
import { listIncomingLinkRequests, listOutgoingLinkRequests } from '@/lib/family'

// GET /api/me/family-link-requests?direction=incoming|outgoing
//
// Returns the caller's pending family-link requests. Direction
// defaults to 'incoming' (the inbox view on /profile). 'outgoing'
// shows requests the caller has sent to other existing EE members.
//
// No status filter — only pending rows are returned. Accepted /
// declined / cancelled are historical and not load-bearing for the
// UI; we'd add a separate route if a "history" surface ever wants them.
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const direction = req.nextUrl.searchParams.get('direction') ?? 'incoming'
  if (direction !== 'incoming' && direction !== 'outgoing') {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
  }

  const requests = direction === 'outgoing'
    ? await listOutgoingLinkRequests(userId)
    : await listIncomingLinkRequests(userId)

  return NextResponse.json({ requests })
}
