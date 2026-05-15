import { describe, it, expect } from 'vitest'
import { renderStaffEmailHtml, renderStaffEmailText, escapeHtml } from '@/lib/email-staff'

const base = {
  eyebrow:  'Access request',
  heading:  'Jane Doe (Acme Capital)',
  bodyHtml: '<p>Body content here.</p>',
  bodyText: 'Body content here.',
}

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml(`<script>alert("xss" & 'evil')</script>`))
      .toBe('&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;evil&#39;)&lt;/script&gt;')
  })

  it('returns the same string when there are no special characters', () => {
    expect(escapeHtml('Plain text 123')).toBe('Plain text 123')
  })
})

describe('renderStaffEmailHtml', () => {
  it('includes the brand-dark body background', () => {
    const html = renderStaffEmailHtml(base)
    expect(html).toContain('background:#031427')
  })

  it('renders the eyebrow in gold uppercase', () => {
    const html = renderStaffEmailHtml(base)
    expect(html).toContain('Access request')
    expect(html).toContain('color:#e9c176')
    expect(html).toContain('text-transform:uppercase')
  })

  it('renders the heading inside the inner panel', () => {
    const html = renderStaffEmailHtml(base)
    expect(html).toContain('Jane Doe (Acme Capital)')
  })

  it('includes the bodyHtml verbatim (already-escaped by caller)', () => {
    const html = renderStaffEmailHtml(base)
    expect(html).toContain('<p>Body content here.</p>')
  })

  it('renders the CTA button when ctaLabel + ctaPath are provided', () => {
    const html = renderStaffEmailHtml({ ...base, ctaLabel: 'Open admin', ctaPath: '/admin/access-requests' })
    expect(html).toContain('Open admin')
    expect(html).toContain('/admin/access-requests')
  })

  it('omits the CTA block when ctaLabel/ctaPath are missing', () => {
    const html = renderStaffEmailHtml(base)
    expect(html).not.toContain('background:#e9c176;color:#031427;text-decoration:none')
  })

  it('uses the full URL when ctaPath is already absolute', () => {
    const html = renderStaffEmailHtml({ ...base, ctaLabel: 'Open', ctaPath: 'https://example.com/x' })
    expect(html).toContain('https://example.com/x')
  })

  it('escapes user-controlled values in the heading and eyebrow', () => {
    const html = renderStaffEmailHtml({ ...base, heading: '<bad>', eyebrow: 'evil<script>' })
    expect(html).toContain('&lt;bad&gt;')
    expect(html).toContain('evil&lt;script&gt;')
  })

  it('escapes the CTA label too', () => {
    const html = renderStaffEmailHtml({ ...base, ctaLabel: '"click"', ctaPath: '/x' })
    expect(html).toContain('&quot;click&quot;')
  })

  it('includes the staff-notification footer line', () => {
    const html = renderStaffEmailHtml(base)
    expect(html).toMatch(/Staff notification/i)
  })
})

describe('renderStaffEmailText', () => {
  it('emits eyebrow upper-cased, then heading, then body', () => {
    const text = renderStaffEmailText(base)
    expect(text).toContain('ACCESS REQUEST')
    expect(text).toContain('Jane Doe (Acme Capital)')
    expect(text).toContain('Body content here.')
  })

  it('appends the CTA URL when provided as a relative path (prepends APP_BASE_URL)', () => {
    const text = renderStaffEmailText({ ...base, ctaLabel: 'Open admin', ctaPath: '/admin/access-requests' })
    expect(text).toMatch(/Open admin:\s+https?:\/\/.+\/admin\/access-requests/)
  })

  it('keeps an absolute CTA URL unchanged', () => {
    const text = renderStaffEmailText({ ...base, ctaLabel: 'Visit', ctaPath: 'https://example.com/y' })
    expect(text).toContain('Visit: https://example.com/y')
  })

  it('omits the CTA line when ctaLabel/ctaPath are missing', () => {
    const text = renderStaffEmailText(base)
    expect(text).not.toMatch(/^\w+:\s+https?:\/\//m)
  })

  it('closes with the staff-notification signature', () => {
    const text = renderStaffEmailText(base)
    expect(text).toMatch(/staff notification/i)
  })
})
