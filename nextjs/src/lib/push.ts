import { query } from './db'

// Server-side push dispatch.
//
// Phase M2 ships the data plane (device_tokens table + register/unregister
// endpoints) but stubs the transport. Real APNs/FCM dispatch comes online
// once the Apple Developer push key is uploaded and a transport is picked
// (AWS SNS Mobile Push or direct APNs HTTP/2). Today this just logs each
// intended send to CloudWatch so we can verify the trigger hooks fire.

export interface PushPayload {
  title:    string
  body:     string
  // Deep-link target path (e.g. '/introductions/abc-123'). The native
  // app resolves this against the live URL — Universal Links pick it up
  // when present in Phase M3.
  url?:     string
  // Optional per-event category so the user can mute one type without
  // muting all push.
  category?: 'intro' | 'mandate' | 'event' | 'system'
}

interface ActiveTokenRow {
  id:       string
  platform: 'ios' | 'android' | 'web'
  token:    string
}

/**
 * Send a push to every active device the user has registered. Returns
 * the count of tokens dispatched to (or that would have been, in stub
 * mode). Safe to call from any server context; failures are swallowed
 * with a log line so push never blocks the originating write.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  try {
    const rows = await query<ActiveTokenRow>(
      `SELECT id, platform, token
         FROM device_tokens
        WHERE user_id   = $1
          AND revoked_at IS NULL`,
      [userId],
    )
    if (rows.length === 0) return 0

    const provider = process.env.PUSH_PROVIDER ?? 'stub'
    if (provider === 'stub') {
      // Stub: log intent. Phase M2 ships the table + register endpoint;
      // the actual transport plug (SNS / APNs HTTP/2) lands once the
      // Apple Developer push key is uploaded.
      console.log(
        `[push:stub] would dispatch to ${rows.length} device(s) for user=${userId}`,
        { payload, platforms: rows.map(r => r.platform) },
      )
    }
    // Bump last_seen_at on all dispatched rows so a stale-token cleanup
    // job can reap devices that haven't been touched in N months.
    await query(
      `UPDATE device_tokens
          SET last_seen_at = NOW()
        WHERE id = ANY($1::uuid[])`,
      [rows.map(r => r.id)],
    )
    return rows.length
  } catch (err) {
    console.error('[push] dispatch failed', { userId, err })
    return 0
  }
}
