// Renders staff-notification emails (internal alerts to access@ or the
// concierge inbox) in the same dark navy + gold brand as user-facing mail.
// Smaller than lib/email.ts's user template because there's no unsubscribe
// or CAN-SPAM footer — these are internal operational notices, not
// commercial mail.

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://equitaselite.com'

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export interface StaffEmail {
  eyebrow:  string   // e.g. "Access request" — small uppercase gold label above the headline
  heading:  string   // serif gold headline
  bodyHtml: string   // pre-escaped HTML for the body region
  bodyText: string   // plain-text equivalent of bodyHtml for the text/plain part
  ctaLabel?: string  // optional button label
  ctaPath?:  string  // optional button target (relative or absolute)
}

export function renderStaffEmailHtml(parts: StaffEmail): string {
  const ctaBlock = parts.ctaLabel && parts.ctaPath
    ? `<tr><td align="center" style="padding:20px 32px 8px 32px;">
         <a href="${parts.ctaPath.startsWith('http') ? parts.ctaPath : APP_BASE_URL + parts.ctaPath}"
            style="display:inline-block;background:#e9c176;color:#031427;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px;">
           ${escapeHtml(parts.ctaLabel)}
         </a>
       </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(parts.heading)}</title></head>
<body style="margin:0;padding:0;background:#031427;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#bec6e0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#031427;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:rgba(16,32,52,0.8);border:1px solid rgba(69,70,77,0.5);border-radius:12px;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#e9c176;">${escapeHtml(parts.eyebrow)}</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 16px 0;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#e9c176;line-height:1.25;">${escapeHtml(parts.heading)}</h1>
          <div style="color:#bec6e0;font-size:14px;line-height:1.55;">${parts.bodyHtml}</div>
        </td></tr>
        ${ctaBlock}
        <tr><td style="padding:0 32px 24px 32px;border-top:1px solid rgba(69,70,77,0.4);">
          <p style="margin:16px 0 0 0;font-family:'IBM Plex Sans',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8892a4;">Staff notification · Equitas Elite</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// Plain-text counterpart. Keeps the same content + (optional) CTA URL so
// recipients on text-only clients still get everything.
export function renderStaffEmailText(parts: StaffEmail): string {
  const cta = parts.ctaLabel && parts.ctaPath
    ? `\n\n${parts.ctaLabel}: ${parts.ctaPath.startsWith('http') ? parts.ctaPath : APP_BASE_URL + parts.ctaPath}`
    : ''
  return `${parts.eyebrow.toUpperCase()}\n\n${parts.heading}\n\n${parts.bodyText}${cta}\n\n— Equitas Elite (staff notification)`
}
