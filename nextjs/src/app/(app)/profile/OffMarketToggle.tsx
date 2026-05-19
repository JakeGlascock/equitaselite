'use client'

import { useState } from 'react'
import type { Tier } from '@/types'

// Off-Market mode is Sovereign-only. The toggle is always rendered so
// lower-tier members can see what they'd unlock at Sovereign, but it's
// disabled with an "upgrade to use" hint and the click handler refuses
// to PATCH if the user isn't Sovereign.
//
// When the user is mid-grace (off_market_grace_until is set because
// they downgraded while off-market), we surface the countdown so they
// can choose between re-upgrading and accepting the upcoming reveal.

export default function OffMarketToggle({
  initial,
  tier,
  graceUntil,
}: {
  initial:    boolean
  tier:       Tier | null
  graceUntil: string | null
}) {
  const [enabled, setEnabled] = useState(initial)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const isSovereign = tier === 'sovereign'
  const graceDate   = graceUntil ? new Date(graceUntil) : null
  const inGrace     = !!graceDate && graceDate.getTime() > Date.now()

  async function flip() {
    if (!isSovereign) {
      setError('Off-Market is a Sovereign-tier feature.')
      return
    }
    const next = !enabled
    setEnabled(next); setBusy(true); setError('')
    try {
      const res = await fetch('/api/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_off_market: next }),
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

  const disabled = busy || !isSovereign

  return (
    <div className="glass-panel p-6 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base text-ee-primary flex items-center gap-2">
          Off-Market mode
          {!isSovereign && (
            <span className="text-[10px] font-data uppercase tracking-wider px-1.5 py-px rounded-sm border border-ee-gold/40 bg-ee-gold/10 text-ee-gold">
              Sovereign
            </span>
          )}
        </p>
        <p className="text-xs text-ee-muted mt-1 leading-relaxed">
          Hide your profile from the directory and other members&apos; match results.
          Your assigned RM, admins, and anyone you&apos;ve accepted an introduction
          with still see you. To bring a new counterparty in, send the
          introduction request — that act reveals you to them.
        </p>
        {!isSovereign && (
          <p className="text-xs text-ee-muted mt-2">
            Upgrade to Sovereign on <a href="/pricing" className="text-ee-gold hover:underline">/pricing</a> to use.
          </p>
        )}
        {inGrace && enabled && (
          <p className="text-xs text-ee-gold mt-2">
            Your profile becomes visible on{' '}
            <strong>{graceDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>{' '}
            unless you re-upgrade to Sovereign before then.
          </p>
        )}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
      <button
        type="button"
        onClick={flip}
        disabled={disabled}
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable Off-Market mode' : 'Enable Off-Market mode'}
        title={
          !isSovereign ? 'Sovereign tier required'
            : enabled  ? 'Click to make profile visible again'
                       : 'Click to hide profile'
        }
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-40 shrink-0 ${
          enabled ? 'bg-ee-gold' : 'bg-white/10 border border-ee-border'
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
