'use client'

import { useState } from 'react'
import type { Tier } from '@/types'

// Off-Market mode is Sovereign-only. The toggle is always rendered so
// lower-tier members can see what they'd unlock at Sovereign, but it's
// disabled with an "upgrade to use" hint and the click handler refuses
// to PATCH if the user isn't Sovereign.
//
// Going OFF (visible) is a one-way-ish action — everyone who sees the
// profile during the visible window remembers it. The toggle therefore
// shows a confirmation modal before flipping ON→OFF. ON (private) →
// nothing leaks, so OFF→ON stays one-click.
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
  const [enabled, setEnabled]                 = useState(initial)
  const [busy, setBusy]                       = useState(false)
  const [error, setError]                     = useState('')
  const [confirmingReveal, setConfirmingReveal] = useState(false)

  const isSovereign = tier === 'sovereign'
  const graceDate   = graceUntil ? new Date(graceUntil) : null
  const inGrace     = !!graceDate && graceDate.getTime() > Date.now()

  async function apply(next: boolean) {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_off_market: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setEnabled(next)
      setConfirmingReveal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  function onToggleClick() {
    if (!isSovereign) {
      setError('Off-Market is a Sovereign-tier feature.')
      return
    }
    // Going visible — pop the confirmation. Going private — apply directly.
    if (enabled) {
      setConfirmingReveal(true)
    } else {
      apply(true)
    }
  }

  const disabled = busy || !isSovereign

  return (
    <>
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
          onClick={onToggleClick}
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

      {confirmingReveal && (
        <ConfirmRevealModal
          busy={busy}
          error={error}
          onCancel={() => { setConfirmingReveal(false); setError('') }}
          onConfirm={() => apply(false)}
        />
      )}
    </>
  )
}

function ConfirmRevealModal({
  busy, error, onCancel, onConfirm,
}: {
  busy:      boolean
  error:     string
  onCancel:  () => void
  onConfirm: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="off-market-reveal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-panel max-w-md w-full p-6 space-y-4 border-ee-gold/40"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-ee-gold mt-0.5">visibility</span>
          <div>
            <h2 id="off-market-reveal-title" className="font-display text-lg text-ee-primary">
              Make your profile visible?
            </h2>
            <p className="text-xs text-ee-muted mt-2 leading-relaxed">
              Every member will see your name, firm, and mandate in their match results.
              Anyone who views your profile during the visible window will keep seeing it
              even if you re-enable Off-Market later — they&apos;ll already have it on their list.
            </p>
            <p className="text-xs text-ee-muted mt-2 leading-relaxed">
              You can re-enable Off-Market at any time, but this reveal can&apos;t be undone for
              members who&apos;ve already seen you.
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-full border border-ee-border text-ee-muted hover:text-ee-primary text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-full bg-ee-gold text-ee-bg font-semibold hover:brightness-110 disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {busy ? 'Revealing…' : 'Yes, make my profile visible'}
          </button>
        </div>
      </div>
    </div>
  )
}
