import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { confirmForgotPassword } from '@/lib/auth'

const Schema = z.object({
  email:       z.string().email(),
  code:        z.string().min(4).max(16),
  newPassword: z.string().min(16),
})

// Step 2 of the user-initiated password-reset flow.
// Cognito returns a friendly error if the code is wrong, expired, or
// the new password fails the user pool's password policy.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  try {
    await confirmForgotPassword(
      parsed.data.email.toLowerCase(),
      parsed.data.code,
      parsed.data.newPassword,
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? ''
    const msg  = err instanceof Error ? err.message : ''
    if (name === 'CodeMismatchException') {
      return NextResponse.json({ error: 'Incorrect reset code.' }, { status: 401 })
    }
    if (name === 'ExpiredCodeException') {
      return NextResponse.json({ error: 'Reset code expired. Request a new one.' }, { status: 401 })
    }
    if (name === 'InvalidPasswordException') {
      return NextResponse.json({ error: msg || 'Password does not meet policy requirements.' }, { status: 400 })
    }
    if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429 })
    }
    console.error('[reset-password] error', err)
    return NextResponse.json({ error: 'Could not reset password. Please try again.' }, { status: 500 })
  }
}
