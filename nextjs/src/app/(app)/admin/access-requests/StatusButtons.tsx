'use client'

import { useState } from 'react'

type Status = 'new' | 'contacted' | 'invited' | 'declined'

const NEXT_STATES: Record<Status, Status[]> = {
  new:       ['contacted', 'invited', 'declined'],
  contacted: ['invited', 'declined', 'new'],
  invited:   ['contacted', 'declined'],
  declined:  ['new', 'contacted'],
}

const LABEL: Record<Status, string> = {
  new:       'Mark new',
  contacted: 'Contacted',
  invited:   'Invited',
  declined:  'Declined',
}

const COLOR: Record<Status, string> = {
  new:       'border-ee-gold/40 text-ee-gold hover:bg-ee-gold/10',
  contacted: 'border-ee-primary/40 text-ee-primary hover:bg-ee-primary/10',
  invited:   'border-ee-emerald/40 text-ee-emerald hover:bg-ee-emerald/10',
  declined:  'border-ee-border text-ee-muted hover:bg-white/5',
}

export default function StatusButtons({ id, current }: { id: string; current: Status }) {
  const [status, setStatus]   = useState<Status>(current)
  const [loading, setLoading] = useState<Status | null>(null)
  const [error,   setError]   = useState('')

  async function setTo(next: Status) {
    setLoading(next); setError('')
    try {
      const res = await fetch(`/api/admin/access-requests/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setStatus(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2 justify-end">
        {NEXT_STATES[status].map(n => (
          <button
            key={n}
            type="button"
            disabled={loading !== null}
            onClick={() => setTo(n)}
            className={`text-[11px] font-data uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all disabled:opacity-40 ${COLOR[n]}`}
          >
            {loading === n ? '…' : LABEL[n]}
          </button>
        ))}
      </div>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  )
}
