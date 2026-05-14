import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

const PatchSchema = z.object({
  is_admin:     z.boolean().optional(),
  is_concierge: z.boolean().optional(),
}).refine(d => d.is_admin !== undefined || d.is_concierge !== undefined, {
  message: 'Provide at least one field to update.',
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Safety: an admin can't revoke their own admin (lockout risk)
  if (id === userId && parsed.data.is_admin === false) {
    return NextResponse.json(
      { error: 'You cannot revoke your own admin access. Ask another admin to do it.' },
      { status: 400 }
    )
  }

  try {
    const updated = await queryOne<{ id: string; is_admin: boolean; is_concierge: boolean }>(
      `UPDATE profiles
       SET is_admin     = COALESCE($2, is_admin),
           is_concierge = COALESCE($3, is_concierge)
       WHERE id = $1
       RETURNING id, is_admin, is_concierge`,
      [id, parsed.data.is_admin ?? null, parsed.data.is_concierge ?? null]
    )
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('is_concierge')) {
      return NextResponse.json(
        { error: 'Initialize the concierge columns first — admin page → "Initialize concierge columns" button.' },
        { status: 400 }
      )
    }
    console.error('admin user PATCH failed:', err)
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
  }
}
