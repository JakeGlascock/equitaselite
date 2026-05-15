import { describe, it, expect } from 'vitest'
import { composeDigest } from '../digest.mjs'

const TOKEN = '11111111-2222-3333-4444-555555555555'

function compose(over = {}) {
  return composeDigest({
    firstName:        'Alex',
    email:            'alex@example.com',
    role:             'angel',
    newCount:         2,
    sampleNames:      [],
    unsubscribeToken: TOKEN,
    ...over,
  })
}

describe('composeDigest', () => {
  it('uses singular subject when there is exactly one new match', () => {
    expect(compose({ newCount: 1 }).subject).toBe('A new family office joined Equitas Elite')
  })

  it('uses plural subject for multiple new matches', () => {
    expect(compose({ newCount: 4 }).subject).toBe('4 new family offices on Equitas Elite this week')
  })

  it('flips the counter-role for family-office recipients', () => {
    expect(compose({ role: 'family_office', newCount: 3 }).subject)
      .toBe('3 new angel investors on Equitas Elite this week')
  })

  it('greets by first name', () => {
    expect(compose({ firstName: 'Alex' }).text).toMatch(/^Hi Alex,/)
  })

  it('omits the highlights block when there are no sample names', () => {
    expect(compose({ sampleNames: [] }).text).not.toContain('A few highlights')
  })

  it('includes sample names verbatim when provided', () => {
    const { text } = compose({
      sampleNames: ['Aria Mendes · Apex FO', 'Catherine Hartwell · Hartwell Capital'],
    })
    expect(text).toContain('A few highlights:')
    expect(text).toContain('Aria Mendes · Apex FO')
    expect(text).toContain('Catherine Hartwell · Hartwell Capital')
  })

  it('always includes a dashboard CTA', () => {
    expect(compose().text).toMatch(/equitaselite\.com\/dashboard/)
  })

  it('always includes a one-click unsubscribe URL with the token', () => {
    const { text, unsubscribeUrl } = compose({ unsubscribeToken: TOKEN })
    expect(unsubscribeUrl).toBe(`https://equitaselite.com/unsubscribe?t=${TOKEN}`)
    expect(text).toContain(unsubscribeUrl)
  })

  it('encodes the unsubscribe token in the URL', () => {
    const { unsubscribeUrl } = compose({ unsubscribeToken: 'has spaces & symbols' })
    expect(unsubscribeUrl).toContain(encodeURIComponent('has spaces & symbols'))
  })

  it('also tells the recipient about the in-app profile toggle', () => {
    expect(compose().text).toMatch(/equitaselite\.com\/profile/)
    expect(compose().text).toMatch(/toggle email notifications/)
  })

  it('uses the SITE_URL env var when set', async () => {
    process.env.SITE_URL = 'https://staging.example.com'
    const fresh = await import('../digest.mjs?fresh=' + Date.now())
    const { text, unsubscribeUrl } = fresh.composeDigest({
      firstName: 'Alex', email: 'alex@example.com',
      role: 'angel', newCount: 1,
      sampleNames: [], unsubscribeToken: TOKEN,
    })
    expect(text).toContain('https://staging.example.com/dashboard')
    expect(unsubscribeUrl.startsWith('https://staging.example.com/unsubscribe?t=')).toBe(true)
    delete process.env.SITE_URL
  })

  describe('compliance footer', () => {
    it('includes the recipient email in both bodies (CAN-SPAM "you got this because")', () => {
      const { text, html } = compose({ email: 'specific@example.com' })
      expect(text).toContain('specific@example.com')
      expect(html).toContain('specific@example.com')
    })

    it('includes the privacy + preferences + unsubscribe links in HTML', () => {
      const { html } = compose()
      expect(html).toContain('/unsubscribe?t=')
      expect(html).toContain('/profile')
      expect(html).toContain('/privacy')
    })

    it('renders the configured postal address', async () => {
      process.env.SES_FOOTER_ADDRESS = 'Acme Corp · 123 Test St'
      const fresh = await import('../digest.mjs?fresh=' + Date.now())
      const { text, html } = fresh.composeDigest({
        firstName: 'Alex', email: 'alex@example.com',
        role: 'angel', newCount: 1,
        sampleNames: [], unsubscribeToken: TOKEN,
      })
      expect(text).toContain('Acme Corp · 123 Test St')
      expect(html).toContain('Acme Corp · 123 Test St')
      delete process.env.SES_FOOTER_ADDRESS
    })

    it('includes the current year in the copyright', () => {
      const year = new Date().getFullYear()
      const { text, html } = compose()
      expect(text).toContain(`© ${year}`)
      expect(html).toContain(`© ${year}`)
    })

    it('escapes HTML in the recipient email + sample names', () => {
      const { html } = compose({
        email: 'foo<bar>@example.com',
        sampleNames: ['Aria & Friends · <script>'],
      })
      expect(html).toContain('foo&lt;bar&gt;')
      expect(html).toContain('Aria &amp; Friends')
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('<script>')
    })

    it('returns an HTML body alongside text', () => {
      const { html } = compose()
      expect(html).toMatch(/<!DOCTYPE html>/i)
      expect(html).toContain('Equitas Elite')
    })
  })
})
