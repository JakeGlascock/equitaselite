'use client'

import { useMemo, useState } from 'react'
import MatchCard from '@/components/MatchCard'
import type { MatchView } from '@/lib/matches'

const SECTORS    = ['FinTech', 'Deep Tech', 'Life Sciences', 'Clean Energy', 'SaaS', 'Consumer', 'AI / ML', 'Real Estate', 'Healthcare', 'Defense Tech']
const STAGES     = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series B+', 'Growth']
const GEOS       = ['North America', 'Europe', 'Asia-Pacific', 'Middle East', 'Latin America', 'Global']

function toggle(set: string[], val: string): string[] {
  return set.includes(val) ? set.filter(x => x !== val) : [...set, val]
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
        selected
          ? 'bg-ee-gold text-ee-bg border-ee-gold'
          : 'border-ee-border text-ee-primary hover:border-ee-gold/50 hover:text-ee-gold'
      }`}
    >
      {label}
    </button>
  )
}

export default function DiscoveryList({ matches }: { matches: MatchView[] }) {
  const [search, setSearch] = useState('')
  const [sectors, setSectors] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [geos, setGeos] = useState<string[]>([])
  const [sort, setSort] = useState<'score' | 'name'>('score')

  const filtered = useMemo(() => {
    let out = matches
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(m =>
        m.fullName.toLowerCase().includes(q) || m.firmName.toLowerCase().includes(q)
      )
    }
    if (sectors.length > 0) out = out.filter(m => m.sectors.some(s => sectors.includes(s)))
    if (stages.length > 0)  out = out.filter(m => m.stages.some(s  => stages.includes(s)))
    if (geos.length > 0)    out = out.filter(m => m.geography.some(g => geos.includes(g)))

    return [...out].sort((a, b) =>
      sort === 'score'
        ? b.score.total - a.score.total
        : a.fullName.localeCompare(b.fullName)
    )
  }, [matches, search, sectors, stages, geos, sort])

  function clearAll() { setSearch(''); setSectors([]); setStages([]); setGeos([]) }
  const hasFilters = !!search || sectors.length || stages.length || geos.length

  return (
    <div className="space-y-6">
      {/* Search & sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ee-muted text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or firm…"
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5 bg-white/5 border border-ee-border rounded-lg p-1">
          {(['score', 'name'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sort === s ? 'bg-ee-gold text-ee-bg' : 'text-ee-muted hover:text-ee-primary'
              }`}
            >
              {s === 'score' ? 'Best fit' : 'A–Z'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-ee-muted font-data uppercase tracking-wider">Sectors</p>
            {hasFilters && (
              <button type="button" onClick={clearAll} className="text-xs text-ee-muted hover:text-ee-primary">
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTORS.map(s => (
              <Chip key={s} label={s} selected={sectors.includes(s)} onClick={() => setSectors(toggle(sectors, s))} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Stages</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map(s => (
              <Chip key={s} label={s} selected={stages.includes(s)} onClick={() => setStages(toggle(stages, s))} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Geography</p>
          <div className="flex flex-wrap gap-1.5">
            {GEOS.map(g => (
              <Chip key={g} label={g} selected={geos.includes(g)} onClick={() => setGeos(toggle(geos, g))} />
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <p className="text-xs text-ee-muted">
        {filtered.length} of {matches.length} {matches.length === 1 ? 'profile' : 'profiles'}
        {hasFilters ? ' match your filters' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-ee-muted text-sm">No profiles match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      )}
    </div>
  )
}
