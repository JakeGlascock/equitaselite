import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { generateToken } from '@/lib/preview'

const DEFAULT_TTL_DAYS  = 14
const DEFAULT_MAX_VIEWS = 25

const CreateSchema = z.object({
  label:           z.string().trim().min(2).max(120),
  demo_profile_id: z.string().regex(/^demo_[a-z0-9_]+$/i).max(120),
  ttl_days:        z.number().int().min(1).max(90).optional(),
  max_views:       z.number().int().min(1).max(500).optional(),
})

const RevokeSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/i),
})

interface TokenSummary {
  token:           string
  label:           string
  paired_token:    string | null
  expires_at:      string
  max_views:       number
  view_count:      number
  last_viewed_at:  string | null
  revoked_at:      string | null
  created_at:      string
}

// POST /api/admin/deck-tokens — mint a deck link AND its paired preview
// in one shot. The deck row's paired_token references the freshly-minted
// preview row, so the /deck/[token] route can substitute a per-recipient
// preview URL into pitch.html at render time.
//
// Two-step insert (preview first, then deck with paired_token). If the
// second insert fails we delete the orphan preview so the table doesn't
// accumulate unreferenced rows.
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
  const { label, demo_profile_id, ttl_days, max_views } = parsed.data

  // The paired preview needs a real demo profile to walk through.
  const profile = await queryOne<{ id: string }>(
    'SELECT id FROM profiles WHERE id = $1',
    [demo_profile_id],
  ).catch(() => null)
  if (!profile) {
    return NextResponse.json({ error: 'Demo profile not found' }, { status: 400 })
  }

  const deckToken    = generateToken()
  const previewToken = generateToken()
  const ttl = ttl_days  ?? DEFAULT_TTL_DAYS
  const cap = max_views ?? DEFAULT_MAX_VIEWS

  // Step 1: insert the paired preview row first (the deck FK needs it
  // to exist). Suffix the label so the row is identifiable in the
  // preview-tokens admin panel.
  try {
    await query(
      `INSERT INTO preview_tokens
         (token, label, kind, demo_profile_id, expires_at, max_views, created_by)
       VALUES ($1, $2, 'preview', $3, NOW() + ($4 || ' days')::interval, $5, $6)`,
      [previewToken, `${label} · paired`, demo_profile_id, String(ttl), cap, adminId],
    )
  } catch (err: unknown) {
    console.error('deck-token mint: paired preview insert failed:', err)
    return NextResponse.json({ error: 'Could not create paired preview' }, { status: 500 })
  }

  // Step 2: insert the deck row referencing the paired preview.
  try {
    await query(
      `INSERT INTO preview_tokens
         (token, label, kind, expires_at, max_views, paired_token, created_by)
       VALUES ($1, $2, 'deck', NOW() + ($3 || ' days')::interval, $4, $5, $6)`,
      [deckToken, label, String(ttl), cap, previewToken, adminId],
    )
  } catch (err: unknown) {
    console.error('deck-token mint: deck insert failed, rolling back paired preview:', err)
    await query('DELETE FROM preview_tokens WHERE token = $1', [previewToken])
      .catch(rollbackErr => console.error('rollback failed too:', rollbackErr))
    return NextResponse.json({ error: 'Could not create deck token' }, { status: 500 })
  }

  return NextResponse.json({
    ok:           true,
    token:        deckToken,
    paired_token: previewToken,
    ttl_days:     ttl,
    max_views:    cap,
  }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await query<TokenSummary>(
    `SELECT token, label, paired_token, expires_at, max_views, view_count,
            last_viewed_at, revoked_at, created_at
     FROM preview_tokens
     WHERE kind = 'deck'
     ORDER BY created_at DESC
     LIMIT 100`,
  ).catch(() => [] as TokenSummary[])

  return NextResponse.json({ tokens: rows })
}

// PATCH revokes a deck token AND cascades the revoke to its paired
// preview row in a single statement. Without the cascade the
// __PREVIEW_URL__ would still resolve to a working preview even after
// the deck was revoked.
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
    `WITH revoked_deck AS (
       UPDATE preview_tokens
          SET revoked_at = NOW()
        WHERE token = $1 AND kind = 'deck' AND revoked_at IS NULL
        RETURNING paired_token
     )
     UPDATE preview_tokens
        SET revoked_at = NOW()
      WHERE token = (SELECT paired_token FROM revoked_deck)
        AND revoked_at IS NULL`,
    [parsed.data.token],
  )
  return NextResponse.json({ ok: true })
}
