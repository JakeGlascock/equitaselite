'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const SECTORS    = ['FinTech', 'Deep Tech', 'Life Sciences', 'Clean Energy', 'SaaS', 'Consumer', 'AI / ML', 'Real Estate', 'Healthcare', 'Defense Tech']
const STAGES     = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series B+', 'Growth']
const GEOGRAPHIES = ['North America', 'Europe', 'Asia-Pacific', 'Middle East', 'Latin America', 'Global']
const AUM_OPTIONS = ['<$10M', '$10M–$50M', '$50M–$250M', '$250M–$1B', '>$1B']

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        selected
          ? 'bg-ee-gold text-ee-bg border-ee-gold'
          : 'border-ee-border text-ee-primary hover:border-ee-gold/50 hover:text-ee-gold'
      }`}
    >
      {label}
    </button>
  )
}

export default function NewManagedForm() {
  const router = useRouter()
  const [role,     setRole]    = useState<'angel' | 'family_office' | ''>('')
  const [email,    setEmail]   = useState('')
  const [fullName, setFullName] = useState('')
  const [title,    setTitle]   = useState('')
  const [firmName, setFirmName] = useState('')
  const [location, setLocation] = useState('')
  const [aum,      setAum]     = useState('')
  const [sectors,  setSectors] = useState<string[]>([])
  const [stages,   setStages]  = useState<string[]>([])
  const [geos,     setGeos]    = useState<string[]>([])
  const [checkMin, setCheckMin] = useState('1')
  const [checkMax, setCheckMax] = useState('5')
  const [risk,     setRisk]    = useState('')
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) { setError('Please pick a role.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/concierge/profiles', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, full_name: fullName, title, firm_name: firmName,
          location, aum: aum || undefined, role,
          sectors, stages, geography: geos,
          check_size_min: Number(checkMin), check_size_max: Number(checkMax),
          risk_tolerance: risk || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      router.push('/concierge')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel p-6 md:p-8 space-y-6">
      {/* Role */}
      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Role</p>
        <div className="grid grid-cols-2 gap-3">
          {(['angel', 'family_office'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`p-3 rounded-lg border text-left transition-all ${
                role === r
                  ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
              }`}
            >
              <p className="font-semibold text-sm">
                {r === 'angel' ? 'Angel investor' : 'Family office'}
              </p>
              <p className="text-xs text-ee-muted mt-0.5">
                {r === 'angel' ? 'Individual deploying personal capital' : 'Multi-generational wealth management'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">Full name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} required className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input-field" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">
            {role === 'angel' ? 'Firm / Fund' : 'Family office'} name
          </label>
          <input value={firmName} onChange={e => setFirmName(e.target.value)} required className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className="input-field" placeholder="Optional" />
        </div>
        {role === 'family_office' && (
          <div>
            <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">AUM</label>
            <select value={aum} onChange={e => setAum(e.target.value)} className="input-field">
              <option value="">Select…</option>
              {AUM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Sectors */}
      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Sectors</p>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map(s => <Chip key={s} label={s} selected={sectors.includes(s)} onClick={() => setSectors(toggle(sectors, s))} />)}
        </div>
      </div>

      {/* Stages */}
      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Stages</p>
        <div className="flex flex-wrap gap-2">
          {STAGES.map(s => <Chip key={s} label={s} selected={stages.includes(s)} onClick={() => setStages(toggle(stages, s))} />)}
        </div>
      </div>

      {/* Geography */}
      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Geography</p>
        <div className="flex flex-wrap gap-2">
          {GEOGRAPHIES.map(g => <Chip key={g} label={g} selected={geos.includes(g)} onClick={() => setGeos(toggle(geos, g))} />)}
        </div>
      </div>

      {/* Check size */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">Min check ($M)</label>
          <input type="number" min="0" step="0.25" value={checkMin} onChange={e => setCheckMin(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">Max check ($M)</label>
          <input type="number" min="0" step="0.25" value={checkMax} onChange={e => setCheckMax(e.target.value)} className="input-field" />
        </div>
      </div>

      {/* Risk */}
      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Risk tolerance</p>
        <div className="flex gap-3">
          {['Conservative', 'Moderate', 'Aggressive'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRisk(r)}
              className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                risk === r
                  ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.push('/concierge')} className="btn-ghost flex-1 justify-center">
          Cancel
        </button>
        <button type="submit" disabled={loading || !role || !email || !fullName || !firmName} className="btn-gold flex-1 justify-center disabled:opacity-40">
          {loading ? 'Creating…' : 'Create managed account'}
        </button>
      </div>
    </form>
  )
}
