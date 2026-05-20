import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { ensureSnsEndpoint } from '@/lib/push'

// Token shape varies by platform but both APNs and FCM tokens are
// short opaque strings well under 1KB. We bound conservatively to
// reject obvious garbage without rejecting legitimate future formats.
const Schema = z.object({
  platform:    z.enum(['ios', 'android', 'web']),
  token:       z.string().min(16).max(512),
  app_version: z.string().max(32).optional(),
})

// POST /api/devices/register
//   Body: { platform, token, app_version? }
//
// Idempotent upsert on (platform, token). If the same physical device
// re-registers under a different user (e.g. account switch on a shared
// iPad), the new user_id takes over the row and last_seen_at bumps.
// Returns 200 with { ok: true } on success.
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { platform, token, app_version } = parsed.data

  // Best-effort SNS endpoint creation. No-ops outside iOS or when
  // PUSH_PROVIDER != 'sns'. A null result keeps the row registered;
  // we'll retry the endpoint creation on the next register call.
  const endpointArn = await ensureSnsEndpoint(platform, token)

  await query(
    `INSERT INTO device_tokens (user_id, platform, token, app_version, sns_endpoint_arn)
          VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (platform, token) DO UPDATE
        SET user_id          = EXCLUDED.user_id,
            app_version      = EXCLUDED.app_version,
            sns_endpoint_arn = COALESCE(EXCLUDED.sns_endpoint_arn, device_tokens.sns_endpoint_arn),
            updated_at       = NOW(),
            last_seen_at     = NOW(),
            revoked_at       = NULL`,
    [userId, platform, token, app_version ?? null, endpointArn],
  )

  return NextResponse.json({ ok: true })
}
