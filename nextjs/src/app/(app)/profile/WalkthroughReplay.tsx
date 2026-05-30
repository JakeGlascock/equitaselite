'use client'

import { useState } from 'react'

export default function WalkthroughReplay() {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function replay() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/walkthrough', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'replay' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="glass-panel p-6 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base text-ee-primary">Welcome walkthrough</p>
        <p className="text-xs text-ee-muted mt-1 leading-relaxed">
          Replay the guided tour of the platform. We&apos;ll bounce you to your dashboard.
        </p>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
      <button
        type="button"
        onClick={replay}
        disabled={busy}
        className="btn-ghost text-[11px] tracking-widest uppercase whitespace-nowrap"
      >
        {busy ? 'Loading…' : 'Show again'}
      </button>
    </div>
  )
}
