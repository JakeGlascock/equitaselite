import { NextRequest, NextResponse } from 'next/server'
import { listPasskeys } from '@/lib/auth'

// Auth-required. Returns the user's registered passkeys for the
// management UI on /profile.
export async function GET(req: NextRequest) {
  const userId      = req.headers.get('x-user-id')
  const accessToken = req.cookies.get('ee_access')?.value
  if (!userId || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const passkeys = await listPasskeys(accessToken)
    return NextResponse.json({ passkeys })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[passkey-list] ${name}: ${msg}`)
    return NextResponse.json({ error: 'Could not list passkeys.' }, { status: 500 })
  }
}
