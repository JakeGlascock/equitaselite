import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { query, queryOne } from '@/lib/db'
import { renderStaffEmailHtml, renderStaffEmailText, escapeHtml } from '@/lib/email-staff'

const sesClient = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const FROM_EMAIL  = process.env.SES_FROM_EMAIL          ?? 'Equitas Elite <system@equitaselite.com>'
const CONCIERGE_INBOX = process.env.DEFAULT_CONCIERGE_EMAIL ?? 'chelsea@equitaselite.com'

// Schema mirrors the values defined in ConciergeForm.tsx. CATEGORIES are
// canonical short keys; URGENCIES match the strings the user picks.
const RequestSchema = z.object({
  category: z.enum(['introduction','diligence','vetting','market','mandate','other']),
  urgency:  z.enum(['Routine','Within a week','Within 48 hours']),
  details:  z.string().trim().min(10, 'Please add a few sentences of context.').max(2000),
})

const CATEGORY_LABEL: Record<z.infer<typeof RequestSchema>['category'], string> = {
  introduction: 'Bespoke introduction',
  diligence:    'Due diligence support',
  vetting:      'Counterparty vetting',
  market:       'Market intelligence',
  mandate:      'Mandate review',
  other:        'Something else',
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = RequestSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first.message ?? 'Invalid request' },
      { status: 400 }
    )
  }
  const { category, urgency, details } = parsed.data

  // Look up the requester so the staff email has useful context. The
  // DB INSERT below will fail anyway if the user has no profile row,
  // but checking up-front gives a friendlier error.
  const requester = await queryOne<{ full_name: string; email: string; firm_name: string; role: string }>(
    'SELECT full_name, email, firm_name, role FROM profiles WHERE id = $1',
    [userId]
  )
  if (!requester) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // DB is the source of truth — the staff email is a notification.
  try {
    await query(
      `INSERT INTO concierge_requests (user_id, category, urgency, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, category, urgency, details]
    )
  } catch (err: unknown) {
    console.error('concierge-request DB insert failed:', err)
    return NextResponse.json(
      { error: 'We couldn\'t record your request. Email access@equitaselite.com directly.' },
      { status: 500 }
    )
  }

  // Notify the concierge inbox. Failures here are non-fatal — the DB
  // row is enough; the concierge can sweep open requests from the
  // dashboard (once it exists) or from the table directly.
  const categoryLabel = CATEGORY_LABEL[category]
  const roleLabel     = requester.role === 'angel' ? 'Angel investor' : 'Family office'
  try {
    const detailsHtml = `<blockquote style="margin:16px 0 0 0;padding:10px 14px;border-left:3px solid #e9c176;background:rgba(233,193,118,0.06);color:#bec6e0;font-style:italic;">${escapeHtml(details).replaceAll('\n','<br>')}</blockquote>`

    const parts = {
      eyebrow:  'Concierge request',
      heading:  `${categoryLabel} — ${urgency}`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;"><strong style="color:#e9c176;">${escapeHtml(requester.full_name)}</strong> from <strong style="color:#e9c176;">${escapeHtml(requester.firm_name)}</strong> has submitted a concierge request.</p>
        <p style="margin:0;">
          Category: <strong>${escapeHtml(categoryLabel)}</strong><br>
          Urgency: <strong>${escapeHtml(urgency)}</strong><br>
          Role: <strong>${escapeHtml(roleLabel)}</strong><br>
          Email: <a href="mailto:${escapeHtml(requester.email)}" style="color:#e9c176;">${escapeHtml(requester.email)}</a>
        </p>
        ${detailsHtml}
        <p style="margin:18px 0 0 0;font-size:12px;color:#8892a4;">Reply directly — Reply-To routes back to the requester.</p>
      `,
      bodyText:
        `${requester.full_name} from ${requester.firm_name} has submitted a concierge request.\n\n` +
        `Category: ${categoryLabel}\n` +
        `Urgency:  ${urgency}\n` +
        `Role:     ${roleLabel}\n` +
        `Email:    ${requester.email}\n\n` +
        `Details:\n${details}\n\n` +
        `Reply directly to this email — it routes back to the requester.`,
    }

    await sesClient.send(new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination:      { ToAddresses: [CONCIERGE_INBOX] },
      ReplyToAddresses: [requester.email],
      Content: {
        Simple: {
          Subject: { Data: `[Concierge] ${categoryLabel} — ${urgency} (${requester.firm_name})`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: renderStaffEmailHtml(parts), Charset: 'UTF-8' },
            Text: { Data: renderStaffEmailText(parts), Charset: 'UTF-8' },
          },
        },
      },
    }))
  } catch (err: unknown) {
    console.error('concierge-request email send failed:', err)
    // Intentionally non-fatal — the DB row is the source of truth.
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
