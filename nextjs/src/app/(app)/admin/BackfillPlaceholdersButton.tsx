'use client'

import { useState } from 'react'

export default function BackfillPlaceholdersButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  async function run() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/backfill-placeholders', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setStatus({
        kind: 'success',
        msg: `${data.created} placeholder profiles created (${data.scanned} scanned, ${data.skipped} skipped). Refresh /admin to see toggles activate.`,
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
        <h2 className="font-display text-lg text-ee-gold mb-1">Backfill invited members</h2>
        <p className="text-xs text-ee-muted">
          One-time fix for anyone invited before placeholder profiles became automatic.
          Creates a stub profile row for every Cognito user that doesn&apos;t have one,
          flipping their status from <strong className="text-ee-primary">Invited</strong> to
          <strong className="text-ee-primary"> Onboarding</strong> with all four toggles
          active. Idempotent — safe to re-run.
        </p>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="btn-gold disabled:opacity-40"
      >
        {loading ? 'Backfilling…' : 'Backfill placeholder profiles'}
      </button>

      {status && (
        <p className={`text-xs ${status.kind === 'success' ? 'text-ee-emerald' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
