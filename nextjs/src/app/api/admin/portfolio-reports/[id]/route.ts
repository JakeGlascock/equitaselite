import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { marked } from 'marked'
import { isUserAdmin } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'

const PatchSchema = z.object({
  title:     z.string().trim().min(3).max(200).optional(),
  summary:   z.string().trim().min(10).max(500).optional(),
  body:      z.string().trim().min(20).max(50000).optional(),
  published: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'Provide at least one field.' })

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function isStaffAuthor(userId: string | null, userEmail: string | null): Promise<boolean> {
  if (!userId) return false
  if (await isUserAdmin(userId, userEmail)) return true
  const r = await queryOne<{ is_concierge: boolean | null }>(
    'SELECT is_concierge FROM profiles WHERE id = $1',
    [userId],
  ).catch(() => null)
  return !!r?.is_concierge
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isStaffAuthor(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!UUID_RX.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  const set: string[] = ['updated_at = NOW()']
  const params: unknown[] = []
  let pi = 1

  if (parsed.data.title !== undefined)   { set.push(`title = $${pi++}`);   params.push(parsed.data.title) }
  if (parsed.data.summary !== undefined) { set.push(`summary = $${pi++}`); params.push(parsed.data.summary) }
  if (parsed.data.body !== undefined) {
    set.push(`body = $${pi++}`)
    params.push(parsed.data.body)
    set.push(`body_html = $${pi++}`)
    params.push(marked.parse(parsed.data.body, { async: false }) as string)
  }
  if (parsed.data.published !== undefined) {
    set.push(`published_at = ${parsed.data.published ? 'NOW()' : 'NULL'}`)
  }

  params.push(id)
  const updated = await queryOne<{ id: string }>(
    `UPDATE portfolio_reports SET ${set.join(', ')} WHERE id = $${pi} RETURNING id`,
    params,
  )
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isStaffAuthor(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!UUID_RX.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await query('DELETE FROM portfolio_reports WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
