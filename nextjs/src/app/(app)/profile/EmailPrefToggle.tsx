'use client'

import { useState } from 'react'

export default function EmailPrefToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  async function flip() {
    const next = !enabled
    setEnabled(next); setBusy(true); setError('')
    try {
      const res = await fetch('/api/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email_notifications_enabled: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
    } catch (err: unknown) {
      setEnabled(!next)  // revert
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-panel p-6 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base text-ee-primary">Email notifications</p>
        <p className="text-xs text-ee-muted mt-1 leading-relaxed">
          Get an email when someone requests an introduction, accepts, or declines —
          plus a weekly digest of new counterparties on the platform. Turn off here
          to stop all outbound mail to your address.
        </p>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
      <button
        type="button"
        onClick={flip}
        disabled={busy}
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable email notifications' : 'Enable email notifications'}
        title={enabled ? 'Click to turn off' : 'Click to turn on'}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 shrink-0 ${
          enabled ? 'bg-ee-emerald' : 'bg-white/10 border border-ee-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
            enabled ? 'translate-x-6 bg-ee-bg' : 'translate-x-0.5 bg-ee-muted'
          }`}
        />
      </button>
    </div>
  )
}
