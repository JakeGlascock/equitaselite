import type { Tier } from '@/lib/membership'

// Pure, testable step builder for the first-login walkthrough. No DOM,
// no driver.js types — driver.js consumes this via a small adapter in
// WalkthroughDriver.tsx. Keeping this isolated lets the unit tests cover
// every conditional branch without a browser.

export interface TourStep {
  // CSS selector to spotlight. Undefined = centered modal (no spotlight).
  element?: string
  title:    string
  body:     string
}

export interface TourArgs {
  role:        'angel' | 'family_office'
  tier:        Tier
  isAdmin:     boolean
  isConcierge: boolean
  // True when the user's profile id starts with 'managed_' (i.e. the
  // account was set up by a concierge on the user's behalf rather than
  // through self-onboarding). Changes the opening copy only.
  isManaged:   boolean
}

const TIER_COPY: Record<Tier, string> = {
  access:    'You\'re on Access. Upgrade to Select for unlimited matches and intros, or Sovereign for a dedicated relationship manager.',
  select:    'You\'re on Select — unlimited matches, capped at 5 intros per month. Upgrade to Sovereign for unlimited intros and a dedicated relationship manager.',
  sovereign: 'You\'re on Sovereign — unlimited matches, unlimited intros, and a dedicated relationship manager.',
}

export function buildTour(a: TourArgs): TourStep[] {
  const steps: TourStep[] = []

  // 1. Welcome — centered, no anchor.
  steps.push({
    title: 'Welcome to Equitas Elite',
    body:  a.isManaged
      ? 'Your concierge has prepared this workspace for you. Here\'s a 30-second tour — you can replay it anytime from your profile.'
      : 'A 30-second tour of your workspace. You can replay it anytime from your profile.',
  })

  // 2. Matches — the central artifact of the dashboard.
  steps.push({
    element: '[data-tour="match-list"]',
    title:   'Your matches',
    body:    a.role === 'angel'
      ? 'Family offices whose mandates align with your investing profile, ranked by alignment. Click any card to see the score breakdown and request an introduction.'
      : 'Angel investors whose profiles align with your mandate, ranked by alignment. Click any card to see the score breakdown and request an introduction.',
  })

  // 3. Tier badge — tier-conditional copy.
  steps.push({
    element: '[data-tour="tier-badge"]',
    title:   'Your tier',
    body:    TIER_COPY[a.tier],
  })

  // 4. Top nav — the broader platform.
  steps.push({
    element: '[data-tour="top-nav"]',
    title:   'Explore further',
    body:    'Insights for curated coverage from the publications that move institutional capital. Events for the Annual Summit and Roundtables. Concierge for personalized support.',
  })

  // 5. Admin tools — staff only.
  if (a.isAdmin) {
    steps.push({
      element: '[data-tour="admin-link"]',
      title:   'Admin tools',
      body:    'Invite members, create events, manage concierge assignments, set tiers. Everything runs through the admin panel.',
    })
  }

  // 6. Concierge tools — staff only. Visually anchored at top-nav so the
  // selector always exists; the copy disambiguates from the generic
  // "Explore further" step above.
  if (a.isConcierge) {
    steps.push({
      element: '[data-tour="top-nav"]',
      title:   'Concierge tools',
      body:    'Your onboarding queue and managed accounts live under Concierge. You can act on behalf of any managed profile from there.',
    })
  }

  // 7. Done — centered.
  steps.push({
    title: 'You\'re all set',
    body:  'Browse your matches when you\'re ready. You can replay this tour anytime from your profile.',
  })

  return steps
}
