import { describe, it, expect } from 'vitest'
import { buildTour, buildMobileTour, buildPreviewTour } from '@/lib/walkthrough'

const BASE = {
  role:        'angel' as const,
  tier:        'access' as const,
  isAdmin:     false,
  isConcierge: false,
  isManaged:   false,
}

describe('buildTour', () => {
  it('produces 6 steps for a baseline investor (no staff roles)', () => {
    const steps = buildTour(BASE)
    expect(steps).toHaveLength(6)
    expect(steps[0].element).toBeUndefined()   // centered welcome
    expect(steps[steps.length - 1].element).toBeUndefined()  // centered done
  })

  it('matches anchors to expected selectors in order', () => {
    const steps = buildTour(BASE)
    expect(steps.map(s => s.element)).toEqual([
      undefined,                       // welcome
      '[data-tour="match-list"]',      // matches
      undefined,                       // tune your mandate (centered)
      '[data-tour="tier-badge"]',      // tier
      '[data-tour="top-nav"]',         // explore further
      undefined,                       // done
    ])
  })

  it('includes a "Tune your mandate" step pointing at /profile customization', () => {
    const steps = buildTour(BASE)
    const tune = steps.find(s => s.title === 'Tune your mandate')
    expect(tune).toBeDefined()
    expect(tune!.body).toMatch(/preset|pillar|profile/i)
  })

  it('adds an admin step when isAdmin=true', () => {
    const steps = buildTour({ ...BASE, isAdmin: true })
    const adminStep = steps.find(s => s.element === '[data-tour="admin-link"]')
    expect(adminStep).toBeDefined()
    expect(adminStep!.title).toMatch(/admin/i)
  })

  it('adds a concierge step when isConcierge=true', () => {
    const steps = buildTour({ ...BASE, isConcierge: true })
    expect(steps.some(s => s.title === 'Concierge tools')).toBe(true)
  })

  it('adds both admin and concierge steps when the user is staff with both flags', () => {
    const steps = buildTour({ ...BASE, isAdmin: true, isConcierge: true })
    expect(steps).toHaveLength(8)
    expect(steps.some(s => s.title === 'Admin tools')).toBe(true)
    expect(steps.some(s => s.title === 'Concierge tools')).toBe(true)
  })

  it('opens with the managed-Sovereign welcome copy when isManaged=true', () => {
    const steps = buildTour({ ...BASE, isManaged: true, tier: 'sovereign' })
    expect(steps[0].body).toMatch(/your concierge has prepared/i)
  })

  it('opens with the default welcome copy when isManaged=false', () => {
    const steps = buildTour(BASE)
    expect(steps[0].body).toMatch(/30-second tour/i)
    expect(steps[0].body).not.toMatch(/your concierge has prepared/i)
  })

  it('uses role-specific copy on the matches step', () => {
    const angel = buildTour({ ...BASE, role: 'angel' })
    const family = buildTour({ ...BASE, role: 'family_office' })
    expect(angel.find(s => s.element === '[data-tour="match-list"]')!.body)
      .toMatch(/family offices/i)
    expect(family.find(s => s.element === '[data-tour="match-list"]')!.body)
      .toMatch(/angel investors/i)
  })

  it.each([
    ['access',    /upgrade to select/i],
    ['select',    /capped at 5 intros/i],
    ['sovereign', /dedicated relationship manager/i],
  ] as const)('uses tier-specific copy on the tier step for %s', (tier, pattern) => {
    const steps = buildTour({ ...BASE, tier })
    const tierStep = steps.find(s => s.element === '[data-tour="tier-badge"]')!
    expect(tierStep.body).toMatch(pattern)
  })

  it('every step has non-empty title and body', () => {
    const cases: Parameters<typeof buildTour>[0][] = [
      BASE,
      { ...BASE, isAdmin: true },
      { ...BASE, isConcierge: true },
      { ...BASE, isAdmin: true, isConcierge: true },
      { ...BASE, isManaged: true },
      { ...BASE, role: 'family_office', tier: 'sovereign' },
    ]
    for (const args of cases) {
      for (const step of buildTour(args)) {
        expect(step.title.length).toBeGreaterThan(0)
        expect(step.body.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('buildMobileTour', () => {
  it('always produces exactly 4 steps (no spotlight anchors)', () => {
    const steps = buildMobileTour(BASE)
    expect(steps).toHaveLength(4)
    for (const s of steps) expect(s.element).toBeUndefined()
  })

  it('omits staff steps even when isAdmin and isConcierge are true', () => {
    const steps = buildMobileTour({ ...BASE, isAdmin: true, isConcierge: true })
    expect(steps).toHaveLength(4)
    expect(steps.some(s => /admin/i.test(s.title))).toBe(false)
    expect(steps.some(s => /concierge/i.test(s.title))).toBe(false)
  })

  it('opens with managed-Sovereign copy when isManaged=true', () => {
    const steps = buildMobileTour({ ...BASE, isManaged: true })
    expect(steps[0].body).toMatch(/your concierge has prepared/i)
  })

  it('uses role-specific copy on the matches step', () => {
    const angel  = buildMobileTour({ ...BASE, role: 'angel' })
    const family = buildMobileTour({ ...BASE, role: 'family_office' })
    expect(angel[1].body).toMatch(/family offices/i)
    expect(family[1].body).toMatch(/angel investors/i)
  })

  it.each([
    ['access',    /upgrade to select/i],
    ['select',    /capped at 5 intros/i],
    ['sovereign', /dedicated relationship manager/i],
  ] as const)('uses tier-specific copy on the tier step for %s', (tier, pattern) => {
    const steps = buildMobileTour({ ...BASE, tier })
    expect(steps[2].body).toMatch(pattern)
  })

  it('every step has non-empty title and body across permutations', () => {
    const cases: Parameters<typeof buildMobileTour>[0][] = [
      BASE,
      { ...BASE, isManaged: true },
      { ...BASE, role: 'family_office', tier: 'sovereign' },
      { ...BASE, tier: 'select' },
    ]
    for (const args of cases) {
      for (const step of buildMobileTour(args)) {
        expect(step.title.length).toBeGreaterThan(0)
        expect(step.body.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('buildPreviewTour', () => {
  it('returns a fixed 5-step tour', () => {
    expect(buildPreviewTour()).toHaveLength(5)
  })

  it('opens and closes with centered no-anchor steps', () => {
    const steps = buildPreviewTour()
    expect(steps[0].element).toBeUndefined()
    expect(steps[steps.length - 1].element).toBeUndefined()
  })

  it('anchors the middle steps to the same selectors as the user tour', () => {
    const steps = buildPreviewTour()
    expect(steps.map(s => s.element)).toEqual([
      undefined,
      '[data-tour="match-list"]',
      '[data-tour="tier-badge"]',
      '[data-tour="top-nav"]',
      undefined,
    ])
  })

  it('every step has non-empty title and body', () => {
    for (const step of buildPreviewTour()) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.body.length).toBeGreaterThan(0)
    }
  })

  it('uses fundraising-investor framing, not user framing', () => {
    const all = buildPreviewTour().map(s => s.body).join(' ')
    expect(all).toMatch(/preview|demo profile|pricing wedge|reply to the email/i)
  })
})
