import { NextRequest, NextResponse } from 'next/server'
import { deletePasskey } from '@/lib/auth'

// Auth-required. Deletes a single passkey by Cognito's CredentialId.
// The URL param matches the id returned in /api/auth/passkey/list.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId      = req.headers.get('x-user-id')
  const accessToken = req.cookies.get('ee_access')?.value
  if (!userId || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'Missing credential id' }, { status: 400 })
  }
  try {
    await deletePasskey(accessToken, id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[passkey-delete] ${name}: ${msg}`)
    return NextResponse.json({ error: 'Could not remove passkey.' }, { status: 500 })
  }
}
