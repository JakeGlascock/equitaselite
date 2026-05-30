'use client'

import { useState } from 'react'

export default function SeedDemoButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  async function run() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/seed-demo-data', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setStatus({
        kind: 'success',
        msg: `${data.upserted} demo profiles seeded (${data.rowsBefore} already existed). Refresh the dashboard to see them.`,
      })
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-3">
      <div>
        <h2 className="font-display text-lg text-ee-gold mb-1">Seed demo profiles</h2>
        <p className="text-xs text-ee-muted">
          One-time setup: inserts 8 angel investors and 8 family offices with varied mandates
          so sales demos have realistic matches. Safe to re-run (idempotent on conflict).
        </p>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="btn-gold disabled:opacity-40"
      >
        {loading ? 'Seeding…' : 'Seed 16 demo profiles'}
      </button>

      {status && (
        <p className={`text-xs ${status.kind === 'success' ? 'text-ee-emerald' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
