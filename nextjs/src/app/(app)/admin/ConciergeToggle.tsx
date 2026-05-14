'use client'

import { useState } from 'react'

interface Props {
  userId:          string
  initial:         boolean
  disabled?:       boolean
  disabledReason?: string
}

export default function ConciergeToggle({ userId, initial, disabled, disabledReason }: Props) {
  const [on, setOn]   = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function toggle() {
    setLoading(true); setError('')
    const next = !on
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_concierge: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setOn(data.is_concierge)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
      setOn(initial)
    } finally {
      setLoading(false)
    }
  }

  if (disabled) {
    return (
      <span className="text-xs text-ee-muted/50 italic" title={disabledReason ?? 'Not eligible'}>—</span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        title={on ? 'Revoke concierge' : 'Grant concierge'}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
          on ? 'bg-ee-emerald' : 'bg-white/10 border border-ee-border'
        }`}
        aria-label={on ? 'Revoke concierge access' : 'Grant concierge access'}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
            on ? 'translate-x-5 bg-ee-bg' : 'translate-x-0.5 bg-ee-muted'
          }`}
        />
      </button>
      {error && <span className="text-[10px] text-red-400 whitespace-nowrap">{error}</span>}
    </div>
  )
}
