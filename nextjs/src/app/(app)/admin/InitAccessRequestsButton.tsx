'use client'

import { useState } from 'react'

export default function InitAccessRequestsButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  async function run() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/admin/init-access-requests', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setStatus({ kind: 'success', msg: 'access_requests table ready. New requests will land here.' })
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-3">
      <div>
        <h2 className="font-display text-lg text-ee-gold mb-1">Initialize access-requests table</h2>
        <p className="text-xs text-ee-muted">
          One-time setup: creates the <code className="font-data">access_requests</code> table that backs <a className="text-ee-gold hover:underline" href="/request-access">/request-access</a> and <a className="text-ee-gold hover:underline" href="/admin/access-requests">/admin/access-requests</a>. Safe to re-run.
        </p>
      </div>

      <button type="button" onClick={run} disabled={loading} className="btn-gold disabled:opacity-40">
        {loading ? 'Initializing…' : 'Initialize access-requests table'}
      </button>

      {status && (
        <p className={`text-xs ${status.kind === 'success' ? 'text-ee-emerald' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
