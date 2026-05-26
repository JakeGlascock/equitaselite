import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Architectural invariant test (Phase 7B "experienced" concierge model).
//
// EE has two distinct trust layers that must NOT blend in member-facing
// UI:
//   1. Algorithmic match score — surfaced on dashboard / match / discovery
//   2. Chelsea's human vouches — kept private (concierge-only)
//
// See feedback memory `feedback-two-trust-layers` + product memory
// `project-equitaselite-visible-endorsement-plan` for the rationale.
//
// This test reads each member-facing surface as text and asserts that
// vouch/annotation/concierge-endorsement terminology never leaks into
// it. Concierge tooling (under /concierge) is exempt — it's the staff
// surface where the signal lives by design.

const ROOT = resolve(__dirname, '../..')

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

// Phrases that would conflate the two layers if they appeared on a
// member-facing surface. Case-insensitive substring match. Each entry
// is the search term + the why-this-matters comment for the failure
// message.
const VOUCH_TERMS = [
  'vouch_strength',     // DB column for Chelsea's vouch tier
  'vouched',            // Marketing phrasing that implies endorsement
  'concierge-vetted',   // Same — visible endorsement language
  'personally known',   // Verbatim "personally known to the concierge"
  'chelsea endorses',   // Direct attribution
]

const MEMBER_FACING_SURFACES = [
  'src/components/MatchCard.tsx',
  'src/app/(app)/dashboard/page.tsx',
  'src/app/(app)/discovery/DiscoveryList.tsx',
  'src/app/(app)/match/[id]/page.tsx',
]

describe('Two-trust-layers invariant — member surfaces stay vouch-free', () => {
  it.each(MEMBER_FACING_SURFACES)('%s does not leak concierge endorsement language', (path) => {
    const src = readSrc(path).toLowerCase()
    for (const term of VOUCH_TERMS) {
      expect(src,
        `Member-facing surface "${path}" mentions "${term}". The "experienced" `
      + `concierge model (resolved 2026-05-18) keeps Chelsea's vouches private — `
      + `do not surface them to members. See feedback-two-trust-layers memory.`,
      ).not.toContain(term.toLowerCase())
    }
  })
})

describe('Two-trust-layers invariant — concierge tooling DOES live in /concierge', () => {
  it('AnnotationsPanel is under app/(app)/concierge/, not in member-facing dirs', () => {
    // Negative-space check: assert the panel exists in its expected
    // location so a future move to /dashboard would fail loudly.
    const path = 'src/app/(app)/concierge/AnnotationsPanel.tsx'
    const src = readSrc(path)
    expect(src).toContain('vouch_strength')   // confirms this IS the right file
  })

  it('the annotations DB writer is gated by isCallerConcierge (staff-only)', () => {
    // File location under /api/concierge/* IS the structural assertion;
    // inside the file, the route handler must call isCallerConcierge
    // to gate every request. A future refactor that moved the gate out
    // would fail this check.
    const src = readSrc('src/app/api/concierge/annotations/route.ts')
    expect(src).toMatch(/isCallerConcierge\(userId\)/)
  })
})
