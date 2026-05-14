import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { query } from '@/lib/db'

const sesClient = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'Equitas Elite <noreply@equitaselite.com>'
const INBOX      = process.env.ACCESS_INBOX  ?? 'access@equitaselite.com'

const RequestSchema = z.object({
  email:     z.string().email().max(254),
  full_name: z.string().min(1).max(200),
  firm_name: z.string().min(1).max(200),
  role:      z.enum(['angel', 'family_office']),
  notes:     z.string().max(2000).optional(),
})

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

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
    // Most common cause: init-access-requests hasn't been run yet on this DB
    return NextResponse.json(
      { error: 'We couldn\'t record your request. Email access@equitaselite.com directly.' },
      { status: 500 }
    )
  }

  // Email notification to the inbox. Failures here are non-fatal — the DB
  // record is enough; admins will see the request on /admin/access-requests.
  const roleLabel = role === 'angel' ? 'Angel investor' : 'Family office'
  try {
    await sesClient.send(new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination:      { ToAddresses: [INBOX] },
      ReplyToAddresses: [email],
      Content: {
        Simple: {
          Subject: { Data: `Access request: ${full_name} (${firm_name})`, Charset: 'UTF-8' },
          Body: {
            Html: {
              Data: `
                <p><strong>${escapeHtml(full_name)}</strong> from <strong>${escapeHtml(firm_name)}</strong> has requested access.</p>
                <p>
                  Role: <strong>${escapeHtml(roleLabel)}</strong><br>
                  Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
                </p>
                ${notes
                  ? `<p style="margin-top:16px;"><em>Notes:</em></p><blockquote style="border-left:3px solid #e9c176;padding:8px 12px;margin:0;background:#f7f0dd;">${escapeHtml(notes).replaceAll('\n','<br>')}</blockquote>`
                  : ''
                }
                <p style="margin-top:24px;">Manage on the <a href="https://equitaselite.com/admin/access-requests">admin page</a>.</p>
              `,
              Charset: 'UTF-8',
            },
            Text: {
              Data: `${full_name} from ${firm_name} has requested access.\n\nRole: ${roleLabel}\nEmail: ${email}\n${notes ? '\nNotes:\n' + notes : ''}\n\nManage at https://equitaselite.com/admin/access-requests`,
              Charset: 'UTF-8',
            },
          },
        },
      },
    }))
  } catch (err: unknown) {
    console.error('access-request email failed (DB record was saved):', err)
  }

  return NextResponse.json({ ok: true })
}
