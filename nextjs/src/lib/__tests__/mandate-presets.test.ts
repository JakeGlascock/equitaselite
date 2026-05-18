import { describe, it, expect } from 'vitest'
import {
  MANDATE_PRESETS, DEFAULT_PRESET_NAME,
  listPresets, getPreset, closestPreset,
} from '../mandate-presets'
import type { MandateWeights } from '@/types'

function sumWeights(w: MandateWeights): number {
  return w.scope + w.capital + w.timeRisk + w.governance + w.counterparty + w.values
}

describe('MANDATE_PRESETS', () => {
  it('exposes four named presets', () => {
    expect(Object.keys(MANDATE_PRESETS).sort()).toEqual([
      'capital_preservation',
      'diversified',
      'mission_first',
      'sector_specialist',
    ])
  })

  it('every preset sums to 100', () => {
    for (const preset of Object.values(MANDATE_PRESETS)) {
      expect(sumWeights(preset.weights)).toBe(100)
    }
  })

  it('sector_specialist is scope-dominant', () => {
    const w = MANDATE_PRESETS.sector_specialist.weights
    expect(w.scope).toBeGreaterThan(w.capital)
    expect(w.scope).toBeGreaterThan(w.values)
  })

  it('mission_first puts meaningful weight on values', () => {
    const w = MANDATE_PRESETS.mission_first.weights
    expect(w.values).toBeGreaterThanOrEqual(25)
  })

  it('capital_preservation puts capital + governance above scope', () => {
    const w = MANDATE_PRESETS.capital_preservation.weights
    expect(w.capital + w.governance).toBeGreaterThan(w.scope)
  })
})

describe('DEFAULT_PRESET_NAME', () => {
  it('points to a real preset', () => {
    expect(MANDATE_PRESETS[DEFAULT_PRESET_NAME]).toBeDefined()
  })

  it('matches migration 028 column default (diversified)', () => {
    expect(DEFAULT_PRESET_NAME).toBe('diversified')
    expect(MANDATE_PRESETS.diversified.weights).toEqual({
      scope: 40, capital: 25, timeRisk: 10, governance: 5, counterparty: 10, values: 10,
    })
  })
})

describe('listPresets', () => {
  it('returns all four presets', () => {
    expect(listPresets()).toHaveLength(4)
  })
})

describe('getPreset', () => {
  it('returns the named preset', () => {
    expect(getPreset('sector_specialist').label).toBe('Sector specialist')
  })
})

describe('closestPreset', () => {
  it('returns the exact preset when weights match identically', () => {
    expect(closestPreset(MANDATE_PRESETS.sector_specialist.weights)).toEqual(MANDATE_PRESETS.sector_specialist)
  })

  it('snaps near-preset weights back to the closest named one', () => {
    // Tiny perturbation of sector_specialist — within tolerance
    const nudged: MandateWeights = { scope: 58, capital: 17, timeRisk: 5, governance: 5, counterparty: 10, values: 5 }
    expect(closestPreset(nudged)?.name).toBe('sector_specialist')
  })

  it('returns null when no preset is close enough (genuinely custom)', () => {
    // Equal weights across all six pillars — none of the named presets
    // are this uniform.
    const flat: MandateWeights = { scope: 17, capital: 17, timeRisk: 17, governance: 17, counterparty: 16, values: 16 }
    expect(closestPreset(flat)).toBeNull()
  })

  it('respects a custom tolerance', () => {
    const flat: MandateWeights = { scope: 17, capital: 17, timeRisk: 17, governance: 17, counterparty: 16, values: 16 }
    expect(closestPreset(flat, 100)).not.toBeNull()
  })
})
