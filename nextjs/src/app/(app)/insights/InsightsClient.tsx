'use client'

import Link from 'next/link'
import { useState } from 'react'

type Tier = 'access' | 'select' | 'sovereign'
const TIER_RANK: Record<Tier, number> = { access: 0, select: 1, sovereign: 2 }
function meets(userTier: Tier, requires: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requires]
}

interface Report {
  id:       string
  title:    string
  summary:  string
  sector:   string
  type:     'Sector Report' | 'Benchmark' | 'Commentary' | 'Deal Flow'
  date:     string
  readTime: number
  featured?: boolean
  minTier:  Tier   // 'select' for standard reports, 'sovereign' for Deal Flow
}

const REPORTS: Report[] = [
  {
    id: 'r1', featured: true,
    title:    'Q1 2026 FinTech Investment Outlook',
    summary:  'Post-correction valuations, where Series-A funding has concentrated, and which sub-sectors are seeing the most family-office interest heading into Q2.',
    sector:   'FinTech', type: 'Sector Report',
    date:     '2026-04-12', readTime: 14, minTier: 'select',
  },
  {
    id: 'r2',
    title:    'Climate Tech: Capital Deployment Trends',
    summary:  'A breakdown of where angel capital has flowed across clean energy sub-sectors over the last 18 months, with check-size and stage benchmarks.',
    sector:   'Clean Energy', type: 'Benchmark',
    date:     '2026-04-03', readTime: 11, minTier: 'select',
  },
  {
    id: 'r3',
    title:    'AI Series A Median Round Size Hits $18M',
    summary:  'Up 34% YoY. We look at the deals driving the median, the firms leading them, and what it means for downstream Series B pricing.',
    sector:   'AI / ML', type: 'Commentary',
    date:     '2026-03-28', readTime: 6, minTier: 'select',
  },
  {
    id: 'r4',
    title:    'Family Office Allocation Patterns 2025',
    summary:  'Aggregate analysis of mandate disclosures from 47 family offices on the platform. Sector tilts, geographic concentration, and risk-tolerance distribution.',
    sector:   'Cross-sector', type: 'Benchmark',
    date:     '2026-03-15', readTime: 18, minTier: 'sovereign',
  },
  {
    id: 'r5',
    title:    'Defense Tech: From Niche to Mainstream',
    summary:  'Capital allocated to defense tech grew 4.2x over three years. Which segments are seeing the most activity and why family offices are leaning in.',
    sector:   'Defense Tech', type: 'Sector Report',
    date:     '2026-03-08', readTime: 9, minTier: 'select',
  },
  {
    id: 'r6',
    title:    'Life Sciences Bridge Round Activity',
    summary:  'Bridge rounds doubled in life sciences last quarter. We examine the runway dynamics and which therapeutic areas are seeing the most extensions.',
    sector:   'Life Sciences', type: 'Deal Flow',
    date:     '2026-02-22', readTime: 7, minTier: 'sovereign',
  },
  {
    id: 'r7',
    title:    'Consumer SaaS: Multiples Compression',
    summary:  'Revenue multiples for consumer SaaS contracted 38% YoY. The new pricing reality and what it means for follow-on rounds.',
    sector:   'SaaS', type: 'Commentary',
    date:     '2026-02-09', readTime: 8, minTier: 'select',
  },
]

const SECTORS = ['All', 'FinTech', 'AI / ML', 'Clean Energy', 'Life Sciences', 'Defense Tech', 'SaaS', 'Cross-sector']

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TIER_LABEL: Record<Tier, string> = { access: 'Access', select: 'Select', sovereign: 'Sovereign' }

function ReportCard({ r, currentTier }: { r: Report; currentTier: Tier }) {
  const unlocked = meets(currentTier, r.minTier)
  return (
    <article className={`glass-panel p-6 flex flex-col gap-3 relative transition-colors ${
      unlocked ? 'hover:border-ee-gold/30' : 'opacity-70'
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-data text-[10px] uppercase tracking-widest text-ee-gold">{r.type}</span>
        <span className="font-data text-[10px] text-ee-muted">{r.readTime} min</span>
      </div>
      <h3 className="font-display text-lg text-ee-primary leading-snug">{r.title}</h3>
      <p className="text-sm text-ee-muted leading-relaxed flex-grow">{r.summary}</p>
      <div className="flex items-center justify-between pt-3 border-t border-ee-outline/30">
        <div className="flex items-center gap-2">
          <span className="font-data text-[10px] px-2 py-0.5 rounded-full bg-ee-gold/10 border border-ee-gold/30 text-ee-gold">
            {r.sector}
          </span>
          <span className="text-xs text-ee-muted">{formatDate(r.date)}</span>
        </div>
        {unlocked ? (
          <button
            type="button"
            className="text-xs text-ee-gold hover:underline font-data uppercase tracking-wider"
          >
            Read →
          </button>
        ) : (
          <Link
            href="/pricing"
            className="text-xs text-ee-muted hover:text-ee-gold font-data uppercase tracking-wider inline-flex items-center gap-1"
            title={`${TIER_LABEL[r.minTier]} membership required`}
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            {TIER_LABEL[r.minTier]}
          </Link>
        )}
      </div>
    </article>
  )
}

export default function InsightsClient({ currentTier }: { currentTier: Tier }) {
  const [filter, setFilter] = useState('All')
  const featured = REPORTS.find(r => r.featured)!
  const featuredUnlocked = meets(currentTier, featured.minTier)
  const rest     = REPORTS.filter(r => !r.featured && (filter === 'All' || r.sector === filter))

  return (
    <div className="space-y-8">
      {/* Featured */}
      <article className="glass-panel p-8 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-data text-[10px] uppercase tracking-widest text-ee-gold">Featured</span>
            <span className="font-data text-[10px] text-ee-muted">·</span>
            <span className="font-data text-[10px] uppercase tracking-widest text-ee-muted">{featured.type}</span>
          </div>
          <h2 className="font-display text-3xl text-ee-primary leading-tight">{featured.title}</h2>
          <p className="text-ee-muted leading-relaxed">{featured.summary}</p>
          <div className="flex items-center gap-3 pt-2">
            {featuredUnlocked ? (
              <button type="button" className="btn-gold">Read full report</button>
            ) : (
              <Link href="/pricing" className="btn-gold inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">lock</span>
                Upgrade to {TIER_LABEL[featured.minTier]}
              </Link>
            )}
            <span className="text-xs text-ee-muted font-data">{featured.readTime} min · {formatDate(featured.date)}</span>
          </div>
        </div>
        {/* Visual */}
        <div className="hidden md:flex relative h-64 rounded-lg bg-gradient-to-br from-ee-gold/15 via-ee-gold/5 to-transparent border border-ee-gold/20 items-center justify-center overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-ee-gold/40 text-[120px]"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48", fontSize: '120px' }}
            >
              insights
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">{featured.sector}</p>
            <p className="text-ee-primary text-sm mt-1">Equitas Elite Research</p>
          </div>
        </div>
      </article>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {SECTORS.map(s => (
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

      {/* Grid */}
      {rest.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-ee-muted text-sm">No reports in this sector yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rest.map(r => <ReportCard key={r.id} r={r} currentTier={currentTier} />)}
        </div>
      )}
    </div>
  )
}
