#!/usr/bin/env node
// Weekly match digest runner.
//
// For each onboarded user with email_notifications_enabled=TRUE, finds
// opposite-role profiles that completed onboarding since the user's
// last_sent_at, and (if there are any) emails them a one-line summary
// with a link to /dashboard. Updates last_sent_at on success.
//
// Designed to run as an ECS one-off Fargate task on a weekly EventBridge
// schedule (see infrastructure/digest.tf). Can also be invoked manually
// via `aws ecs run-task --overrides '{"containerOverrides":[{"name":"app","command":["node","scripts/digest.mjs"]}]}'`.
//
// Flags (process.env):
//   DIGEST_DRY_RUN=1  → log what would be sent, don't call SES, don't
//                       update last_sent_at. Useful for ad-hoc testing.
//   DIGEST_LIMIT=N    → process at most N users (default: no limit).

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const SITE_URL    = process.env.SITE_URL           ?? 'https://equitaselite.com'
const FROM_EMAIL  = process.env.SES_FROM_EMAIL     ?? 'Equitas Elite <noreply@equitaselite.com>'
const POSTAL_ADDR = process.env.SES_FOOTER_ADDRESS ?? 'Equitas Elite · 1209 N Orange St, Wilmington, DE 19801, USA'

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function required(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`[digest] Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

function roleLabel(role) {
  return role === 'angel' ? 'angel investors' : 'family offices'
}

function plural(n, singular, plural) {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`
}

// ─── Pure helpers (testable in isolation) ────────────────────────────────

// Compose the email body. Pure function — no SES, no DB. Returns
// { subject, text, html, unsubscribeUrl } given the recipient's role,
// email, the list of new counterparty rows, and their unsubscribe token.
export function composeDigest({ firstName, email, role, newCount, sampleNames, unsubscribeToken }) {
  const counterRole = roleLabel(role === 'angel' ? 'family_office' : 'angel')
  const subject = newCount === 1
    ? `A new ${counterRole.slice(0, -1)} joined Equitas Elite`
    : `${newCount} new ${counterRole} on Equitas Elite this week`

  const unsubscribeUrl = `${SITE_URL}/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}`
  const heading        = newCount === 1
    ? `1 new ${counterRole.slice(0, -1)} this week`
    : `${newCount} new ${counterRole} this week`
  const year           = new Date().getFullYear()

  // Plain-text body (still required as the multipart alternative)
  const lines = [
    `Hi ${firstName},`,
    ``,
    `Since your last digest, ${plural(newCount, counterRole.slice(0, -1), counterRole)} ` +
      `completed onboarding on Equitas Elite.`,
  ]
  if (sampleNames.length > 0) {
    lines.push('')
    lines.push('A few highlights:')
    for (const n of sampleNames) lines.push(`  · ${n}`)
  }
  lines.push('')
  lines.push(`Review them on your dashboard: ${SITE_URL}/dashboard`)
  lines.push('')
  lines.push(`— Equitas Elite`)
  lines.push('')
  lines.push(`—`)
  lines.push(``)
  lines.push(`You received this transactional notice because you have an Equitas Elite`)
  lines.push(`account at ${email}.`)
  lines.push(``)
  lines.push(`Unsubscribe:    ${unsubscribeUrl}`)
  lines.push(`Preferences:    ${SITE_URL}/profile`)
  lines.push(`Privacy policy: ${SITE_URL}/privacy`)
  lines.push(``)
  lines.push(`© ${year} Equitas Elite. ${POSTAL_ADDR}`)

  const text = lines.join('\n')

  // Branded HTML body — matches lib/email.ts intro-notification template
  const highlightsBlock = sampleNames.length === 0 ? '' : `
        <p style="margin:16px 0 6px 0;color:#8892a4;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">A few highlights</p>
        <ul style="margin:0;padding:0;list-style:none;color:#bec6e0;font-size:15px;line-height:1.6;">
${sampleNames.map(n => `          <li style="padding:4px 0;border-bottom:1px solid rgba(69,70,77,0.3);">${escapeHtml(n)}</li>`).join('\n')}
        </ul>`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#031427;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#bec6e0;">
  <div style="display:none;max-height:0;overflow:hidden;color:#031427;">${escapeHtml(`${newCount} new ${counterRole}`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#031427;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:rgba(16,32,52,0.8);border:1px solid rgba(69,70,77,0.5);border-radius:12px;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8892a4;">Equitas Elite · Weekly digest</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 16px 0;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:600;color:#e9c176;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 8px 0;color:#bec6e0;font-size:15px;">Hi ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 8px 0;color:#bec6e0;font-size:15px;line-height:1.5;">Since your last digest, <strong>${escapeHtml(plural(newCount, counterRole.slice(0, -1), counterRole))}</strong> completed onboarding on Equitas Elite.</p>
          ${highlightsBlock}
        </td></tr>
        <tr><td align="center" style="padding:24px 32px 32px 32px;">
          <a href="${SITE_URL}/dashboard"
             style="display:inline-block;background:#e9c176;color:#031427;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
            Review them on your dashboard
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;border-top:1px solid rgba(69,70,77,0.4);">
          <p style="margin:16px 0 6px 0;font-size:11px;color:#8892a4;line-height:1.6;">
            You received this transactional notice because you have an Equitas Elite account at <strong style="color:#bec6e0;">${escapeHtml(email)}</strong>.
          </p>
          <p style="margin:0 0 12px 0;font-size:11px;color:#8892a4;line-height:1.6;">
            <a style="color:#bec6e0;text-decoration:underline;" href="${unsubscribeUrl}">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a style="color:#8892a4;text-decoration:underline;" href="${SITE_URL}/profile">Email preferences</a>
            &nbsp;·&nbsp;
            <a style="color:#8892a4;text-decoration:underline;" href="${SITE_URL}/privacy">Privacy</a>
          </p>
          <p style="margin:0;font-size:10px;color:#5a6378;line-height:1.6;">
            © ${year} Equitas Elite. ${escapeHtml(POSTAL_ADDR)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, text, html, unsubscribeUrl }
}

// ─── Runner ──────────────────────────────────────────────────────────────

async function main() {
  const started = Date.now()
  const dryRun  = process.env.DIGEST_DRY_RUN === '1'
  const limit   = process.env.DIGEST_LIMIT ? Number(process.env.DIGEST_LIMIT) : null
  console.log(`[digest] starting · dryRun=${dryRun} · limit=${limit ?? '∞'}`)

  const { Pool } = await import('pg')
  const pool = new Pool({
    host:     required('DB_HOST'),
    port:     Number(process.env.DB_PORT ?? 5432),
    user:     required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    ssl: { rejectUnauthorized: false },
    max:               2,
    idleTimeoutMillis: 5000,
  })

  // Lazy import the SES SDK — same reason as pg, keeps the test harness clean.
  const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2')
  const ses = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

  const client = await pool.connect()
  let sent = 0
  let skipped = 0
  let failed = 0
  try {
    // Recipients: onboarded users with email_notifications_enabled=TRUE.
    // Exclude concierges (they're staff, not investors).
    const recipientsSql = `
      SELECT p.id, p.email, p.full_name, p.role, p.unsubscribe_token,
             COALESCE(s.last_sent_at, p.created_at) AS since
      FROM profiles p
      LEFT JOIN match_digest_state s ON s.user_id = p.id
      WHERE p.onboarding_completed = TRUE
        AND COALESCE(p.email_notifications_enabled, TRUE) = TRUE
        AND (p.is_concierge IS NULL OR p.is_concierge = FALSE)
      ORDER BY p.created_at
      ${limit ? 'LIMIT ' + Number(limit) : ''}
    `
    const recipients = (await client.query(recipientsSql)).rows
    console.log(`[digest] ${recipients.length} candidate recipient(s)`)

    for (const r of recipients) {
      const oppositeRole = r.role === 'angel' ? 'family_office' : 'angel'
      const newMatches = (await client.query(
        `SELECT id, full_name, firm_name
         FROM profiles
         WHERE role = $1
           AND onboarding_completed = TRUE
           AND created_at > $2
           AND id != $3
           AND (is_concierge IS NULL OR is_concierge = FALSE)
         ORDER BY created_at DESC
         LIMIT 50`,
        [oppositeRole, r.since, r.id]
      )).rows

      if (newMatches.length === 0) {
        skipped++
        continue
      }

      const sampleNames = newMatches.slice(0, 3).map(m => `${m.full_name} · ${m.firm_name}`)
      const { subject, text, html, unsubscribeUrl } = composeDigest({
        firstName:        (r.full_name ?? r.email).split(' ')[0],
        email:            r.email,
        role:             r.role,
        newCount:         newMatches.length,
        sampleNames,
        unsubscribeToken: r.unsubscribe_token,
      })

      if (dryRun) {
        console.log(`[digest] DRY-RUN → ${r.email} :: "${subject}" (${newMatches.length} new) · ${unsubscribeUrl}`)
        sent++
        continue
      }

      try {
        await ses.send(new SendEmailCommand({
          FromEmailAddress: FROM_EMAIL,
          Destination:      { ToAddresses: [r.email] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: html, Charset: 'UTF-8' },
                Text: { Data: text, Charset: 'UTF-8' },
              },
              // RFC 2369 + RFC 8058 — Gmail / Apple Mail render a
              // one-click "Unsubscribe" link at the top of the email.
              Headers: [
                { Name: 'List-Unsubscribe',      Value: `<${unsubscribeUrl}>` },
                { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
              ],
            },
          },
        }))
        await client.query(
          `INSERT INTO match_digest_state (user_id, last_sent_at) VALUES ($1, NOW())
           ON CONFLICT (user_id) DO UPDATE SET last_sent_at = NOW()`,
          [r.id]
        )
        sent++
        console.log(`[digest] sent → ${r.email} (${newMatches.length} new)`)
      } catch (err) {
        failed++
        console.error(`[digest] FAILED → ${r.email}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    console.log(
      `[digest] complete · sent=${sent} skipped=${skipped} failed=${failed} ` +
      `· ${Date.now() - started}ms`
    )
  } finally {
    client.release()
    await pool.end()
  }
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isEntryPoint) {
  main().catch(err => {
    console.error('[digest] fatal:', err instanceof Error ? err.stack : String(err))
    process.exit(1)
  })
}
