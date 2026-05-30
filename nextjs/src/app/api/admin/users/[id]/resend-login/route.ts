import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { resendInvite, resetUserPassword } from '@/lib/auth'

// Sends the right Cognito email for a user who can't log in:
//   - FORCE_CHANGE_PASSWORD (Invited but never signed in)
//       → AdminCreateUser RESEND: fresh temporary password
//   - CONFIRMED (already onboarded, forgotten password)
//       → AdminResetUserPassword: password-reset code email
//
// We try RESEND first; if Cognito refuses (NotAuthorizedException-style
// "user is already confirmed"), we fall through to password reset. The
// response indicates which path was taken so the UI can show a precise
// toast ("Resent welcome email" vs "Password reset email sent").
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Demo / managed profiles have no Cognito user.
  if (id.startsWith('demo_') || id.startsWith('managed_')) {
    return NextResponse.json(
      { error: 'This account has no sign-in to resend (demo or managed profile).' },
      { status: 400 }
    )
  }

  // Profile may not exist yet (Invited users live only in Cognito) — fall back
  // to the query-string email the table passes alongside the request.
  const target = await queryOne<{ email: string }>(
    'SELECT email FROM profiles WHERE id = $1',
    [id]
  ).catch(() => null)
  const email = target?.email ?? req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json(
      { error: 'This account has no email on file, so we can’t resend the invite.' },
      { status: 400 }
    )
  }

  // Try resending the invite first. Works only for FORCE_CHANGE_PASSWORD users.
  try {
    await resendInvite(email)
    return NextResponse.json({ ok: true, action: 'resend_invite' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    // Cognito's RESEND fails for CONFIRMED users with NotAuthorizedException
    // (message text varies). Detect liberally and fall through.
    const looksLikeAlreadyConfirmed =
      /NotAuthorizedException|already confirmed|cannot reset password|InvalidParameterException/i.test(msg)
    if (!looksLikeAlreadyConfirmed) {
      console.error('resend invite failed:', err)
      return NextResponse.json({ error: msg || 'Resend failed' }, { status: 500 })
    }
  }

  // User is past FORCE_CHANGE_PASSWORD — issue a password reset instead.
  try {
    await resetUserPassword(email)
    return NextResponse.json({ ok: true, action: 'password_reset' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    console.error('password reset failed:', err)
    return NextResponse.json({ error: msg || 'Password reset failed' }, { status: 500 })
  }
}
