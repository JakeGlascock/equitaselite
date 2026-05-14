'use client'

import { useState } from 'react'

type Tier = 'access' | 'select' | 'sovereign'

const LABEL: Record<Tier, string> = { access: 'Access', select: 'Select', sovereign: 'Sovereign' }
const STYLE: Record<Tier, string> = {
  access:    'border-ee-primary/30 bg-ee-primary/5  text-ee-primary',
  select:    'border-ee-gold/40    bg-ee-gold/10    text-ee-gold',
  sovereign: 'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald',
}

interface Props {
  userId:   string
  current:  Tier | null
  disabled?: boolean
  disabledReason?: string
}

export default function TierAssignment({ userId, current, disabled, disabledReason }: Props) {
  const [tier, setTier]       = useState<Tier | null>(current)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  if (disabled) {
    return (
      <span className="text-xs text-ee-muted/50 italic" title={disabledReason ?? 'Not eligible'}>
        —
      </span>
    )
  }

  async function save(next: Tier | null) {
    if (next === tier) return
    const prev = tier
    setTier(next); setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ membership: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
    } catch (err: unknown) {
      setTier(prev)  // revert
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={tier ?? ''}
        onChange={e => save((e.target.value || null) as Tier | null)}
        disabled={loading}
        className={`text-[11px] px-2 py-0.5 rounded-full border bg-ee-bg cursor-pointer disabled:opacity-50 ${
          tier ? STYLE[tier] : 'border-ee-border text-ee-muted/70'
        }`}
      >
        <option value="">— None —</option>
        {(['access','select','sovereign'] as const).map(t => (
          <option key={t} value={t}>{LABEL[t]}</option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-400 whitespace-nowrap">{error}</span>}
    </div>
  )
}
