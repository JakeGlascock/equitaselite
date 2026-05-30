'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DealResponseControls({ invitationId }: { invitationId: string }) {
  const router = useRouter()
  const [busy,  setBusy]  = useState<'interested' | 'declined' | null>(null)
  const [error, setError] = useState('')

  async function respond(status: 'interested' | 'declined') {
    setBusy(status); setError('')
    try {
      const res = await fetch(`/api/deals/${invitationId}/respond`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      // Refresh the server component to show the new state pill and hide
      // the controls. router.refresh() is enough — page is a server
      // component reading from listInvitationsForUser.
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-3 pt-2 border-t border-ee-border/40">
      <button
        type="button"
        onClick={() => respond('interested')}
        disabled={busy !== null}
        className="btn-gold text-xs disabled:opacity-50"
      >
        {busy === 'interested' ? 'Sending…' : 'Express interest'}
      </button>
      <button
        type="button"
        onClick={() => respond('declined')}
        disabled={busy !== null}
        className="text-xs font-data uppercase tracking-widest text-ee-muted hover:text-ee-primary disabled:opacity-50"
      >
        {busy === 'declined' ? 'Saving…' : 'Pass'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
