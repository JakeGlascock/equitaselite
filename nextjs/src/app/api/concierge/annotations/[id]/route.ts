import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { deleteAnnotation, logConciergeAction } from '@/lib/concierge'

async function isCallerConcierge(userId: string | null): Promise<boolean> {
  if (!userId) return false
  try {
    const row = await queryOne<{ is_concierge: boolean }>(
      'SELECT is_concierge FROM profiles WHERE id = $1',
      [userId],
    )
    return !!row?.is_concierge
  } catch {
    return false
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!(await isCallerConcierge(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  // deleteAnnotation is scoped to (id, concierge_id) — a concierge can
  // only delete their own annotations. Returns false if no row matched.
  const ok = await deleteAnnotation(id, userId!)
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  void logConciergeAction({
    concierge_id: userId!,
    action:       'annotation_deleted',
    subject_type: 'annotation',
    subject_id:   id,
  }).catch(err => console.error('audit log failed:', err))

  return NextResponse.json({ ok: true })
}
