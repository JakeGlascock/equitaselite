'use client'

import { useState } from 'react'

// Toggle for the multi-role identity flags (is_angel, is_family_office).
// Same shape as ConciergeToggle — PATCHes /api/admin/users/<id> with the
// named field and reflects the response. The two flags are independent;
// the admin route also keeps the legacy `role` column in sync (Angel /
// Family Office string), so older read paths keep working through
// Phase C.

interface Props {
  userId:          string
  field:           'is_angel' | 'is_family_office'
  initial:         boolean
  disabled?:       boolean
  disabledReason?: string
}

const LABELS: Record<Props['field'], { on: string; off: string; aria_on: string; aria_off: string }> = {
  is_angel:         { on: 'Revoke Angel role', off: 'Grant Angel role',
                       aria_on: 'Revoke Angel role', aria_off: 'Grant Angel role' },
  is_family_office: { on: 'Revoke Family Office role', off: 'Grant Family Office role',
                       aria_on: 'Revoke Family Office role', aria_off: 'Grant Family Office role' },
}

export default function RoleFlagToggle({ userId, field, initial, disabled, disabledReason }: Props) {
  const [on, setOn]           = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function toggle() {
    setLoading(true); setError('')
    const next = !on
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setOn(data[field])
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

  const labels = LABELS[field]
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        title={on ? labels.on : labels.off}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
          on ? 'bg-ee-emerald' : 'bg-white/10 border border-ee-border'
        }`}
        aria-label={on ? labels.aria_on : labels.aria_off}
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
