'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { MandateWeights } from '@/types'
import {
  listPresets, closestPreset, MANDATE_PRESETS,
  type MandatePresetName,
} from '@/lib/mandate-presets'

const PILLAR_FIELDS: ReadonlyArray<{
  key: keyof MandateWeights
  label: string
  description: string
}> = [
  { key: 'scope',        label: 'Strategic scope',     description: 'Sector, stage, geography, themes' },
  { key: 'capital',      label: 'Capital mechanics',   description: 'Check size, lead vs follow' },
  { key: 'timeRisk',     label: 'Time & risk',         description: 'Holding period, loss appetite' },
  { key: 'governance',   label: 'Governance',          description: 'Engagement style, diligence depth' },
  { key: 'counterparty', label: 'Counterparty profile', description: 'Type and tier preferences' },
  { key: 'values',       label: 'Values & alignment',  description: 'ESG, impact themes' },
]

function sumOf(w: MandateWeights): number {
  return w.scope + w.capital + w.timeRisk + w.governance + w.counterparty + w.values
}

function weightsEqual(a: MandateWeights, b: MandateWeights): boolean {
  return a.scope === b.scope && a.capital === b.capital && a.timeRisk === b.timeRisk
      && a.governance === b.governance && a.counterparty === b.counterparty && a.values === b.values
}

export default function MandateWeightsForm({ initial }: { initial: MandateWeights }) {
  const router = useRouter()
  const [weights, setWeights] = useState<MandateWeights>(initial)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const sum   = useMemo(() => sumOf(weights), [weights])
  const closest = useMemo(() => closestPreset(weights), [weights])
  const dirty   = useMemo(() => !weightsEqual(weights, initial), [weights, initial])
  // "Active" preset = current weights exactly match a named preset's weights.
  const activePresetName: MandatePresetName | null = useMemo(() => {
    for (const preset of listPresets()) {
      if (weightsEqual(weights, preset.weights)) return preset.name
    }
    return null
  }, [weights])

  function applyPreset(name: MandatePresetName) {
    setWeights(MANDATE_PRESETS[name].weights)
    setSuccess(false); setError('')
  }

  function updateWeight(key: keyof MandateWeights, value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    setWeights(prev => ({ ...prev, [key]: clamped }))
    setSuccess(false)
  }

  function normalizeTo100() {
    if (sum === 100) return
    if (sum === 0) {
      // Pathological — reset to the platform default so we don't divide by zero.
      setWeights({ scope: 40, capital: 25, timeRisk: 10, governance: 5, counterparty: 10, values: 10 })
      return
    }
    const scaled: MandateWeights = {
      scope:        Math.round(weights.scope        * 100 / sum),
      capital:      Math.round(weights.capital      * 100 / sum),
      timeRisk:     Math.round(weights.timeRisk     * 100 / sum),
      governance:   Math.round(weights.governance   * 100 / sum),
      counterparty: Math.round(weights.counterparty * 100 / sum),
      values:       Math.round(weights.values       * 100 / sum),
    }
    // Rounding can leave the sum at 99 or 101 — absorb the gap into the
    // largest field so the result is exactly 100.
    const drift = 100 - sumOf(scaled)
    if (drift !== 0) {
      const largest = (Object.keys(scaled) as (keyof MandateWeights)[])
        .reduce((a, b) => scaled[a] >= scaled[b] ? a : b)
      scaled[largest] += drift
    }
    setWeights(scaled)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sum !== 100) {
      setError('Weights must sum to 100. Use Normalize or adjust manually.')
      return
    }
    setSaving(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/me/mandate-weights', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(weights),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Save failed')
      setSuccess(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 glass-panel p-6 md:p-7">
      <div>
        <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Advanced mandate</p>
        <h2 className="font-display text-2xl text-ee-gold mt-1">Mandate weights</h2>
        <p className="text-sm text-ee-muted mt-2 leading-relaxed">
          How much each pillar contributes to your match scores. Pick a preset
          to start, then fine-tune. Weights are personal — the same counterparty
          can rank differently for you than for them.
        </p>
      </div>

      {/* Preset picker */}
      <div className="space-y-2">
        <p className="text-xs font-data uppercase tracking-widest text-ee-muted">Start from a preset</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {listPresets().map(preset => {
            const isActive = activePresetName === preset.name
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset.name)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'border-ee-gold/60 bg-ee-gold/10'
                    : 'border-ee-border hover:border-ee-gold/40 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-ee-primary font-medium">{preset.label}</p>
                  {isActive && (
                    <span className="font-data text-[9px] uppercase tracking-widest text-ee-gold">Active</span>
                  )}
                </div>
                <p className="text-[11px] text-ee-muted mt-0.5 leading-relaxed">{preset.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-data uppercase tracking-widest text-ee-muted">Fine-tune</p>
          {closest && !activePresetName && (
            <p className="text-[11px] text-ee-muted">
              Closest to <strong className="text-ee-primary">{closest.label}</strong> (customized)
            </p>
          )}
        </div>

        {PILLAR_FIELDS.map(({ key, label, description }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ee-primary">{label}</p>
                <p className="text-[10px] text-ee-muted truncate">{description}</p>
              </div>
              <span className="font-data text-sm tabular-nums text-ee-gold w-10 text-right">{weights[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weights[key]}
              onChange={e => updateWeight(key, Number(e.target.value))}
              className="w-full accent-ee-gold cursor-pointer"
              aria-label={`${label} weight`}
            />
          </div>
        ))}
      </div>

      {/* Sum indicator + actions */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-ee-border flex-wrap">
        <div className="text-xs flex items-center gap-3 flex-wrap">
          <span className={`font-data ${sum === 100 ? 'text-ee-emerald' : 'text-red-400'}`}>
            Sum: {sum} / 100
          </span>
          {success && <span className="text-ee-emerald">Saved.</span>}
          {error && <span className="text-red-400">{error}</span>}
        </div>
        <div className="flex gap-2">
          {sum !== 100 && (
            <button
              type="button"
              onClick={normalizeTo100}
              className="text-xs font-data uppercase tracking-widest px-3 py-1.5 rounded border border-ee-border text-ee-muted hover:text-ee-primary hover:border-ee-gold/40"
            >
              Normalize
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !dirty || sum !== 100}
            className="btn-gold text-xs whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save weights'}
          </button>
        </div>
      </div>
    </form>
  )
}
