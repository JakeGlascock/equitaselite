import { NextRequest, NextResponse } from 'next/server'
import { startPasskeyRegistration } from '@/lib/auth'

// Auth-required. Returns the W3C CredentialCreationOptions JSON that
// the browser hands to navigator.credentials.create() — Cognito has
// already encoded base64URL fields so @simplewebauthn/browser can
// consume it directly.
export async function POST(req: NextRequest) {
  const userId      = req.headers.get('x-user-id')
  const accessToken = req.cookies.get('ee_access')?.value
  if (!userId || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const options = await startPasskeyRegistration(accessToken)
    return NextResponse.json({ options })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[passkey-register-start] ${name}: ${msg}`)
    return NextResponse.json({ error: 'Could not start passkey registration.' }, { status: 500 })
  }
}
