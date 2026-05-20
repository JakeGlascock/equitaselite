// Email helpers for the public demo (Phase F).
// Two transactional emails:
//   1. Magic link to the prospect — confirms their email before any
//      preview session is minted.
//   2. Staff notification to access@ — fires AFTER the prospect clicks
//      the magic link, so unverified attempts don't generate noise.

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { renderStaffEmailHtml, renderStaffEmailText, escapeHtml } from './email-staff'

const sesClient   = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const FROM_EMAIL  = process.env.FROM_EMAIL ?? 'Equitas Elite <noreply@equitaselite.com>'
const STAFF_EMAIL = process.env.STAFF_EMAIL ?? 'access@equitaselite.com'
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://equitaselite.com'

// ── Magic link to prospect ───────────────────────────────────────────

export interface MagicLinkPayload {
  toEmail:    string
  fullName:   string
  magicUrl:   string
  expiresMinutes: number  // typically 30
}

export async function sendDemoMagicLink(payload: MagicLinkPayload): Promise<void> {
  const firstName = (payload.fullName.split(' ')[0] || 'there').trim()
  const subject   = 'Confirm your Equitas Elite demo'

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#031427;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#bec6e0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#031427;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:rgba(16,32,52,0.8);border:1px solid rgba(69,70,77,0.5);border-radius:12px;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#e9c176;">Demo walkthrough</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 16px 0;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#e9c176;line-height:1.25;">Welcome, ${escapeHtml(firstName)}</h1>
          <p style="margin:0 0 16px 0;color:#bec6e0;font-size:14px;line-height:1.55;">Click below to start your private walkthrough. The link is good for the next ${payload.expiresMinutes} minutes.</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 16px 32px;">
          <a href="${payload.magicUrl}" style="display:inline-block;background:#e9c176;color:#031427;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px;">Start walkthrough</a>
        </td></tr>
        <tr><td style="padding:0 32px 8px 32px;">
          <p style="margin:0;color:#8892a4;font-size:12px;line-height:1.55;">If the button doesn&rsquo;t work, paste this URL into your browser:</p>
          <p style="margin:6px 0 0 0;color:#bec6e0;font-size:12px;word-break:break-all;font-family:'IBM Plex Mono',monospace;">${escapeHtml(payload.magicUrl)}</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid rgba(69,70,77,0.4);">
          <p style="margin:12px 0 0 0;color:#8892a4;font-size:12px;line-height:1.55;">You&rsquo;re seeing this because someone (probably you) requested a demo at ${escapeHtml(APP_BASE_URL)}/try. If that wasn&rsquo;t you, ignore this email and we&rsquo;ll never reach out again.</p>
          <p style="margin:12px 0 0 0;font-family:'IBM Plex Sans',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8892a4;">Equitas Elite</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `Welcome, ${firstName}.

Click the link below to start your Equitas Elite walkthrough. The link is good for the next ${payload.expiresMinutes} minutes.

${payload.magicUrl}

If you didn't request this demo, you can ignore the email — we won't reach out again.

— Equitas Elite`

  await sesClient.send(new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination:      { ToAddresses: [payload.toEmail] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    },
  }))
}

// ── Staff notification after verify ──────────────────────────────────

export interface StaffNotifyPayload {
  fullName:        string
  email:           string
  firmName:        string
  aumRange:        string
  intendedUse:     string
  viewingAsRole:   string
  ip:              string | null
  signupCreatedAt: Date
}

export async function notifyStaffOfDemoSignup(payload: StaffNotifyPayload): Promise<void> {
  const subject = `[Demo] ${payload.fullName} · ${payload.firmName}`
  const eyebrow = 'New demo signup'
  const heading = `${payload.fullName} just started a demo`

  const rows: [string, string][] = [
    ['Firm',          payload.firmName],
    ['Email',         payload.email],
    ['AUM range',     payload.aumRange],
    ['Intended use',  payload.intendedUse],
    ['Viewing as',    formatRole(payload.viewingAsRole)],
    ['Signed up',     payload.signupCreatedAt.toISOString()],
    ['Source IP',     payload.ip ?? 'unknown'],
  ]
  const rowHtml = rows.map(([k, v]) =>
    `<tr>
       <td style="padding:6px 12px 6px 0;color:#8892a4;font-size:12px;white-space:nowrap;">${escapeHtml(k)}</td>
       <td style="padding:6px 0;color:#bec6e0;font-size:13px;">${escapeHtml(v)}</td>
     </tr>`,
  ).join('')

  const bodyHtml = `<p style="margin:0 0 12px 0;">A prospect verified their email and started a walkthrough.</p>
  <table role="presentation" cellpadding="0" cellspacing="0">${rowHtml}</table>`
  const bodyText = rows.map(([k, v]) => `${k}: ${v}`).join('\n')

  const html = renderStaffEmailHtml({ eyebrow, heading, bodyHtml, bodyText })
  const text = renderStaffEmailText({ eyebrow, heading, bodyHtml, bodyText })

  await sesClient.send(new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination:      { ToAddresses: [STAFF_EMAIL] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    },
  }))
}

function formatRole(r: string): string {
  return ({
    angel:             'Angel Investor',
    family_office:     'Family Office',
    next_gen:          'Next Gen',
    family_foundation: 'Family Foundation',
    daf:               'DAF',
  } as Record<string, string>)[r] ?? r
}
