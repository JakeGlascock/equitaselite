import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { inviteUser } from '@/lib/auth'

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

const InviteSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  const userEmail = req.headers.get('x-user-email')?.toLowerCase()
  const admins = adminEmails()
  if (!userEmail || !admins.includes(userEmail)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  try {
    await inviteUser(parsed.data.email)
    return NextResponse.json({ ok: true, email: parsed.data.email }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invite failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
