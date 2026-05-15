import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { queryOne } from './db'

const sesClient = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const FROM_EMAIL   = process.env.SES_FROM_EMAIL   ?? 'Equitas Elite <noreply@equitaselite.com>'
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://equitaselite.com'

interface RecipientPref {
  email: string
  full_name: string
  email_notifications_enabled: boolean
  unsubscribe_token: string | null
}

// Pulls the recipient's email + opt-in state + unsubscribe token in
// a single query. unsubscribe_token may be NULL pre-migration-012.
async function getRecipient(userId: string): Promise<RecipientPref | null> {
  try {
    return await queryOne<RecipientPref>(
      `SELECT email, full_name, email_notifications_enabled, unsubscribe_token
       FROM profiles WHERE id = $1`,
      [userId]
    )
  } catch {
    // Fallback for environments where migration 012 hasn't run yet
    const r = await queryOne<Omit<RecipientPref, 'unsubscribe_token'>>(
      `SELECT email, full_name, email_notifications_enabled
       FROM profiles WHERE id = $1`,
      [userId]
    )
    return r ? { ...r, unsubscribe_token: null } : null
  }
}

interface BodyParts {
  subject: string
  preview: string
  heading: string
  bodyHtml: string
  bodyText: string
  ctaLabel: string
  ctaPath:  string
}

function renderHtml(parts: BodyParts, recipientName: string): string {
  const firstName = recipientName.split(' ')[0]
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${parts.subject}</title></head>
<body style="margin:0;padding:0;background:#031427;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#bec6e0;">
  <div style="display:none;max-height:0;overflow:hidden;color:#031427;">${parts.preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#031427;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:rgba(16,32,52,0.8);border:1px solid rgba(69,70,77,0.5);border-radius:12px;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8892a4;">Equitas Elite</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 16px 0;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:600;color:#e9c176;">${parts.heading}</h1>
          <p style="margin:0 0 8px 0;color:#bec6e0;font-size:15px;">Hi ${firstName},</p>
          <div style="color:#bec6e0;font-size:15px;line-height:1.5;">${parts.bodyHtml}</div>
        </td></tr>
        <tr><td align="center" style="padding:24px 32px 32px 32px;">
          <a href="${APP_BASE_URL}${parts.ctaPath}"
             style="display:inline-block;background:#e9c176;color:#031427;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
            ${parts.ctaLabel}
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;border-top:1px solid rgba(69,70,77,0.4);">
          <p style="margin:16px 0 0 0;font-size:11px;color:#8892a4;line-height:1.6;">
            You can turn off these emails from <a style="color:#8892a4;" href="${APP_BASE_URL}/profile">your profile settings</a>.
            Equitas Elite, transactional notice.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function renderText(parts: BodyParts, recipientName: string): string {
  const firstName = recipientName.split(' ')[0]
  return `Hi ${firstName},

${parts.heading}

${parts.bodyText}

${parts.ctaLabel}: ${APP_BASE_URL}${parts.ctaPath}

— Equitas Elite

You can turn off these emails from your profile settings at ${APP_BASE_URL}/profile.`
}

async function send(recipient: RecipientPref, parts: BodyParts): Promise<void> {
  // List-Unsubscribe headers (RFC 2369 + RFC 8058) make Gmail / Apple Mail
  // render a one-click "Unsubscribe" link at the top of the email.
  // Skipped silently if the unsubscribe_token column hasn't been migrated
  // (the existing in-app /profile toggle still works).
  const headers = recipient.unsubscribe_token
    ? [
        { Name: 'List-Unsubscribe',      Value: `<${APP_BASE_URL}/unsubscribe?t=${recipient.unsubscribe_token}>` },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
      ]
    : undefined

  await sesClient.send(new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination:      { ToAddresses: [recipient.email] },
    Content: {
      Simple: {
        Subject: { Data: parts.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: renderHtml(parts, recipient.full_name), Charset: 'UTF-8' },
          Text: { Data: renderText(parts, recipient.full_name), Charset: 'UTF-8' },
        },
        Headers: headers,
      },
    },
  }))
}

// ─── Templates ───────────────────────────────────────────────

export async function emailIntroRequested(
  recipientId: string,
  requesterName: string,
  requesterFirm: string,
  message: string | null,
): Promise<void> {
  const recipient = await getRecipient(recipientId)
  if (!recipient?.email_notifications_enabled) return

  const trimmed = message?.trim() ?? ''
  const messageHtml = trimmed
    ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #e9c176;background:rgba(233,193,118,0.06);color:#bec6e0;font-style:italic;">${escapeHtml(trimmed)}</blockquote>`
    : ''
  const messageText = trimmed ? `\n\n"${trimmed}"\n` : ''

  await send(recipient, {
    subject:  `${requesterName} requested an introduction`,
    preview:  `From ${requesterFirm}`,
    heading:  'New introduction request',
    bodyHtml: `<strong>${escapeHtml(requesterName)}</strong> from <strong>${escapeHtml(requesterFirm)}</strong> would like to be introduced.${messageHtml}`,
    bodyText: `${requesterName} from ${requesterFirm} would like to be introduced.${messageText}`,
    ctaLabel: 'Review request',
    ctaPath:  '/connections',
  })
}

export async function emailIntroAccepted(
  requesterId: string,
  recipientName: string,
  recipientFirm: string,
  recipientEmail: string,
): Promise<void> {
  const requester = await getRecipient(requesterId)
  if (!requester?.email_notifications_enabled) return

  await send(requester, {
    subject:  `${recipientName} accepted your introduction`,
    preview:  `Reach out at ${recipientEmail}`,
    heading:  'Introduction accepted',
    bodyHtml: `<strong>${escapeHtml(recipientName)}</strong> from <strong>${escapeHtml(recipientFirm)}</strong> accepted your introduction. You can reach them at <a href="mailto:${escapeHtml(recipientEmail)}" style="color:#e9c176;">${escapeHtml(recipientEmail)}</a>.`,
    bodyText: `${recipientName} from ${recipientFirm} accepted your introduction. You can reach them at ${recipientEmail}.`,
    ctaLabel: 'View connection',
    ctaPath:  '/connections',
  })
}

export async function emailIntroDeclined(
  requesterId: string,
  recipientName: string,
  recipientFirm: string,
): Promise<void> {
  const requester = await getRecipient(requesterId)
  if (!requester?.email_notifications_enabled) return

  await send(requester, {
    subject:  `${recipientName} declined your introduction`,
    preview:  `${recipientFirm} passed on the introduction`,
    heading:  'Introduction declined',
    bodyHtml: `<strong>${escapeHtml(recipientName)}</strong> from <strong>${escapeHtml(recipientFirm)}</strong> passed on the introduction. Plenty of other strong matches on your dashboard.`,
    bodyText: `${recipientName} from ${recipientFirm} passed on the introduction. Plenty of other strong matches on your dashboard.`,
    ctaLabel: 'See more matches',
    ctaPath:  '/dashboard',
  })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
