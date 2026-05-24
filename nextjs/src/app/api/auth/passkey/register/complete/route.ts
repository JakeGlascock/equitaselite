import { NextRequest, NextResponse } from 'next/server'
import { completePasskeyRegistration } from '@/lib/auth'

// Auth-required. Body: { credential: RegistrationResponseJSON } from
// the browser's navigator.credentials.create() result.
export async function POST(req: NextRequest) {
  const userId      = req.headers.get('x-user-id')
  const accessToken = req.cookies.get('ee_access')?.value
  if (!userId || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null) as { credential?: unknown } | null
  if (!body?.credential) {
    return NextResponse.json({ error: 'Missing credential' }, { status: 400 })
  }
  try {
    await completePasskeyRegistration(accessToken, body.credential)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[passkey-register-complete] ${name}: ${msg}`)
    return NextResponse.json({ error: 'Could not register passkey.' }, { status: 500 })
  }
}
