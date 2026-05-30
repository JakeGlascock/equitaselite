'use client'

import { useState } from 'react'

interface WealthHolderOption {
  id:        string
  full_name: string
  firm_name: string | null
}

interface Props {
  userId:        string  // the NEXT-GEN profile being linked
  current:       string | null
  wealthHolders: WealthHolderOption[]
  disabled?:        boolean
  disabledReason?:  string
}

// P5 v1 — admin-side parent picker for a next-gen seat row in
// MembersTable. Submits PUT /api/admin/users/:id/parent. Same
// optimistic-with-rollback shape as RmAssignment so the two read
// identically in the expand panel.
export default function ParentAssignment({
  userId, current, wealthHolders, disabled, disabledReason,
}: Props) {
  const [selected, setSelected] = useState<string | null>(current)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  if (disabled) {
    return (
      <span className="text-xs text-ee-muted/50 italic" title={disabledReason ?? 'Not eligible'}>
        —
      </span>
    )
  }

  async function save(next: string | null) {
    if (next === selected) return
    const prev = selected
    setSelected(next); setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/parent`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ parent_profile_id: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
    } catch (err: unknown) {
      setSelected(prev)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={selected ?? ''}
        onChange={e => save(e.target.value || null)}
        disabled={loading}
        className="input-field text-xs py-1 px-2 disabled:opacity-50 w-[160px]"
        aria-label="Parent seat"
        title={selected
          ? wealthHolders.find(w => w.id === selected)?.full_name ?? 'Linked'
          : 'No parent linked'}
      >
        <option value="">— None —</option>
        {wealthHolders.map(w => (
          <option key={w.id} value={w.id}>
            {w.full_name}{w.firm_name ? ` — ${w.firm_name}` : ''}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-400 whitespace-nowrap">{error}</span>}
    </div>
  )
}
