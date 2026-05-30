'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Tier = 'access' | 'select' | 'sovereign'
const TIER_RANK:  Record<Tier, number> = { access: 0, select: 1, sovereign: 2 }
const TIER_LABEL: Record<Tier, string> = { access: 'Access', select: 'Select', sovereign: 'Sovereign' }

function meets(userTier: Tier, requires: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requires]
}

export interface EventItem {
  id:          string
  title:       string
  description: string
  type:        'Summit' | 'Roundtable' | 'Webinar' | 'Showcase'
  date:        string  // ISO
  duration:    string
  location:    string
  capacity:    number
  registered:  number
  minTier:     Tier
  rsvped:      boolean
}

const TYPE_COLOR: Record<EventItem['type'], string> = {
  Summit:     '#e9c176',
  Roundtable: '#4edea3',
  Webinar:    '#bec6e0',
  Showcase:   '#f59e0b',
}

function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso)
  const day   = d.getDate()
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return (
    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-ee-gold/10 border border-ee-gold/30 shrink-0">
      <span className="font-data text-[9px] tracking-widest text-ee-gold uppercase">{month}</span>
      <span className="font-display text-2xl text-ee-gold leading-none mt-0.5">{day}</span>
    </div>
  )
}

function EventCard({ e, past = false, currentTier }: { e: EventItem; past?: boolean; currentTier: Tier }) {
  const router = useRouter()
  const [rsvped, setRsvped]   = useState(e.rsvped)
  const [count, setCount]     = useState(e.registered)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const color = TYPE_COLOR[e.type]
  const unlocked = meets(currentTier, e.minTier)
  const full     = count >= e.capacity && !rsvped

  async function toggleRsvp() {
    setLoading(true); setError('')
    const method  = rsvped ? 'DELETE' : 'POST'
    const wasFull = full  // capture before optimistic update
    try {
      const res  = await fetch(`/api/events/${e.id}/rsvp`, { method })
      const data = res.headers.get('content-type')?.includes('json') ? await res.json() : {}
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setRsvped(!rsvped)
      setCount(c => c + (rsvped ? -1 : 1))
      // refresh server components so other pages see the new state
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      if (wasFull) { /* no-op */ }
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className={`glass-panel p-5 ${past || !unlocked ? 'opacity-70' : ''}`}>
      <div className="flex gap-4">
        <DateBadge iso={e.date} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className="font-data text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: `${color}55`, background: `${color}1a` }}
            >
              {e.type}
            </span>
            <span className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
              {TIER_LABEL[e.minTier]}+
            </span>
          </div>
          <h3 className="font-display text-lg text-ee-primary leading-snug">{e.title}</h3>
          <p className="text-xs text-ee-muted leading-relaxed">{e.description}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-ee-muted">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {e.duration}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">place</span>
              {e.location}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">group</span>
              {count} / {e.capacity}
            </span>
            {!past && (
              unlocked ? (
                <button
                  type="button"
                  onClick={toggleRsvp}
                  disabled={loading || (full && !rsvped)}
                  className={`ml-auto text-xs px-3 py-1.5 rounded-full font-data uppercase tracking-wider transition-all ${
                    rsvped
                      ? 'bg-ee-emerald/15 border border-ee-emerald/40 text-ee-emerald hover:bg-ee-emerald/25'
                      : full
                        ? 'bg-white/5 border border-ee-border text-ee-muted/60 cursor-not-allowed'
                        : 'bg-ee-gold text-ee-bg font-semibold hover:brightness-110 disabled:opacity-50'
                  }`}
                >
                  {loading
                    ? '…'
                    : rsvped
                      ? 'Registered ✓'
                      : full
                        ? 'At capacity'
                        : 'RSVP'}
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="ml-auto text-xs px-3 py-1.5 rounded-full font-data uppercase tracking-wider inline-flex items-center gap-1.5 border border-ee-border text-ee-muted hover:text-ee-gold hover:border-ee-gold/40"
                  title={`${TIER_LABEL[e.minTier]} membership required to RSVP`}
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Upgrade to {TIER_LABEL[e.minTier]}
                </Link>
              )
            )}
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      </div>
    </article>
  )
}

export default function EventsClient({
  currentTier, upcoming, past,
}: {
  currentTier: Tier
  upcoming:    EventItem[]
  past:        EventItem[]
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="glass-panel p-10 text-center space-y-2">
        <p className="text-ee-primary text-sm">No events scheduled.</p>
        <p className="text-xs text-ee-muted">
          Equitas Elite hosts summits, roundtables, and showcases for members. Check back soon.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ee-primary mb-4">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map(e => <EventCard key={e.id} e={e} currentTier={currentTier} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ee-primary mb-4">Recently passed</h2>
          <div className="space-y-3">
            {past.map(e => <EventCard key={e.id} e={e} past currentTier={currentTier} />)}
          </div>
        </section>
      )}
    </div>
  )
}
