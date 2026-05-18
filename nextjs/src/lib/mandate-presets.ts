import type { MandateWeights } from '@/types'

// Named weight templates that members pick as a starting point. The
// preset is a UI convenience — once chosen, its weights are copied onto
// the profile and the user can fine-tune via sliders (Phase F).
//
// Every preset's weights sum to 100. The defaults here are deliberately
// opinionated: a "Sector specialist" should feel meaningfully different
// from a "Capital-preservation" mandate, not just a few percentage
// points off. Picking the right preset is the single biggest lever a
// member has on their match list.

export type MandatePresetName =
  | 'diversified'
  | 'sector_specialist'
  | 'mission_first'
  | 'capital_preservation'

export interface MandatePreset {
  name:        MandatePresetName
  label:       string
  description: string
  weights:     MandateWeights
}

export const MANDATE_PRESETS: Record<MandatePresetName, MandatePreset> = {
  diversified: {
    name:        'diversified',
    label:       'Diversified',
    description: 'Balanced across all six pillars. The right starting point if no single dimension dominates your mandate.',
    weights: {
      scope:        40,
      capital:      25,
      timeRisk:     10,
      governance:   5,
      counterparty: 10,
      values:       10,
    },
  },
  sector_specialist: {
    name:        'sector_specialist',
    label:       'Sector specialist',
    description: 'Scope-led. Use this when sector / stage / geography alignment is the primary signal for a fit — common for thesis-driven angels.',
    weights: {
      scope:        60,
      capital:      15,
      timeRisk:     5,
      governance:   5,
      counterparty: 10,
      values:       5,
    },
  },
  mission_first: {
    name:        'mission_first',
    label:       'Mission-first',
    description: 'Values-led. Heavy weight on impact / values alignment alongside scope. For mandates where mission fit is non-negotiable.',
    weights: {
      scope:        30,
      capital:      15,
      timeRisk:     10,
      governance:   5,
      counterparty: 10,
      values:       30,
    },
  },
  capital_preservation: {
    name:        'capital_preservation',
    label:       'Capital preservation',
    description: 'Structure-led. Capital mechanics and governance carry the most weight. For family offices prioritizing discipline and downside protection.',
    weights: {
      scope:        25,
      capital:      30,
      timeRisk:     15,
      governance:   20,
      counterparty: 5,
      values:       5,
    },
  },
}

// The preset assigned to a profile at onboarding when the user doesn't
// pick one explicitly. Matches the column default migration 028 set, so
// existing rows are already on this preset effectively.
export const DEFAULT_PRESET_NAME: MandatePresetName = 'diversified'

export function listPresets(): MandatePreset[] {
  return Object.values(MANDATE_PRESETS)
}

export function getPreset(name: MandatePresetName): MandatePreset {
  return MANDATE_PRESETS[name]
}

// Returns the preset whose weights most closely match the given weight
// bundle, by L1 distance. Used to surface "you're closest to X" when a
// user has customized away from a clean preset. Returns null when the
// closest match is worse than `tolerance` (i.e., genuinely custom).
export function closestPreset(
  weights:   MandateWeights,
  tolerance: number = 12,  // sum-of-abs-diffs across 6 pillars
): MandatePreset | null {
  let best: { preset: MandatePreset; dist: number } | null = null
  for (const preset of Object.values(MANDATE_PRESETS)) {
    const d =
      Math.abs(weights.scope        - preset.weights.scope) +
      Math.abs(weights.capital      - preset.weights.capital) +
      Math.abs(weights.timeRisk     - preset.weights.timeRisk) +
      Math.abs(weights.governance   - preset.weights.governance) +
      Math.abs(weights.counterparty - preset.weights.counterparty) +
      Math.abs(weights.values       - preset.weights.values)
    if (best === null || d < best.dist) {
      best = { preset, dist: d }
    }
  }
  if (best === null || best.dist > tolerance) return null
  return best.preset
}
