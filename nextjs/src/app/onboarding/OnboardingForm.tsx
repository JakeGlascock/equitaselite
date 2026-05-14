'use client'

import { useState } from 'react'

const SECTORS = [
  'FinTech', 'Deep Tech', 'Life Sciences', 'Clean Energy',
  'SaaS', 'Consumer', 'AI / ML', 'Real Estate', 'Healthcare', 'Defense Tech',
]
const STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series B+', 'Growth']
const CHECK_SCALE = [0.25, 0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 75, 100]
const GEOGRAPHIES = ['North America', 'Europe', 'Asia-Pacific', 'Middle East', 'Latin America', 'Global']
const AUM_OPTIONS = ['<$10M', '$10M–$50M', '$50M–$250M', '$250M–$1B', '>$1B']

type Role = 'angel' | 'family_office'

interface FormData {
  email: string
  role: Role | ''
  full_name: string
  title: string
  firm_name: string
  location: string
  aum: string
  sectors: string[]
  stages: string[]
  geography: string[]
  check_size_min: number
  check_size_max: number
  risk_tolerance: string
  expected_return: string
  timeline: string
  mandate_type: string
  concentration: string
  email_notifications_enabled: boolean
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

function Chip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
        selected
          ? 'bg-ee-gold text-ee-bg border-ee-gold'
          : 'border-ee-border text-ee-primary hover:border-ee-gold/50 hover:text-ee-gold'
      }`}
    >
      {label}
    </button>
  )
}

function CheckSlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  const idx = CHECK_SCALE.findIndex(v => v >= value) === -1
    ? CHECK_SCALE.length - 1
    : CHECK_SCALE.findIndex(v => v >= value)

  const display = (v: number) => v >= 1 ? `$${v}M` : `$${v * 1000}K`

  return (
    <div>
      <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
        {label} — <span className="text-ee-gold">{display(value)}</span>
      </label>
      <input
        type="range"
        min={0}
        max={CHECK_SCALE.length - 1}
        value={idx}
        onChange={e => onChange(CHECK_SCALE[Number(e.target.value)])}
        className="w-full accent-[#e9c176]"
      />
      <div className="flex justify-between text-xs text-ee-muted mt-0.5">
        <span>$250K</span>
        <span>$100M</span>
      </div>
    </div>
  )
}

interface Props {
  email: string
  mode?: 'onboard' | 'edit'
  initialData?: Partial<FormData>
}

export default function OnboardingForm({ email, mode = 'onboard', initialData }: Props) {
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState<FormData>({
    email,
    role: '',
    full_name: '',
    title: '',
    firm_name: '',
    location: '',
    aum: '',
    sectors: [],
    stages: [],
    geography: [],
    check_size_min: 1,
    check_size_max: 5,
    risk_tolerance: '',
    expected_return: '',
    timeline: '',
    mandate_type: '',
    concentration: '',
    email_notifications_enabled: true,
    ...initialData,
  })

  const set = (key: keyof FormData, val: unknown) =>
    setData(d => ({ ...d, [key]: val }))

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const url    = mode === 'edit' ? '/api/me' : '/api/onboarding'
      const method = mode === 'edit' ? 'PATCH'  : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Save failed')
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!data.role)                          return 'Please select a role.'
      if (data.full_name.trim().length < 2)    return 'Enter your full name (at least 2 characters).'
      if (data.firm_name.trim().length < 2)    return `Enter your ${data.role === 'angel' ? 'firm/fund' : 'family office'} name.`
      if (data.role === 'family_office' && !data.aum) return 'Select your AUM range.'
      return null
    }
    if (s === 2) {
      if (data.sectors.length === 0)   return 'Pick at least one sector.'
      if (data.stages.length === 0)    return 'Pick at least one stage.'
      if (data.geography.length === 0) return 'Pick at least one geography.'
      return null
    }
    if (s === 3) {
      if (data.check_size_min <= 0)               return 'Set a minimum check size above zero.'
      if (data.check_size_max < data.check_size_min) return 'Maximum check size must be at least the minimum.'
      if (!data.risk_tolerance)                   return 'Select your risk tolerance.'
      return null
    }
    if (s === 4) {
      if (data.role === 'angel') {
        if (!data.expected_return) return 'Select a target return multiple.'
        if (!data.timeline)        return 'Select an investment horizon.'
      } else if (data.role === 'family_office') {
        if (!data.mandate_type)    return 'Select a mandate type.'
        if (!data.concentration)   return 'Select a deal structure preference.'
      }
      return null
    }
    return null
  }

  const stepError = validateStep(step)
  const Req = () => <span className="text-ee-gold/80 ml-0.5" aria-label="required">*</span>

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3, 4].map(n => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              n <= step ? 'bg-ee-gold' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div className="glass-panel p-8 space-y-6">

        {/* Step 1 — Identity */}
        {step === 1 && (
          <>
            <div>
              <h2 className="font-display text-xl text-ee-gold mb-1">Tell us about yourself</h2>
              <p className="text-ee-muted text-sm">This shapes your profile and how you appear to matches.</p>
            </div>

            <div>
              <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">I am a<Req /></p>
              <div className="grid grid-cols-2 gap-3">
                {(['angel', 'family_office'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('role', r)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      data.role === r
                        ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                        : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
                    }`}
                  >
                    <p className="font-semibold text-sm">
                      {r === 'angel' ? 'Angel Investor' : 'Family Office'}
                    </p>
                    <p className="text-xs text-ee-muted mt-0.5">
                      {r === 'angel'
                        ? 'Individual deploying personal capital'
                        : 'Multi-generational wealth management'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                  Full name<Req />
                </label>
                <input
                  className="input-field"
                  value={data.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  placeholder="Alexandra Chen"
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                  Title <span className="text-ee-muted/60">(optional)</span>
                </label>
                <input
                  className="input-field"
                  value={data.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="Managing Partner"
                  maxLength={120}
                  autoComplete="organization-title"
                />
              </div>
              <div>
                <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                  {data.role === 'angel' ? 'Firm / Fund name' : 'Family office name'}<Req />
                </label>
                <input
                  className="input-field"
                  value={data.firm_name}
                  onChange={e => set('firm_name', e.target.value)}
                  placeholder={data.role === 'angel' ? 'Horizon Ventures' : 'Chen Family Office'}
                  maxLength={160}
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                    Location <span className="text-ee-muted/60">(optional)</span>
                  </label>
                  <input
                    className="input-field"
                    value={data.location}
                    onChange={e => set('location', e.target.value)}
                    placeholder="San Francisco, CA"
                    maxLength={120}
                  />
                </div>
                {data.role === 'family_office' && (
                  <div>
                    <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                      AUM<Req />
                    </label>
                    <select
                      className="input-field"
                      value={data.aum}
                      onChange={e => set('aum', e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {AUM_OPTIONS.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Step 2 — Sectors & Stages */}
        {step === 2 && (
          <>
            <div>
              <h2 className="font-display text-xl text-ee-gold mb-1">Investment focus</h2>
              <p className="text-ee-muted text-sm">Select all that apply — this drives your match scoring.</p>
            </div>

            <div>
              <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">Sectors<Req /></p>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(s => (
                  <Chip
                    key={s}
                    label={s}
                    selected={data.sectors.includes(s)}
                    onClick={() => set('sectors', toggle(data.sectors, s))}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">Stages<Req /></p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map(s => (
                  <Chip
                    key={s}
                    label={s}
                    selected={data.stages.includes(s)}
                    onClick={() => set('stages', toggle(data.stages, s))}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">Geography<Req /></p>
              <div className="flex flex-wrap gap-2">
                {GEOGRAPHIES.map(g => (
                  <Chip
                    key={g}
                    label={g}
                    selected={data.geography.includes(g)}
                    onClick={() => set('geography', toggle(data.geography, g))}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 3 — Check size & risk */}
        {step === 3 && (
          <>
            <div>
              <h2 className="font-display text-xl text-ee-gold mb-1">Check size & risk</h2>
              <p className="text-ee-muted text-sm">Set your typical deployment range.</p>
            </div>

            <CheckSlider
              label="Minimum check"
              value={data.check_size_min}
              onChange={v => set('check_size_min', v)}
            />
            <CheckSlider
              label="Maximum check"
              value={data.check_size_max}
              onChange={v => set('check_size_max', Math.max(v, data.check_size_min))}
            />

            <div>
              <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">Risk tolerance<Req /></p>
              <div className="flex gap-3">
                {['Conservative', 'Moderate', 'Aggressive'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('risk_tolerance', r)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                      data.risk_tolerance === r
                        ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                        : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 4 — Role-specific preferences */}
        {step === 4 && (
          <>
            <div>
              <h2 className="font-display text-xl text-ee-gold mb-1">
                {data.role === 'angel' ? 'Return expectations' : 'Mandate & structure'}
              </h2>
              <p className="text-ee-muted text-sm">Final details to complete your profile.</p>
            </div>

            {data.role === 'angel' ? (
              <>
                <div>
                  <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">
                    Target return multiple<Req />
                  </p>
                  <div className="flex flex-col gap-2">
                    {['2x–5x', '5x–10x', '10x+'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => set('expected_return', r)}
                        className={`py-2.5 px-4 rounded-lg border text-sm text-left transition-all ${
                          data.expected_return === r
                            ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                            : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">
                    Investment horizon<Req />
                  </p>
                  <div className="flex flex-col gap-2">
                    {['3–5 years', '5–7 years', '7–10 years', '10+ years'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('timeline', t)}
                        className={`py-2.5 px-4 rounded-lg border text-sm text-left transition-all ${
                          data.timeline === t
                            ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                            : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">
                    Mandate type<Req />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Growth', 'Value', 'Balanced', 'Venture', 'Impact'].map(m => (
                      <Chip
                        key={m}
                        label={m}
                        selected={data.mandate_type === m}
                        onClick={() => set('mandate_type', m)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-ee-muted mb-2 font-data uppercase tracking-wider">
                    Deal structure preference<Req />
                  </p>
                  <div className="flex gap-3">
                    {['Direct', 'Syndicated', 'Both'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set('concentration', c)}
                        className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                          data.concentration === c
                            ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                            : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notification preference (shared across roles) */}
            <div className="pt-4 border-t border-ee-border/40">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.email_notifications_enabled}
                  onChange={e => set('email_notifications_enabled', e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-ee-border bg-white/5 text-ee-gold focus:ring-ee-gold/40 cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-sm text-ee-primary">Email notifications</p>
                  <p className="text-xs text-ee-muted mt-0.5 leading-relaxed">
                    Get an email when someone requests an introduction, accepts, or declines.
                    You can change this anytime from your profile.
                  </p>
                </div>
              </label>
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {stepError && <p className="text-xs text-ee-muted text-center" role="status">{stepError}</p>}

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="btn-ghost flex-1 justify-center"
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!!stepError}
              title={stepError ?? undefined}
              className="btn-gold flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || !!stepError}
              title={stepError ?? undefined}
              className="btn-gold flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Complete profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
