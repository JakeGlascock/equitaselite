import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { query } from '@/lib/db'
import { renderStaffEmailHtml, renderStaffEmailText, escapeHtml } from '@/lib/email-staff'

const sesClient = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'Equitas Elite <system@equitaselite.com>'
const INBOX      = process.env.ACCESS_INBOX  ?? 'access@equitaselite.com'

const RequestSchema = z.object({
  email:     z.string().email().max(254),
  full_name: z.string().min(1).max(200),
  firm_name: z.string().min(1).max(200),
  role:      z.enum(['angel', 'family_office']),
  notes:     z.string().max(2000).optional(),
})


export async function POST(req: NextRequest) {
  const parsed = RequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please double-check the form fields and try again.' }, { status: 400 })
  }
  const { email, full_name, firm_name, role, notes } = parsed.data

  // DB is the source of truth — the inbox email is a notification on top.
  try {
    await query(
      `INSERT INTO access_requests (email, full_name, firm_name, role, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, full_name, firm_name, role, notes ?? null]
    )
  } catch (err: unknown) {
    // Most common cause: init-access-requests hasn't been run yet on this DB.
    // Log the underlying error so future failures (constraint violations,
    // connection issues) don't hide behind the generic user-facing message.
    console.error('access-request DB insert failed:', err)
    return NextResponse.json(
      { error: 'We couldn\'t record your request. Email access@equitaselite.com directly.' },
      { status: 500 }
    )
  }

  // Email notification to the inbox. Failures here are non-fatal — the DB
  // record is enough; admins will see the request on /admin/access-requests.
  const roleLabel = role === 'angel' ? 'Angel investor' : 'Family office'
  try {
    const notesHtml = notes
      ? `<blockquote style="margin:16px 0 0 0;padding:10px 14px;border-left:3px solid #e9c176;background:rgba(233,193,118,0.06);color:#bec6e0;font-style:italic;">${escapeHtml(notes).replaceAll('\n','<br>')}</blockquote>`
      : ''
    const notesText = notes ? `\n\nNotes:\n${notes}` : ''

    const parts = {
      eyebrow:  'Access request',
      heading:  `${full_name} (${firm_name})`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;"><strong style="color:#e9c176;">${escapeHtml(full_name)}</strong> from <strong style="color:#e9c176;">${escapeHtml(firm_name)}</strong> has requested access.</p>
        <p style="margin:0;">
          Role: <strong>${escapeHtml(roleLabel)}</strong><br>
          Email: <a href="mailto:${escapeHtml(email)}" style="color:#e9c176;">${escapeHtml(email)}</a>
        </p>
        ${notesHtml}
      `,
      bodyText:  `${full_name} from ${firm_name} has requested access.\n\nRole: ${roleLabel}\nEmail: ${email}${notesText}`,
      ctaLabel:  'Manage on admin page',
      ctaPath:   '/admin/access-requests',
    }

    await sesClient.send(new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination:      { ToAddresses: [INBOX] },
      ReplyToAddresses: [email],
      Content: {
        Simple: {
          Subject: { Data: `Access request: ${full_name} (${firm_name})`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: renderStaffEmailHtml(parts), Charset: 'UTF-8' },
            Text: { Data: renderStaffEmailText(parts), Charset: 'UTF-8' },
          },
        },
      },
    }))
  } catch (err: unknown) {
    console.error('access-request email failed (DB record was saved):', err)
  }

  return NextResponse.json({ ok: true })
}
