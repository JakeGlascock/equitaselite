'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ASSET_CLASSES } from '@/lib/asset-classes'

type LeadCapacity   = 'lead' | 'follow' | 'either'
type LossAppetite   = 'low' | 'moderate' | 'high'
type Engagement     = 'board' | 'observer' | 'advisory' | 'passive'
type Diligence      = 'light' | 'standard' | 'deep'
type CounterTier    = 'access' | 'select' | 'sovereign'

export interface MandatePillarsInitial {
  sub_sectors:    string[]
  anti_sectors:   string[]
  thematic_focus: string[]
  /** P1 / migration 040 — asset-class affinity (Private Credit, etc.) */
  asset_classes:  string[]
  lead_capacity:  LeadCapacity | null
  holding_period_target_years: number | null
  loss_appetite:  LossAppetite | null
  engagement_style: Engagement | null
  diligence_depth:  Diligence | null
  min_counterparty_tier: CounterTier | null
  esg_required:     boolean
  impact_themes:    string[]
  values_exclusions: string[]
}

// Lightweight chip multi-select. Typing + Enter (or comma) adds a chip;
// click × to remove. Stays inside this file because no other form needs
// it yet — easy to extract later.
function ChipInput({
  label, hint, value, onChange, placeholder,
}: {
  label:        string
  hint?:        string
  value:        string[]
  onChange:     (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  function add(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (value.includes(trimmed)) return
    onChange([...value, trimmed])
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
      setDraft('')
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value.length - 1)
    }
  }
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-data uppercase tracking-widest text-ee-muted">{label}</label>
      <div className="glass-panel p-2 flex flex-wrap gap-1.5 min-h-[44px] items-start">
        {value.map((tag, i) => (
          <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-ee-gold/15 border border-ee-gold/30 text-ee-gold">
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-ee-gold/70 hover:text-ee-gold leading-none"
              aria-label={`Remove ${tag}`}
            >×</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => { if (draft.trim()) { add(draft); setDraft('') } }}
          placeholder={placeholder ?? 'Type and press Enter…'}
          className="flex-1 min-w-[10rem] bg-transparent outline-none text-sm text-ee-primary px-2 py-1"
        />
      </div>
      {hint && <p className="text-[10px] text-ee-muted/80">{hint}</p>}
    </div>
  )
}

// P1 — asset-class picker. Multi-select grid of toggle chips against
// the canonical ASSET_CLASSES list (not free-form like sub-sectors)
// because asset class is structured taxonomy that matcher weights are
// indexed on. Selecting/clearing a chip toggles the key in the array.
function AssetClassPicker({
  value, onChange,
}: { value: string[]; onChange: (next: string[]) => void }) {
  function toggle(key: string) {
    onChange(value.includes(key)
      ? value.filter(k => k !== key)
      : [...value, key])
  }
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-data uppercase tracking-widest text-ee-muted">
        Asset class affinity
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ASSET_CLASSES.map(ac => {
          const on = value.includes(ac.key)
          return (
            <button
              key={ac.key}
              type="button"
              onClick={() => toggle(ac.key)}
              aria-pressed={on}
              className={`text-left p-3 rounded-lg border transition-all ${
                on
                  ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
              }`}
            >
              <p className="font-semibold text-sm">{ac.label}</p>
              <p className="text-[11px] text-ee-muted mt-0.5">{ac.hint}</p>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-ee-muted">
        Pick all that apply. The matcher up-weights counterparties whose
        asset-class affinity overlaps with yours.
      </p>
    </div>
  )
}

function Select<T extends string>({
  label, hint, value, options, onChange, placeholder,
}: {
  label:        string
  hint?:        string
  value:        T | null
  options:      ReadonlyArray<{ value: T; label: string }>
  onChange:     (next: T | null) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-data uppercase tracking-widest text-ee-muted">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange((e.target.value as T) || null)}
        className="input-field"
      >
        <option value="">{placeholder ?? '— No preference —'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="text-[10px] text-ee-muted/80">{hint}</p>}
    </div>
  )
}

function Section({ pillar, title, intro, children }: {
  pillar:   string
  title:    string
  intro:    string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="font-data text-[10px] tracking-[0.12em] text-ee-gold uppercase">{pillar}</p>
        <h3 className="font-display text-lg text-ee-primary mt-1">{title}</h3>
        <p className="text-xs text-ee-muted mt-1 leading-relaxed">{intro}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export default function MandatePillarsForm({ initial }: { initial: MandatePillarsInitial }) {
  const router = useRouter()
  const [data, setData] = useState<MandatePillarsInitial>(initial)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  // Track whether anything has changed since last save so the submit
  // can be disabled when there's no diff to send.
  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(initial), [data, initial])

  function update<K extends keyof MandatePillarsInitial>(key: K, val: MandatePillarsInitial[K]) {
    setData(prev => ({ ...prev, [key]: val }))
    setSuccess(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/me/mandate-pillars', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
    <form onSubmit={onSubmit} className="space-y-8 glass-panel p-6 md:p-7">
      <div>
        <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Advanced mandate</p>
        <h2 className="font-display text-2xl text-ee-gold mt-1">Mandate pillars</h2>
        <p className="text-sm text-ee-muted mt-2 leading-relaxed">
          Fine-tune the six pillars the matching algorithm scores against. Every
          field is optional — declaring a pillar makes it contribute to your
          match scores; leaving it blank drops it from the weighting entirely.
        </p>
      </div>

      <Section
        pillar="Pillar 1"
        title="Strategic scope"
        intro="Narrow your sector / stage focus, name themes you're drawn to, and call out anti-sectors that should never reach your inbox."
      >
        <ChipInput
          label="Sub-sectors"
          hint="More granular than your sector picks (e.g. 'AI infrastructure', 'climate adaptation')."
          value={data.sub_sectors}
          onChange={v => update('sub_sectors', v)}
        />
        <ChipInput
          label="Thematic focus"
          hint="Cross-cutting themes (e.g. 'platform shifts', 'aging demographics')."
          value={data.thematic_focus}
          onChange={v => update('thematic_focus', v)}
        />
        <ChipInput
          label="Anti-sectors"
          hint="Hard exclusions. Counterparties operating in these sectors are hidden from your match list."
          value={data.anti_sectors}
          onChange={v => update('anti_sectors', v)}
        />
        <AssetClassPicker
          value={data.asset_classes}
          onChange={v => update('asset_classes', v)}
        />
      </Section>

      <Section
        pillar="Pillar 2"
        title="Capital mechanics"
        intro="How you deploy capital relative to others on the platform."
      >
        <Select
          label="Lead / follow capacity"
          hint="Whether you take board / pricing responsibility ('lead'), prefer to follow, or work either way."
          value={data.lead_capacity}
          onChange={v => update('lead_capacity', v)}
          options={[
            { value: 'lead',   label: 'Lead' },
            { value: 'follow', label: 'Follow' },
            { value: 'either', label: 'Either' },
          ]}
        />
      </Section>

      <Section
        pillar="Pillar 3"
        title="Time & risk"
        intro="How long you stay in, how much downside you tolerate."
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-data uppercase tracking-widest text-ee-muted">Target holding period (years)</label>
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={data.holding_period_target_years ?? ''}
            onChange={e => update('holding_period_target_years', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="e.g. 7"
            className="input-field"
          />
        </div>
        <Select
          label="Loss appetite"
          hint="How comfortable you are with drawdowns in pursuit of upside."
          value={data.loss_appetite}
          onChange={v => update('loss_appetite', v)}
          options={[
            { value: 'low',      label: 'Low — protect downside' },
            { value: 'moderate', label: 'Moderate — balanced' },
            { value: 'high',     label: 'High — chase upside' },
          ]}
        />
      </Section>

      <Section
        pillar="Pillar 4"
        title="Governance & engagement"
        intro="How active you want to be once capital is deployed."
      >
        <Select
          label="Engagement style"
          value={data.engagement_style}
          onChange={v => update('engagement_style', v)}
          options={[
            { value: 'board',    label: 'Board seat' },
            { value: 'observer', label: 'Observer' },
            { value: 'advisory', label: 'Advisory' },
            { value: 'passive',  label: 'Passive' },
          ]}
        />
        <Select
          label="Diligence depth"
          hint="How heavy your typical diligence process is."
          value={data.diligence_depth}
          onChange={v => update('diligence_depth', v)}
          options={[
            { value: 'light',    label: 'Light — quick decision' },
            { value: 'standard', label: 'Standard' },
            { value: 'deep',     label: 'Deep — institutional' },
          ]}
        />
      </Section>

      <Section
        pillar="Pillar 5"
        title="Counterparty profile"
        intro="Who you want on the other side of the table."
      >
        <Select
          label="Minimum counterparty tier"
          hint="A hard filter. Counterparties on a lower tier won't appear in your match list."
          value={data.min_counterparty_tier}
          onChange={v => update('min_counterparty_tier', v)}
          options={[
            { value: 'access',    label: 'Access (any tier)' },
            { value: 'select',    label: 'Select or higher' },
            { value: 'sovereign', label: 'Sovereign only' },
          ]}
        />
      </Section>

      <Section
        pillar="Pillar 6"
        title="Values & alignment"
        intro="Mission and impact preferences. Required-ESG and exclusion lists are hard filters."
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.esg_required}
            onChange={e => update('esg_required', e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-ee-gold"
          />
          <div>
            <p className="text-sm text-ee-primary">ESG alignment required</p>
            <p className="text-[11px] text-ee-muted leading-relaxed mt-0.5">
              Hard filter. Hides counterparties who haven&apos;t declared ESG alignment.
            </p>
          </div>
        </label>
        <ChipInput
          label="Impact themes"
          hint="Themes you specifically want represented (e.g. 'climate', 'health equity')."
          value={data.impact_themes}
          onChange={v => update('impact_themes', v)}
        />
        <ChipInput
          label="Values exclusions"
          hint="Hard filter. Counterparties touching these sectors or impact themes are hidden."
          value={data.values_exclusions}
          onChange={v => update('values_exclusions', v)}
        />
      </Section>

      <div className="flex items-center justify-between gap-4 pt-2 border-t border-ee-border">
        <div className="text-xs">
          {success && <span className="text-ee-emerald">Mandate pillars saved.</span>}
          {error && <span className="text-red-400">{error}</span>}
        </div>
        <button
          type="submit"
          disabled={saving || !dirty}
          className="btn-gold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save mandate pillars'}
        </button>
      </div>
    </form>
  )
}
