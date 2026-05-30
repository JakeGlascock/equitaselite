'use client'

import { useState } from 'react'

interface Props {
  token:      string
  email:      string
  fullName:   string
  alreadyOff: boolean
}

export default function UnsubscribeClient({ token, email, fullName, alreadyOff }: Props) {
  const [done, setDone]       = useState(alreadyOff)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  async function unsubscribe() {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const firstName = (fullName || email).split(' ')[0]

  if (done) {
    return (
      <>
        <h1 className="font-display text-2xl text-ee-emerald">You&apos;re unsubscribed</h1>
        <p className="text-sm text-ee-muted">
          {firstName}, we won&apos;t email <strong className="text-ee-primary">{email}</strong> any
          more — including the weekly match digest and any introduction-event
          notifications. You can re-enable email any time from your profile
          settings.
        </p>
        <p className="text-xs text-ee-muted">
          Already-sent emails can&apos;t be unsent, but no new ones will go out.
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="font-display text-2xl text-ee-gold">Unsubscribe</h1>
      <p className="text-sm text-ee-muted">
        Stop sending email notifications to{' '}
        <strong className="text-ee-primary break-all">{email}</strong>?
      </p>
      <p className="text-xs text-ee-muted">
        This covers the weekly match digest as well as introduction-event
        notifications. You can re-enable email any time from your profile.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={unsubscribe}
        disabled={busy}
        className="btn-gold w-full justify-center disabled:opacity-50"
      >
        {busy ? 'Unsubscribing…' : 'Confirm unsubscribe'}
      </button>
    </>
  )
}
