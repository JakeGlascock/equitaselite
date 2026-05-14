'use client'

import { useState } from 'react'

interface Option {
  id:        string
  full_name: string
  firm_name: string | null
}

interface Props {
  accountId:    string
  currentId:    string | null
  concierges:   Option[]
}

export default function ManagedAccountAssignment({ accountId, currentId, concierges }: Props) {
  const [selected, setSelected] = useState<string | null>(currentId)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function save(next: string | null) {
    if (next === selected) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/managed/${accountId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ managed_by: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSelected(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
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
        className="input-field text-xs py-1 px-2 disabled:opacity-50 w-[140px]"
        title={selected
          ? concierges.find(c => c.id === selected)?.full_name ?? 'Assigned'
          : 'Unassigned'}
      >
        <option value="">— None —</option>
        {concierges.map(c => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  )
}
