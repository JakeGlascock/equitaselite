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

const SITE_URL  = process.env.SITE_URL ?? 'https://equitaselite.com'
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'Equitas Elite <noreply@equitaselite.com>'

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
// { subject, text, html } given the recipient's role + the list of new
// counterparty rows.
export function composeDigest({ firstName, role, newCount, sampleNames }) {
  const counterRole = roleLabel(role === 'angel' ? 'family_office' : 'angel')
  const subject = newCount === 1
    ? `A new ${counterRole.slice(0, -1)} joined Equitas Elite`
    : `${newCount} new ${counterRole} on Equitas Elite this week`

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
  lines.push(`To stop receiving these alerts, turn off email notifications in your profile settings.`)
  lines.push(`— Equitas Elite`)

  return { subject, text: lines.join('\n') }
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
      SELECT p.id, p.email, p.full_name, p.role,
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
      const { subject, text } = composeDigest({
        firstName:   (r.full_name ?? r.email).split(' ')[0],
        role:        r.role,
        newCount:    newMatches.length,
        sampleNames,
      })

      if (dryRun) {
        console.log(`[digest] DRY-RUN → ${r.email} :: "${subject}" (${newMatches.length} new)`)
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
              Body:    { Text: { Data: text,    Charset: 'UTF-8' } },
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
