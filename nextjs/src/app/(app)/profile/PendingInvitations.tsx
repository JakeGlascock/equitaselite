'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyLinkRequestView } from '@/lib/family'

// P5g — outgoing pending invitations on /profile, alongside the
// existing Next-gen seats list. Renders only when the wealth-holder
// has at least one pending outgoing request (the section header
// hides itself when the list is empty so we don't introduce dead
// chrome for wealth-holders who haven't invited anyone yet).
export default function PendingInvitations({
  requests,
}: {
  requests: FamilyLinkRequestView[]
}) {
  const router = useRouter()
  const [busy,  setBusy]  = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cancel(id: string) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/me/family-link-requests/${id}/cancel`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to cancel')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (requests.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">
        Pending invitations ({requests.length})
      </p>
      {error && (
        <p className="text-xs text-red-400" role="alert">{error}</p>
      )}
      <ul className="space-y-2">
        {requests.map(r => (
          <li
            key={r.id}
            className="border border-ee-border rounded-lg p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-ee-primary truncate">
                {r.target_name ?? 'A member'}
                {r.target_firm && (
                  <span className="text-ee-muted"> — {r.target_firm}</span>
                )}
              </p>
              {r.target_email && (
                <p className="text-xs text-ee-muted truncate">{r.target_email}</p>
              )}
              <p className="text-[10px] text-ee-muted font-data tabular-nums mt-1">
                Sent {new Date(r.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric',
                })} · awaiting their response
              </p>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => cancel(r.id)}
                disabled={busy === r.id}
                className="text-xs px-3 py-1.5 rounded border border-ee-border text-ee-muted hover:text-red-400 disabled:opacity-50"
              >
                {busy === r.id ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
