'use client'

import { useState } from 'react'

const CATEGORIES = [
  { value: 'introduction', label: 'Bespoke introduction',     icon: 'handshake'      },
  { value: 'diligence',    label: 'Due diligence support',    icon: 'fact_check'     },
  { value: 'vetting',      label: 'Counterparty vetting',     icon: 'verified_user'  },
  { value: 'market',       label: 'Market intelligence',      icon: 'query_stats'    },
  { value: 'mandate',      label: 'Mandate review',           icon: 'tune'           },
  { value: 'other',        label: 'Something else',           icon: 'more_horiz'     },
]

const URGENCIES = ['Routine', 'Within a week', 'Within 48 hours'] as const

export default function ConciergeForm() {
  const [category,  setCategory]  = useState('introduction')
  const [urgency,   setUrgency]   = useState<typeof URGENCIES[number]>('Within a week')
  const [details,   setDetails]   = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/concierge/requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ category, urgency, details }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="glass-panel p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-ee-emerald/15 border border-ee-emerald/40 flex items-center justify-center mx-auto">
          <span
            className="material-symbols-outlined text-ee-emerald text-xl"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
          >
            check
          </span>
        </div>
        <p className="font-display text-lg text-ee-primary">Request received</p>
        <p className="text-sm text-ee-muted max-w-sm mx-auto">
          Your concierge will respond by email within {urgency === 'Within 48 hours' ? '48 hours' : urgency === 'Within a week' ? 'one business week' : 'two business weeks'}.
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setDetails('') }}
          className="text-xs text-ee-gold hover:underline font-data uppercase tracking-wider"
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="glass-panel p-6 space-y-5">
      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-3">Category</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs text-left transition-all ${
                category === c.value
                  ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
              }`}
            >
              <span className="material-symbols-outlined text-base">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">
          Details
        </label>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          required
          rows={5}
          maxLength={2000}
          placeholder="Brief context, what you'd like the concierge to handle, any deadlines or constraints."
          className="input-field resize-none"
        />
        <p className="text-[10px] text-ee-muted font-data text-right mt-1">{details.length}/2000</p>
      </div>

      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Urgency</p>
        <div className="flex gap-2">
          {URGENCIES.map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgency(u)}
              className={`flex-1 py-2 rounded-lg border text-xs transition-all ${
                urgency === u
                  ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || details.trim().length < 10}
        className="btn-gold w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending…' : 'Submit request'}
      </button>

      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      <p className="text-[11px] text-ee-muted text-center leading-relaxed">
        Concierge service is included for Select and Sovereign memberships.
        Access members can submit one request per quarter.
      </p>
    </form>
  )
}
