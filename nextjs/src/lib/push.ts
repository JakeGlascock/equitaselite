import {
  SNSClient,
  CreatePlatformEndpointCommand,
  PublishCommand,
  SetEndpointAttributesCommand,
} from '@aws-sdk/client-sns'
import { query } from './db'

// Native push transport — AWS SNS Mobile Push.
//
// Flow:
//   1. /api/devices/register receives the APNs device token.
//   2. ensureSnsEndpoint() creates (or rebinds) an SNS Platform Endpoint
//      under the platform application configured by SNS_APNS_PLATFORM_APP_ARN
//      and persists the resulting endpoint ARN on device_tokens.
//   3. sendPushToUser() fans out per token: one SNS Publish per endpoint.
//
// PUSH_PROVIDER controls behaviour:
//   unset / 'stub'  → log intent only (used in dev + before the APNs
//                     key is uploaded; lets every hook compile without
//                     environment-specific secrets)
//   'sns'           → real SNS Publish
//
// EndpointDisabled responses (token invalidated by APNs, e.g. app
// uninstalled) flip device_tokens.revoked_at so we stop spending API
// calls on dead devices.

const REGION = process.env.AWS_REGION ?? 'us-east-1'
const APNS_PLATFORM_APP_ARN = process.env.SNS_APNS_PLATFORM_APP_ARN ?? ''

let snsClient: SNSClient | null = null
function getSnsClient(): SNSClient {
  if (!snsClient) snsClient = new SNSClient({ region: REGION })
  return snsClient
}

export interface PushPayload {
  title:     string
  body:      string
  // Deep-link target path (e.g. '/introductions/abc-123'). The native
  // app resolves this against the live URL — Universal Links pick it
  // up when present in Phase M3.
  url?:      string
  // Optional per-event category so the user can mute one type without
  // muting all push.
  category?: 'intro' | 'mandate' | 'event' | 'system'
}

interface ActiveTokenRow {
  id:                string
  platform:          'ios' | 'android' | 'web'
  token:             string
  sns_endpoint_arn:  string | null
}

/**
 * Create (or rebind) an SNS Platform Endpoint for a freshly registered
 * device token. Idempotent: SNS dedupes on the underlying device token
 * within a Platform Application. Returns the endpoint ARN or null if
 * SNS is not configured / errored (caller persists null and we'll try
 * again on next register).
 */
export async function ensureSnsEndpoint(
  platform: 'ios' | 'android' | 'web',
  token: string,
): Promise<string | null> {
  // Only iOS has a configured Platform Application today. Android +
  // PWA web push slot in later by adding more env-keyed platform ARNs.
  if (platform !== 'ios') return null
  if (process.env.PUSH_PROVIDER !== 'sns')           return null
  if (!APNS_PLATFORM_APP_ARN)                        return null

  try {
    const out = await getSnsClient().send(new CreatePlatformEndpointCommand({
      PlatformApplicationArn: APNS_PLATFORM_APP_ARN,
      Token:                  token,
    }))
    if (!out.EndpointArn) return null

    // If the endpoint pre-existed but had been disabled (prior token
    // invalidation), re-enable it. CreatePlatformEndpoint silently
    // returns the existing ARN with the old state, so we explicitly
    // set Enabled=true and update the token to match the latest one.
    await getSnsClient().send(new SetEndpointAttributesCommand({
      EndpointArn: out.EndpointArn,
      Attributes:  { Enabled: 'true', Token: token },
    }))

    return out.EndpointArn
  } catch (err) {
    console.error('[push] CreatePlatformEndpoint failed', { platform, err })
    return null
  }
}

/**
 * Send a push to every active device the user has registered. Returns
 * the count of tokens we attempted to send to. Per-token failures are
 * swallowed with a log line so a single bad endpoint doesn't block the
 * dispatch loop or the originating write.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  try {
    const rows = await query<ActiveTokenRow>(
      `SELECT id, platform, token, sns_endpoint_arn
         FROM device_tokens
        WHERE user_id   = $1
          AND revoked_at IS NULL`,
      [userId],
    )
    if (rows.length === 0) return 0

    const provider = process.env.PUSH_PROVIDER ?? 'stub'

    if (provider === 'stub') {
      console.log(
        `[push:stub] would dispatch to ${rows.length} device(s) for user=${userId}`,
        { payload, platforms: rows.map(r => r.platform) },
      )
    } else if (provider === 'sns') {
      await Promise.allSettled(rows.map(row => sendOneSns(row, payload)))
    } else {
      console.warn(`[push] unknown PUSH_PROVIDER=${provider} — skipping dispatch`)
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

async function sendOneSns(row: ActiveTokenRow, payload: PushPayload): Promise<void> {
  if (!row.sns_endpoint_arn) {
    console.warn('[push] skipping row without sns_endpoint_arn', { id: row.id })
    return
  }

  // SNS wire format. The outer envelope multiplexes per-platform
  // payloads; APNs gets the standard aps dict + our custom `url` /
  // `category` keys at the top level so the iOS bridge can read them
  // via notification.data.url.
  const apnsPayload = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
    },
    url:      payload.url      ?? null,
    category: payload.category ?? 'system',
  })
  const message = JSON.stringify({
    default: payload.body,
    APNS:    apnsPayload,
  })

  try {
    await getSnsClient().send(new PublishCommand({
      TargetArn:        row.sns_endpoint_arn,
      Message:          message,
      MessageStructure: 'json',
    }))
  } catch (err: unknown) {
    // SNS throws EndpointDisabledException once APNs has reported the
    // token as invalid (app uninstalled, user disabled notifications).
    // Mark the row revoked so we don't keep paying for failed sends.
    const name = (err as { name?: string })?.name ?? ''
    if (name === 'EndpointDisabledException') {
      await query(
        `UPDATE device_tokens
            SET revoked_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      )
      console.log('[push] endpoint disabled — token revoked', { id: row.id })
      return
    }
    console.error('[push] SNS publish failed', { id: row.id, err })
  }
}
