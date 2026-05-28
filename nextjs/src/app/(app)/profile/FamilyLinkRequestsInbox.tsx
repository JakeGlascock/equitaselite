'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyLinkRequestView } from '@/lib/family'

// P5f — incoming link-request inbox on /profile. Rendered only when
// the viewer has at least one pending request (the surrounding section
// is hidden otherwise). Accept calls into family.ts acceptLinkRequest,
// which sets parent_profile_id + is_next_gen on the viewer's row, then
// router.refresh() so the rest of the /profile Family-seats section
// picks up the new linkage on the same render.
export default function FamilyLinkRequestsInbox({
  requests,
}: {
  requests: FamilyLinkRequestView[]
}) {
  const router = useRouter()
  const [busy,   setBusy]   = useState<string | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  async function respond(id: string, action: 'accept' | 'decline') {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/me/family-link-requests/${id}/${action}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed to ${action}`)
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`)
    } finally {
      setBusy(null)
    }
  }

  if (requests.length === 0) return null

  return (
    <section
      aria-labelledby="family-link-inbox-heading"
      className="glass-panel p-5 space-y-3"
    >
      <div>
        <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">
          Family
        </p>
        <h2
          id="family-link-inbox-heading"
          className="font-display text-lg text-ee-primary mt-1"
        >
          Family seat invitations ({requests.length})
        </h2>
        <p className="text-xs text-ee-muted mt-1">
          A wealth-holder on EE has invited you to join their family seat as
          a next-gen. Accepting links your existing account to theirs and
          enables shadow view of their dashboard, deals, connections, and
          matches. You can leave at any time.
        </p>
      </div>

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
                {r.requester_name ?? 'A wealth-holder'}
                {r.requester_firm && (
                  <span className="text-ee-muted"> — {r.requester_firm}</span>
                )}
              </p>
              <p className="text-[10px] text-ee-muted font-data tabular-nums mt-1">
                Sent {new Date(r.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => respond(r.id, 'decline')}
                disabled={busy === r.id}
                className="text-xs px-3 py-1.5 rounded border border-ee-border text-ee-muted hover:text-ee-primary disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => respond(r.id, 'accept')}
                disabled={busy === r.id}
                className="text-xs px-3 py-1.5 rounded border border-ee-gold/40 bg-ee-gold/10 text-ee-gold hover:bg-ee-gold/20 disabled:opacity-50"
              >
                {busy === r.id ? 'Linking…' : 'Accept'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
