'use client'

import Link from 'next/link'
import { useState } from 'react'

interface IntroState {
  status:       'pending' | 'accepted' | 'declined' | null
  direction:    'outgoing' | 'incoming' | null
  contactEmail: string | null
}

interface Props {
  recipientId:        string
  recipientFirstName: string
  initial:            IntroState
  canSendIntros:      boolean
  // When the viewer has Off-Market mode on, sending an intro reveals
  // their identity to the recipient — surface this in the compose UI
  // so the click is informed.
  viewerIsOffMarket?: boolean
}

// Larger, page-level version of MatchCard's IntroAction. Same mechanics:
// inline compose textarea, POSTs /api/introductions, handles 402 with the
// upgrade-CTA fallback.
export default function IntroActionClient({
  recipientId, recipientFirstName, initial, canSendIntros, viewerIsOffMarket,
}: Props) {
  const [intro, setIntro]         = useState<IntroState>(initial)
  const [composing, setComposing] = useState(false)
  const [message, setMessage]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function send() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/introductions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          recipient_id: recipientId,
          message:      message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setIntro({ status: 'pending', direction: 'outgoing', contactEmail: null })
      setComposing(false)
      setMessage('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  // Accepted → reveal the contact email
  if (intro.status === 'accepted' && intro.contactEmail) {
    return (
      <a
        href={`mailto:${intro.contactEmail}`}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald hover:brightness-110 text-sm font-semibold"
      >
        <span className="material-symbols-outlined text-base">mail</span>
        Email {recipientFirstName}
      </a>
    )
  }

  if (intro.status === 'pending' && intro.direction === 'outgoing') {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ee-border text-ee-muted text-sm">
        <span className="material-symbols-outlined text-base">hourglass_empty</span>
        Awaiting response
      </span>
    )
  }

  if (intro.status === 'pending' && intro.direction === 'incoming') {
    return (
      <Link
        href="/connections"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ee-gold/40 bg-ee-gold/10 text-ee-gold hover:brightness-110 text-sm font-semibold"
      >
        <span className="material-symbols-outlined text-base">reply</span>
        Respond to their request
      </Link>
    )
  }

  if (intro.status === 'declined') {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ee-border text-ee-muted/60 text-sm">
        Introduction declined
      </span>
    )
  }

  if (composing) {
    return (
      <div className="space-y-2 max-w-xl">
        {viewerIsOffMarket && (
          <div className="rounded-md border border-ee-gold/40 bg-ee-gold/10 px-3 py-2 text-xs text-ee-gold flex items-start gap-2">
            <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">visibility</span>
            <span>
              You&apos;re in <strong>Off-Market mode</strong>. Sending this request reveals
              your profile to {recipientFirstName} so they can decide. Other members still
              can&apos;t see you.
            </span>
          </div>
        )}
        <label className="block text-[10px] text-ee-muted font-data uppercase tracking-wider">
          Add a note for {recipientFirstName} (optional)
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={`Saw your mandate — would love to compare notes on…`}
          className="input-field text-sm resize-none leading-relaxed"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ee-muted font-data">{message.length}/500</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setComposing(false); setMessage(''); setError('') }}
              disabled={loading}
              className="px-4 py-2 rounded-full border border-ee-border text-ee-muted hover:text-ee-primary text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="px-4 py-2 rounded-full bg-ee-gold text-ee-bg font-semibold hover:brightness-110 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {loading ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  // No intro yet — show the CTA, gated on tier
  if (!canSendIntros) {
    return (
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ee-gold/40 bg-ee-gold/10 text-ee-gold hover:brightness-110 text-sm font-semibold"
        title="Introductions require Select or Sovereign membership"
      >
        <span className="material-symbols-outlined text-base">lock</span>
        Upgrade to introduce
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setComposing(true)}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ee-gold text-ee-bg font-semibold hover:brightness-110 text-sm"
    >
      <span className="material-symbols-outlined text-base">handshake</span>
      Request introduction
    </button>
  )
}
