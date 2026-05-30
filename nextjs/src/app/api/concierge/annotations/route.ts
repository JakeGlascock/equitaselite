import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import {
  listAnnotationsForConcierge,
  upsertAnnotation,
  logConciergeAction,
} from '@/lib/concierge'

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

const UpsertSchema = z.object({
  counterparty_id: z.string().min(1).max(120),
  note:            z.string().trim().min(1).max(4000),
  vouch_strength:  z.enum(['know', 'worked_with', 'would_invest']).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!(await isCallerConcierge(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const rows = await listAnnotationsForConcierge(userId!)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!(await isCallerConcierge(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = UpsertSchema.safeParse(await req.json())
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first.path.length ? `${first.path.join('.')}: ` : ''
    return NextResponse.json({ error: `${where}${first.message}` }, { status: 400 })
  }

  // A concierge can't annotate themselves — matches the DB CHECK constraint.
  if (parsed.data.counterparty_id === userId) {
    return NextResponse.json(
      { error: 'You cannot annotate your own profile.' },
      { status: 400 },
    )
  }

  const annotation = await upsertAnnotation({
    concierge_id:    userId!,
    counterparty_id: parsed.data.counterparty_id,
    note:            parsed.data.note,
    vouch_strength:  parsed.data.vouch_strength ?? null,
  })
  if (!annotation) {
    return NextResponse.json({ error: 'We couldn’t save that annotation. Please try again.' }, { status: 500 })
  }

  // Fire-and-forget audit log entry. We deliberately don't await this with
  // a try/catch around the response — if the log fails, the annotation is
  // already persisted and the audit trail can be reconciled later.
  void logConciergeAction({
    concierge_id: userId!,
    action:       'annotation_upserted',
    subject_type: 'annotation',
    subject_id:   annotation.id,
    payload: {
      counterparty_id: annotation.counterparty_id,
      vouch_strength:  annotation.vouch_strength,
    },
  }).catch(err => console.error('audit log failed:', err))

  return NextResponse.json(annotation, { status: 201 })
}
