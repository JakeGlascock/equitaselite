'use client'

import { useState } from 'react'

export default function InitNotificationsButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  async function run() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/admin/init-notifications', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setStatus({ kind: 'success', msg: 'Notifications table ready. Trigger an intro to generate the first notification.' })
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-3">
      <div>
        <h2 className="font-display text-lg text-ee-gold mb-1">Initialize notifications</h2>
        <p className="text-xs text-ee-muted">
          One-time setup: creates the <code className="font-data">notifications</code> table. Safe to re-run.
        </p>
      </div>

      <button type="button" onClick={run} disabled={loading} className="btn-gold disabled:opacity-40">
        {loading ? 'Initializing…' : 'Initialize notifications table'}
      </button>

      {status && (
        <p className={`text-xs ${status.kind === 'success' ? 'text-ee-emerald' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
