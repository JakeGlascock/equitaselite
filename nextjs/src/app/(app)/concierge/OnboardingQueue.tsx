'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type QueueTier = 'select' | 'sovereign'

export interface QueueRow {
  id:         string
  email:      string
  full_name:  string
  firm_name:  string
  role:       'angel' | 'family_office'
  membership: QueueTier
  created_at: string  // ISO
}

const TIER_STYLE: Record<QueueTier, string> = {
  select:    'border-ee-gold/40    bg-ee-gold/10    text-ee-gold',
  sovereign: 'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald',
}
const TIER_LABEL: Record<QueueTier, string> = {
  select:    'Select',
  sovereign: 'Sovereign',
}

function relativeAge(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs  = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)    return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export default function OnboardingQueue({ rows }: { rows: QueueRow[] }) {
  // Sort Sovereign first within the list (component-level so the server
  // query stays simple); within tier, oldest-on-the-queue surfaces first
  // so nobody waits too long.
  const sorted = [...rows].sort((a, b) => {
    if (a.membership === b.membership) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return a.membership === 'sovereign' ? -1 : 1
  })

  return (
    <section className="glass-panel overflow-hidden border-ee-gold/30">
      <div className="px-6 py-4 border-b border-ee-border flex items-center justify-between gap-4">
        <div>
          <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">Welcome queue</p>
          <h2 className="font-display text-lg text-ee-primary mt-0.5">
            {sorted.length} paid {sorted.length === 1 ? 'signup' : 'signups'} need a personal welcome
          </h2>
          <p className="text-xs text-ee-muted mt-1">
            Reach out within the first hour. Click <strong className="text-ee-primary">Mark welcomed</strong> once you&apos;ve made contact.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-ee-border/60">
        {sorted.map(r => <QueueItem key={r.id} row={r} />)}
      </ul>
    </section>
  )
}

function QueueItem({ row }: { row: QueueRow }) {
  const router = useRouter()
  const [busy, setBusy]   = useState(false)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState('')

  async function markWelcomed() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/concierge/welcome/${row.id}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      setHidden(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (hidden) return null

  return (
    <li className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-ee-primary truncate">{row.full_name}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-data uppercase tracking-wider ${TIER_STYLE[row.membership]}`}>
            {TIER_LABEL[row.membership]}
          </span>
          <span className="text-[10px] font-data uppercase tracking-wider text-ee-muted">
            {row.role === 'angel' ? 'Angel' : 'Family Office'}
          </span>
        </div>
        <p className="text-xs text-ee-muted truncate mt-0.5">{row.firm_name} · {row.email}</p>
        <p className="text-[11px] text-ee-muted/70 font-data mt-1">Joined {relativeAge(row.created_at)}</p>
        {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`mailto:${row.email}?subject=${encodeURIComponent(`Welcome to Equitas Elite`)}`}
          className="btn-ghost text-xs whitespace-nowrap"
        >
          Email
        </a>
        <button
          type="button"
          onClick={markWelcomed}
          disabled={busy}
          className="btn-gold text-xs whitespace-nowrap disabled:opacity-50"
        >
          {busy ? '…' : 'Mark welcomed'}
        </button>
      </div>
    </li>
  )
}
