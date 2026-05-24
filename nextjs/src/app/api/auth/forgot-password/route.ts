import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { forgotPassword } from '@/lib/auth'

const Schema = z.object({
  email: z.string().email(),
})

// Step 1 of the user-initiated password-reset flow.
// Cognito emails a one-time confirmation code; we always return 200 to
// the client so an enumeration attacker can't tell whether a given
// email is registered.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  try {
    await forgotPassword(parsed.data.email.toLowerCase())
  } catch (err) {
    const name = (err as { name?: string })?.name ?? ''
    // Rate-limit responses we surface; unknown-user (or anything else)
    // is silently absorbed to prevent enumeration.
    if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a moment and try again.' },
        { status: 429 },
      )
    }
    console.error('[forgot-password] swallowed error', err)
  }
  return NextResponse.json({ ok: true })
}
