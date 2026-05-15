import { describe, it, expect } from 'vitest'
import { composeDigest } from '../digest.mjs'

describe('composeDigest', () => {
  it('uses singular subject when there is exactly one new match', () => {
    const { subject } = composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 1, sampleNames: [],
    })
    expect(subject).toBe('A new family office joined Equitas Elite')
  })

  it('uses plural subject for multiple new matches', () => {
    const { subject } = composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 4, sampleNames: [],
    })
    expect(subject).toBe('4 new family offices on Equitas Elite this week')
  })

  it('flips the counter-role for family-office recipients', () => {
    const { subject } = composeDigest({
      firstName: 'Sam', role: 'family_office', newCount: 3, sampleNames: [],
    })
    expect(subject).toBe('3 new angel investors on Equitas Elite this week')
  })

  it('greets by first name', () => {
    const { text } = composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 2, sampleNames: [],
    })
    expect(text).toMatch(/^Hi Alex,/)
  })

  it('omits the highlights block when there are no sample names', () => {
    const { text } = composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 5, sampleNames: [],
    })
    expect(text).not.toContain('A few highlights')
  })

  it('includes sample names verbatim when provided', () => {
    const { text } = composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 3,
      sampleNames: ['Aria Mendes · Apex FO', 'Catherine Hartwell · Hartwell Capital'],
    })
    expect(text).toContain('A few highlights:')
    expect(text).toContain('Aria Mendes · Apex FO')
    expect(text).toContain('Catherine Hartwell · Hartwell Capital')
  })

  it('always includes a dashboard CTA + unsubscribe note', () => {
    const { text } = composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 1, sampleNames: [],
    })
    expect(text).toMatch(/equitaselite\.com\/dashboard/)
    expect(text).toMatch(/turn off email notifications/i)
  })

  it('uses the SITE_URL env var when set', async () => {
    process.env.SITE_URL = 'https://staging.example.com'
    // Re-import to pick up the updated env. ESM modules cache, so we use
    // a fresh dynamic import via cache-busting query.
    const fresh = await import('../digest.mjs?fresh=' + Date.now())
    const { text } = fresh.composeDigest({
      firstName: 'Alex', role: 'angel', newCount: 1, sampleNames: [],
    })
    expect(text).toContain('https://staging.example.com/dashboard')
    delete process.env.SITE_URL
  })
})
