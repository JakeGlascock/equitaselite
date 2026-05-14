'use client'

import Link from 'next/link'
import { useState } from 'react'

type Tier = 'access' | 'select' | 'sovereign'
const TIER_RANK: Record<Tier, number> = { access: 0, select: 1, sovereign: 2 }

// Map the human-readable tier strings on each event to the minimum tier
// the viewer needs to RSVP.
function minTierFor(label: 'All members' | 'Select+' | 'Sovereign only'): Tier {
  if (label === 'All members')    return 'access'
  if (label === 'Select+')        return 'select'
  return 'sovereign'
}
function meets(userTier: Tier, requires: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requires]
}
const TIER_LABEL: Record<Tier, string> = { access: 'Access', select: 'Select', sovereign: 'Sovereign' }

interface EventItem {
  id:          string
  title:       string
  type:        'Summit' | 'Roundtable' | 'Webinar' | 'Showcase'
  description: string
  date:        string  // ISO
  duration:    string
  location:    string
  capacity:    number
  registered:  number
  tier:        'All members' | 'Select+' | 'Sovereign only'
}

const UPCOMING: EventItem[] = [
  {
    id: 'e1',
    title:       'Annual Equitas Summit',
    type:        'Summit',
    description: 'Three days at Aspen with 80 hand-picked principals. Closed-door talks on portfolio construction, mandate alignment, and deal flow trends. Sovereign-tier members only.',
    date:        '2026-06-12',
    duration:    'Jun 12-14 · 3 days',
    location:    'Aspen, CO',
    capacity:    80, registered: 67,
    tier:        'Sovereign only',
  },
  {
    id: 'e2',
    title:       'FinTech Series A Roundtable',
    type:        'Roundtable',
    description: 'Eight angels and four family offices. Closed roundtable on Series-A FinTech valuations and current deployment posture. Chatham House rules.',
    date:        '2026-05-22',
    duration:    '90 min',
    location:    'Virtual',
    capacity:    12, registered: 9,
    tier:        'Select+',
  },
  {
    id: 'e3',
    title:       'Climate Tech Deal Showcase',
    type:        'Showcase',
    description: 'Six founders from our member portfolios present Series-A and Series-B opportunities. Office hours for interested investors immediately after.',
    date:        '2026-05-30',
    duration:    '2 hours',
    location:    'San Francisco, CA',
    capacity:    40, registered: 24,
    tier:        'All members',
  },
  {
    id: 'e4',
    title:       'Family Office Mandate Workshop',
    type:        'Webinar',
    description: 'Practical session on how to refine your platform mandate for higher-quality matches. Includes a live mandate review with a Sovereign-tier CIO.',
    date:        '2026-05-15',
    duration:    '60 min',
    location:    'Virtual',
    capacity:    100, registered: 41,
    tier:        'All members',
  },
]

const PAST: EventItem[] = [
  {
    id: 'p1',
    title:       'AI/ML Investment Outlook 2026',
    type:        'Webinar',
    description: 'Recording available in your inbox.',
    date:        '2026-03-18',
    duration:    '75 min',
    location:    'Virtual',
    capacity:    100, registered: 87,
    tier:        'All members',
  },
  {
    id: 'p2',
    title:       'Defense Tech Founders Showcase',
    type:        'Showcase',
    description: 'Five founders presented Series-A opportunities.',
    date:        '2026-02-26',
    duration:    '2 hours',
    location:    'Arlington, VA',
    capacity:    35, registered: 31,
    tier:        'Select+',
  },
]

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
  const [rsvp, setRsvp] = useState<'idle' | 'pending' | 'done'>('idle')
  const color = TYPE_COLOR[e.type]
  const required = minTierFor(e.tier)
  const unlocked = meets(currentTier, required)

  async function handleRSVP() {
    setRsvp('pending')
    setTimeout(() => setRsvp('done'), 600)
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
            <span className="font-data text-[10px] uppercase tracking-widest text-ee-muted">{e.tier}</span>
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
              {e.registered} / {e.capacity}
            </span>
            {!past && (
              unlocked ? (
                <button
                  type="button"
                  onClick={handleRSVP}
                  disabled={rsvp !== 'idle'}
                  className={`ml-auto text-xs px-3 py-1.5 rounded-full font-data uppercase tracking-wider transition-all ${
                    rsvp === 'done'
                      ? 'bg-ee-emerald/15 border border-ee-emerald/40 text-ee-emerald'
                      : 'bg-ee-gold text-ee-bg font-semibold hover:brightness-110 disabled:opacity-50'
                  }`}
                >
                  {rsvp === 'done' ? 'Registered ✓' : rsvp === 'pending' ? 'Saving…' : 'RSVP'}
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="ml-auto text-xs px-3 py-1.5 rounded-full font-data uppercase tracking-wider inline-flex items-center gap-1.5 border border-ee-border text-ee-muted hover:text-ee-gold hover:border-ee-gold/40"
                  title={`${TIER_LABEL[required]} membership required to RSVP`}
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Upgrade to {TIER_LABEL[required]}
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function EventsClient({ currentTier }: { currentTier: Tier }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl text-ee-primary mb-4">Upcoming</h2>
        <div className="space-y-3">
          {UPCOMING.map(e => <EventCard key={e.id} e={e} currentTier={currentTier} />)}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ee-primary mb-4">Recently passed</h2>
        <div className="space-y-3">
          {PAST.map(e => <EventCard key={e.id} e={e} past currentTier={currentTier} />)}
        </div>
      </section>
    </div>
  )
}
