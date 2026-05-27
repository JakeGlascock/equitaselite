'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DealMessage } from '@/lib/deals'

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// P4 — per-deal room thread. Posts go through
// POST /api/deals/[id]/messages; pin/remove uses PATCH on the
// nested route. Moderation buttons only render for the deal's
// creator (admin or the originating concierge), gated server-side
// regardless.
export default function DealDiscussion({
  dealId, initialMessages, currentUserId, isModerator,
}: {
  dealId:          string
  initialMessages: DealMessage[]
  currentUserId:   string
  isModerator:     boolean
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<DealMessage[]>(initialMessages)
  const [draft,    setDraft]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to post')
      setMessages(prev => [...prev, data.message])
      setDraft('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setBusy(false)
    }
  }

  async function moderate(messageId: string, action: 'pin' | 'unpin' | 'remove') {
    setError('')
    try {
      const body =
        action === 'pin'    ? { pinned: true } :
        action === 'unpin'  ? { pinned: false } :
                              { removed: true }
      const res = await fetch(`/api/deals/${dealId}/messages/${messageId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Action failed')
      }
      // Easiest path to a clean post-action state: refresh the server
      // component. The reorder (pin / unpin) + removal both need a
      // full re-fetch through the listDealMessages SQL ordering.
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  return (
    <section className="glass-panel p-6 space-y-5">
      <div>
        <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
          Co-invest room
        </p>
        <h2 className="font-display text-lg text-ee-primary mt-1">Member discussion</h2>
        <p className="text-xs text-ee-muted mt-1">
          Visible only to invited members. Concierge can pin or remove messages.
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-ee-muted italic text-center py-6">
          No posts yet. Start the conversation.
        </p>
      ) : (
        <ol className="space-y-3">
          {messages.map(m => {
            const mine = m.user_id === currentUserId
            return (
              <li
                key={m.id}
                className={`rounded-lg border p-3 space-y-1.5 ${
                  m.pinned_by_concierge
                    ? 'border-ee-gold/40 bg-ee-gold/5'
                    : mine
                      ? 'border-ee-emerald/30 bg-ee-emerald/5'
                      : 'border-ee-border bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                    <p className="font-semibold text-sm text-ee-primary truncate">
                      {m.user_name ?? 'Member'}
                    </p>
                    {m.user_firm && (
                      <p className="text-[11px] text-ee-muted truncate">{m.user_firm}</p>
                    )}
                    {m.shadowed_parent_id && (
                      <span
                        className="text-[10px] font-data uppercase tracking-widest text-ee-muted px-1.5 py-0.5 rounded border border-ee-border"
                        title="Posted by a next-gen seat on behalf of this family office"
                      >
                        On behalf of {m.shadowed_parent_firm ?? 'family seat'}
                      </span>
                    )}
                    {m.pinned_by_concierge && (
                      <span
                        className="text-[10px] font-data uppercase tracking-widest text-ee-gold px-1.5 py-0.5 rounded border border-ee-gold/40"
                        title="Pinned by the concierge"
                      >Pinned</span>
                    )}
                  </div>
                  <p className="text-[10px] text-ee-muted">{fmtTime(m.created_at)}</p>
                </div>
                <p className="text-sm text-ee-primary whitespace-pre-line">{m.body}</p>
                {isModerator && (
                  <div className="flex items-center gap-3 pt-1 text-[10px] font-data uppercase tracking-widest">
                    <button
                      type="button"
                      onClick={() => moderate(m.id, m.pinned_by_concierge ? 'unpin' : 'pin')}
                      className="text-ee-muted hover:text-ee-gold"
                    >
                      {m.pinned_by_concierge ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Remove this message? It will be hidden but kept for audit.')) {
                          void moderate(m.id, 'remove')
                        }
                      }}
                      className="text-ee-muted hover:text-red-400"
                    >Remove</button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <form onSubmit={send} className="space-y-2 border-t border-ee-border/40 pt-4">
        <label htmlFor="deal-message-body" className="block text-[10px] font-data uppercase tracking-widest text-ee-muted">
          Add to the conversation
        </label>
        <textarea
          id="deal-message-body"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={4000}
          rows={3}
          required
          className="input-field resize-y"
          placeholder="What did you find when you diligenced this? Any concerns? Anyone else in the LP base?"
        />
        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="btn-gold text-xs disabled:opacity-50 ml-auto"
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </section>
  )
}
