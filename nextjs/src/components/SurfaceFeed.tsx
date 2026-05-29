'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Tier = 'access' | 'select' | 'sovereign'
const TIER_RANK:  Record<Tier, number> = { access: 0, select: 1, sovereign: 2 }
const TIER_LABEL: Record<Tier, string> = { access: 'Access', select: 'Select', sovereign: 'Sovereign' }

function meets(userTier: Tier, requires: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requires]
}

export interface FeedItem {
  id:          string
  title:       string
  summary:     string
  link:        string
  source:      string
  sector:      string
  minTier:     Tier
  publishedAt: string  // ISO
}

function formatDate(s: string): string {
  // timeZone: 'UTC' anchors the displayed calendar date to the publication
  // timestamp itself rather than the viewer's local timezone. Without this,
  // an article published at e.g. 2026-05-28T00:30:00Z renders as "May 28"
  // on the SSR pass (server runs in UTC) but "May 27" on hydration if the
  // visitor is west of UTC — React then fires #418 (hydration mismatch).
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function ItemCard({ item, currentTier }: { item: FeedItem; currentTier: Tier }) {
  const unlocked = meets(currentTier, item.minTier)
  return (
    <article className={`glass-panel p-6 flex flex-col gap-3 transition-colors ${
      unlocked ? 'hover:border-ee-gold/30' : 'opacity-70'
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-data text-[10px] uppercase tracking-widest text-ee-gold">{item.source}</span>
        <span className="font-data text-[10px] text-ee-muted">{formatDate(item.publishedAt)}</span>
      </div>
      <h3 className="font-display text-lg text-ee-primary leading-snug">{item.title}</h3>
      {item.summary && (
        <p className="text-sm text-ee-muted leading-relaxed flex-grow line-clamp-4">{item.summary}</p>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-ee-outline/30">
        <span className="font-data text-[10px] px-2 py-0.5 rounded-full bg-ee-gold/10 border border-ee-gold/30 text-ee-gold">
          {item.sector}
        </span>
        {unlocked ? (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ee-gold hover:underline font-data uppercase tracking-wider inline-flex items-center gap-1"
          >
            Read at {item.source} →
          </a>
        ) : (
          <Link
            href="/pricing"
            className="text-xs text-ee-muted hover:text-ee-gold font-data uppercase tracking-wider inline-flex items-center gap-1"
            title={`${TIER_LABEL[item.minTier]} membership required`}
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            {TIER_LABEL[item.minTier]}
          </Link>
        )}
      </div>
    </article>
  )
}

export interface SurfaceFeedProps {
  currentTier:    Tier
  items:          FeedItem[]
  featuredIcon:   string        // Material Symbols icon name for the featured-card visual
  emptyTitle:     string        // copy for the "no items yet" empty state
  emptyHint:      string
}

export default function SurfaceFeed({
  currentTier, items, featuredIcon, emptyTitle, emptyHint,
}: SurfaceFeedProps) {
  const sectors = useMemo(() => {
    const set = new Set<string>(['All'])
    for (const it of items) set.add(it.sector)
    return Array.from(set)
  }, [items])

  const [filter, setFilter] = useState('All')

  const filtered = useMemo(
    () => filter === 'All' ? items : items.filter(it => it.sector === filter),
    [items, filter]
  )

  const featured = filtered[0]
  const rest     = filtered.slice(1)

  if (items.length === 0) {
    return (
      <div className="glass-panel p-12 text-center space-y-2">
        <p className="text-ee-primary text-sm">{emptyTitle}</p>
        <p className="text-xs text-ee-muted">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Featured */}
      {featured && (
        <article className="glass-panel p-8 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-data text-[10px] uppercase tracking-widest text-ee-gold">Featured</span>
              <span className="font-data text-[10px] text-ee-muted">·</span>
              <span className="font-data text-[10px] uppercase tracking-widest text-ee-muted">{featured.source}</span>
            </div>
            <h2 className="font-display text-3xl text-ee-primary leading-tight">{featured.title}</h2>
            {featured.summary && (
              <p className="text-ee-muted leading-relaxed">{featured.summary}</p>
            )}
            <div className="flex items-center gap-3 pt-2">
              {meets(currentTier, featured.minTier) ? (
                <a
                  href={featured.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold"
                >
                  Read at {featured.source} →
                </a>
              ) : (
                <Link href="/pricing" className="btn-gold inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Upgrade to {TIER_LABEL[featured.minTier]}
                </Link>
              )}
              <span className="text-xs text-ee-muted font-data">{formatDate(featured.publishedAt)}</span>
            </div>
          </div>
          {/* Visual */}
          <div className="hidden md:flex relative h-64 rounded-lg bg-gradient-to-br from-ee-gold/15 via-ee-gold/5 to-transparent border border-ee-gold/20 items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-ee-gold/40 text-[120px]"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48", fontSize: '120px' }}
              >
                {featuredIcon}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">{featured.sector}</p>
              <p className="text-ee-primary text-sm mt-1">{featured.source}</p>
            </div>
          </div>
        </article>
      )}

      {/* Filter chips */}
      {sectors.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {sectors.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter === s
                  ? 'bg-ee-gold text-ee-bg border-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/50 hover:text-ee-gold'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {rest.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-ee-muted text-sm">No more items in this sector.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rest.map(it => <ItemCard key={it.id} item={it} currentTier={currentTier} />)}
        </div>
      )}

      <p className="text-center text-[11px] text-ee-muted font-data">
        Headlines © their respective publishers · attributed and linked above.
      </p>
    </div>
  )
}
