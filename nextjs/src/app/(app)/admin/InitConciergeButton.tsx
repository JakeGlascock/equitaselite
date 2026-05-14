'use client'

import { useState } from 'react'

export default function InitConciergeButton() {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  async function run() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/admin/init-concierge', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setStatus({ kind: 'success', msg: 'is_concierge and managed_by columns ready.' })
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Failed' })
    } finally { setLoading(false) }
  }

  return (
    <div className="glass-panel p-6 space-y-3">
      <div>
        <h2 className="font-display text-lg text-ee-gold mb-1">Initialize concierge columns</h2>
        <p className="text-xs text-ee-muted">
          One-time setup: adds <code className="font-data">is_concierge</code> and <code className="font-data">managed_by</code> to <code className="font-data">profiles</code>. Safe to re-run.
        </p>
      </div>
      <button type="button" onClick={run} disabled={loading} className="btn-gold disabled:opacity-40">
        {loading ? 'Initializing…' : 'Initialize concierge columns'}
      </button>
      {status && (
        <p className={`text-xs ${status.kind === 'success' ? 'text-ee-emerald' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
