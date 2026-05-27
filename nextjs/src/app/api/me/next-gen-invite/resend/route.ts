import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { resendInvite } from '@/lib/auth'

// P5d — parent-owned resend of a next-gen invite. Mirrors
// /api/admin/users/[id]/resend-login but the gate is "you parent
// this seat" instead of "you are an admin", so a parent who lost
// the invited next-gen's first email can re-trigger it without
// going through admin.
//
// Only meaningful BEFORE onboarding (Cognito sends fresh temp
// password). Once the next-gen has onboarded they can use forgot-
// password like any other user; we return 400 in that case rather
// than silently issuing a reset, to keep the parent's mental model
// tight ("you're inviting them in" vs "they forgot their password").

const Schema = z.object({
  next_gen_id: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const callerId = req.headers.get('x-user-id')
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'next_gen_id required' }, { status: 400 })
  }

  // Single lookup confirms (a) the target exists, (b) the caller
  // actually parents it, and (c) the target's onboarding status.
  // No need to also load the caller's role flags — being the parent
  // on parent_profile_id is the only check that matters.
  type Row = {
    id: string
    email: string
    onboarding_completed: boolean
  }
  const target = await queryOne<Row>(
    `SELECT id, email, onboarding_completed
       FROM profiles
      WHERE id = $1 AND parent_profile_id = $2`,
    [parsed.data.next_gen_id, callerId],
  ).catch(() => null)

  if (!target) {
    // Single 404 covers "target doesn't exist" + "caller doesn't
    // parent this seat" — don't leak which.
    return NextResponse.json({ error: 'Next-gen seat not found.' }, { status: 404 })
  }

  if (target.onboarding_completed) {
    return NextResponse.json(
      { error: 'They\'ve already completed onboarding — they can sign in normally or use forgot-password.' },
      { status: 400 },
    )
  }

  try {
    await resendInvite(target.email)
    return NextResponse.json({ ok: true, email: target.email })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resend failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
