import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { marked } from 'marked'
import { isUserAdmin } from '@/lib/admin'
import { query } from '@/lib/db'

const CreateSchema = z.object({
  slug:        z.string().trim().regex(/^[a-z0-9-]{3,80}$/, 'Slug must be lowercase letters, digits, and hyphens (3-80 chars).'),
  title:       z.string().trim().min(3).max(200),
  summary:     z.string().trim().min(10).max(500),
  sector_tag:  z.string().trim().min(2).max(60),
  body:        z.string().trim().min(20).max(50000),
  min_tier:    z.enum(['access', 'select', 'sovereign']).default('select'),
  publish_now: z.boolean().optional().default(false),
})

interface ReportRow {
  id:           string
  slug:         string
  title:        string
  summary:      string
  sector_tag:   string
  min_tier:     'access' | 'select' | 'sovereign'
  published_at: string | null
  created_at:   string
  updated_at:   string
}

// POST /api/admin/reports — create a draft report (or publish immediately).
// Body is Markdown; the rendered HTML is cached in body_html so the reader
// path doesn't re-parse on every page load.
export async function POST(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }
  const { slug, title, summary, sector_tag, body, min_tier, publish_now } = parsed.data

  // marked is sync when given { async: false }; we don't need any
  // GitHub-flavored extensions for v1.
  const bodyHtml = marked.parse(body, { async: false }) as string

  try {
    await query(
      `INSERT INTO reports
         (slug, title, summary, sector_tag, body, body_html, min_tier, published_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        slug, title, summary, sector_tag, body, bodyHtml, min_tier,
        publish_now ? new Date() : null,
        adminId,
      ],
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (/unique constraint .*slug/i.test(msg) || /reports_slug_key/i.test(msg)) {
      return NextResponse.json({ error: `A report with slug "${slug}" already exists.` }, { status: 409 })
    }
    console.error('report insert failed:', err)
    return NextResponse.json({ error: 'Could not save report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug, published: publish_now }, { status: 201 })
}

// GET /api/admin/reports — list all reports (draft + published) for the
// admin UI. Body excluded from the list to keep payload small.
export async function GET(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await query<ReportRow>(
    `SELECT id, slug, title, summary, sector_tag, min_tier,
            published_at, created_at, updated_at
     FROM reports
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT 200`,
  ).catch(() => [] as ReportRow[])

  return NextResponse.json({ reports: rows })
}
