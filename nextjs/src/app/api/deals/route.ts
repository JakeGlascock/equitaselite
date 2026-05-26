import { NextRequest, NextResponse } from 'next/server'
import { getTier } from '@/lib/membership'
import { listInvitationsForUser } from '@/lib/deals'

// Member view: list every open deal the caller has been invited to.
// Tier-gated to Sovereign — even though only Sovereigns ever get
// invitations, double-locking here means we surface a clean 403
// instead of an empty list when an Access/Select hits the endpoint
// directly.
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getTier(userId)
  if (tier !== 'sovereign') {
    return NextResponse.json({ error: 'Sovereign tier required' }, { status: 403 })
  }

  const invitations = await listInvitationsForUser(userId).catch(() => [])
  return NextResponse.json({ invitations })
}
