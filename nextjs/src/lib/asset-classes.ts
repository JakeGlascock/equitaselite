// Canonical asset-class list for the P1 product phase. Captures the
// 2025 allocation-shift signal (BlackRock 2025 FO Report: 32% of FOs
// increasing private credit, 30% infrastructure) as a Pillar-1
// (Strategic Scope) sub-field, distinct from sector (vertical
// theme — FinTech, AI/ML) and stage (Seed, Series A).
//
// Stored as TEXT[] in profiles.asset_classes / mandates.asset_classes
// — the DB has no CHECK constraint so this list can grow without a
// schema migration. App-layer is the source of truth.

export interface AssetClass {
  /** Stable key persisted in the DB. SCREAMING_SNAKE_CASE. */
  key:   string
  /** User-facing label shown in the picker + on profile/match cards. */
  label: string
  /** One-line hint shown below the chip in onboarding + /profile. */
  hint:  string
}

export const ASSET_CLASSES: readonly AssetClass[] = [
  { key: 'PRIVATE_CREDIT',          label: 'Private Credit',          hint: 'Direct lending, mezzanine, distressed, specialty finance.' },
  { key: 'INFRASTRUCTURE',          label: 'Infrastructure',          hint: 'Energy, transport, digital infra, regulated utilities.' },
  { key: 'REAL_ESTATE',             label: 'Real Estate',             hint: 'Core, value-add, opportunistic, real-asset platforms.' },
  { key: 'VENTURE',                 label: 'Venture',                 hint: 'Pre-seed through growth equity in private companies.' },
  { key: 'BUYOUT',                  label: 'Buyout',                  hint: 'Control-equity LBOs, growth buyouts, take-privates.' },
  { key: 'HEDGE',                   label: 'Hedge',                   hint: 'L/S equity, macro, multi-strategy, event-driven.' },
  { key: 'ABSOLUTE_RETURN',         label: 'Absolute Return',         hint: 'Uncorrelated, market-neutral, niche arb strategies.' },
  { key: 'NATURAL_RESOURCES',       label: 'Natural Resources',       hint: 'Energy transition, timber, agri, mining royalties.' },
  { key: 'PRIVATE_DEBT_SPECIALTY',  label: 'Specialty Private Debt',  hint: 'Litigation finance, royalty streams, music IP, etc.' },
] as const

const KEYS = new Set(ASSET_CLASSES.map(c => c.key))

export function isAssetClassKey(v: unknown): v is string {
  return typeof v === 'string' && KEYS.has(v)
}

export function labelForAssetClass(key: string): string {
  return ASSET_CLASSES.find(c => c.key === key)?.label ?? key
}
