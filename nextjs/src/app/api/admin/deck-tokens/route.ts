import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { query } from '@/lib/db'
import { generateToken } from '@/lib/preview'

const DEFAULT_TTL_DAYS  = 14
const DEFAULT_MAX_VIEWS = 25

const CreateSchema = z.object({
  label:     z.string().trim().min(2).max(120),
  ttl_days:  z.number().int().min(1).max(90).optional(),
  max_views: z.number().int().min(1).max(500).optional(),
})

const RevokeSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/i),
})

interface TokenSummary {
  token:          string
  label:          string
  expires_at:     string
  max_views:      number
  view_count:     number
  last_viewed_at: string | null
  revoked_at:     string | null
  created_at:     string
}

// POST /api/admin/deck-tokens — mint a new pitch-deck link. Same audit
// model as /api/admin/preview-tokens: kind='deck' on the shared
// preview_tokens table. demo_profile_id stays NULL — deck tokens
// don't reference a demo profile.
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
  const { label, ttl_days, max_views } = parsed.data

  const token = generateToken()
  const ttl   = ttl_days  ?? DEFAULT_TTL_DAYS
  const cap   = max_views ?? DEFAULT_MAX_VIEWS

  try {
    await query(
      `INSERT INTO preview_tokens
         (token, label, kind, expires_at, max_views, created_by)
       VALUES ($1, $2, 'deck', NOW() + ($3 || ' days')::interval, $4, $5)`,
      [token, label, String(ttl), cap, adminId],
    )
  } catch (err: unknown) {
    console.error('deck-token mint failed:', err)
    return NextResponse.json({ error: 'Could not create token' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, token, ttl_days: ttl, max_views: cap }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await query<TokenSummary>(
    `SELECT token, label, expires_at, max_views, view_count,
            last_viewed_at, revoked_at, created_at
     FROM preview_tokens
     WHERE kind = 'deck'
     ORDER BY created_at DESC
     LIMIT 100`,
  ).catch(() => [] as TokenSummary[])

  return NextResponse.json({ tokens: rows })
}

export async function PATCH(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = RevokeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  await query(
    `UPDATE preview_tokens
        SET revoked_at = NOW()
      WHERE token = $1 AND kind = 'deck' AND revoked_at IS NULL`,
    [parsed.data.token],
  )
  return NextResponse.json({ ok: true })
}
