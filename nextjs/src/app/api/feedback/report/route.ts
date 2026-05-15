import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { query } from '@/lib/db'
import { renderStaffEmailHtml, renderStaffEmailText, escapeHtml } from '@/lib/email-staff'
import { PREVIEW_COOKIE_NAME, isDemoProfileId } from '@/lib/preview'

const sesClient = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'Equitas Elite <noreply@equitaselite.com>'
const INBOX      = process.env.FEEDBACK_INBOX ?? process.env.ACCESS_INBOX ?? 'access@equitaselite.com'

const Schema = z.object({
  message: z.string().trim().min(3, 'Tell us a sentence or two.').max(4000),
  path:    z.string().trim().min(1).max(1024),
  digest:  z.string().trim().max(120).optional(),
  type:    z.enum(['bug', 'idea', 'other']).default('bug'),
  context: z.record(z.string(), z.unknown()).optional(),
})

const TYPE_LABEL: Record<'bug' | 'idea' | 'other', string> = {
  bug:   'Bug',
  idea:  'Idea',
  other: 'Feedback',
}

// POST /api/feedback/report — public, no auth required.
// Error pages render before auth is established (and preview visitors
// don't have auth), so the report endpoint accepts unauthenticated
// submissions. We opportunistically capture the user_id (real or
// demo_*) if cookies are present.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }
  const { message, path, digest, type, context } = parsed.data

  // Middleware doesn't reach public routes, so x-user-id won't be set
  // here. Read the preview cookie directly and gate on demo_* prefix.
  const previewId = req.cookies.get(PREVIEW_COOKIE_NAME)?.value
  const userId    = isDemoProfileId(previewId) ? previewId : null
  const userAgent = req.headers.get('user-agent') ?? null

  try {
    // Try the fullest INSERT first; fall back if migration 022 hasn't run
    // yet (type column missing).
    try {
      await query(
        `INSERT INTO user_reports (user_id, digest, path, user_agent, message, type, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, digest ?? null, path, userAgent, message, type, context ? JSON.stringify(context) : null]
      )
    } catch (err: unknown) {
      if (err instanceof Error && /column "type"/i.test(err.message)) {
        await query(
          `INSERT INTO user_reports (user_id, digest, path, user_agent, message, context)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, digest ?? null, path, userAgent, message, context ? JSON.stringify(context) : null]
        )
      } else {
        throw err
      }
    }
  } catch (err: unknown) {
    console.error('user_report insert failed:', err)
    return NextResponse.json({ error: 'Could not save report' }, { status: 500 })
  }

  // Staff notification. Non-fatal — DB row is the source of truth, and
  // we don't want a missing SES identity to block users from reporting.
  try {
    const reporterLabel = userId
      ? (userId.startsWith('demo_') ? 'investor preview visitor' : userId)
      : 'anonymous visitor'
    const typeLabel = TYPE_LABEL[type]
    const parts = {
      eyebrow: `User ${type}`,
      heading: `${typeLabel} from ${reporterLabel}`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;">A visitor reported a problem.</p>
        <p style="margin:0;">
          Path: <strong style="color:#e9c176;">${escapeHtml(path)}</strong><br>
          ${digest    ? `Digest: <code style="color:#e9c176;">${escapeHtml(digest)}</code><br>` : ''}
          ${userId    ? `User: <strong>${escapeHtml(userId)}</strong><br>`                    : ''}
          ${userAgent ? `User agent: ${escapeHtml(userAgent)}<br>`                            : ''}
        </p>
        <blockquote style="margin:16px 0 0 0;padding:10px 14px;border-left:3px solid #e9c176;background:rgba(233,193,118,0.06);color:#bec6e0;font-style:italic;">${escapeHtml(message).replaceAll('\n','<br>')}</blockquote>
      `,
      bodyText:
        `Path: ${path}\n` +
        (digest    ? `Digest: ${digest}\n`        : '') +
        (userId    ? `User: ${userId}\n`          : '') +
        (userAgent ? `User agent: ${userAgent}\n` : '') +
        `\nMessage:\n${message}`,
    }

    await sesClient.send(new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination:      { ToAddresses: [INBOX] },
      Content: {
        Simple: {
          Subject: { Data: `[${typeLabel}] ${path}`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: renderStaffEmailHtml(parts), Charset: 'UTF-8' },
            Text: { Data: renderStaffEmailText(parts), Charset: 'UTF-8' },
          },
        },
      },
    }))
  } catch (err: unknown) {
    console.error('user_report email send failed:', err)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
