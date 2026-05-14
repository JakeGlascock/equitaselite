import { redirect } from 'next/navigation'
import {
  getMe, getCandidates, getIntroductions,
  buildIntroMap, toMatchView,
} from '@/lib/matches'
import { getActingAsState } from '@/lib/acting-as'

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: 'gold' | 'emerald'
}) {
  const color = accent === 'emerald' ? 'text-ee-emerald' : accent === 'gold' ? 'text-ee-gold' : 'text-ee-primary'
  return (
    <div className="glass-panel p-5">
      <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">{label}</p>
      <p className={`font-display text-3xl ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ee-muted mt-1">{sub}</p>}
    </div>
  )
}

function HorizontalBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total === 0 ? 0 : (count / total) * 100
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-ee-primary">{label}</span>
        <span className="text-ee-muted font-data">{count}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default async function ReportsPage() {
  const state = await getActingAsState()
  if (!state) redirect('/signin')
  const userId = state.effectiveUserId

  const me = await getMe(userId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  const [candidates, intros] = await Promise.all([
    getCandidates(me),
    getIntroductions(userId),
  ])

  const introMap = buildIntroMap(intros, userId)
  const matches  = candidates.map(c => toMatchView(c, me, introMap.get(c.id)))

  // Stats
  const strongFits = matches.filter(m => m.score.label === 'Strong Fit').length
  const goodFits   = matches.filter(m => m.score.label === 'Good Fit').length
  const avgScore   = matches.length === 0
    ? 0
    : Math.round(matches.reduce((s, m) => s + m.score.total, 0) / matches.length)

  const sentIntros     = intros.filter(i => i.requester_id === userId).length
  const receivedIntros = intros.filter(i => i.recipient_id === userId).length
  const accepted       = intros.filter(i => i.status === 'accepted').length
  const acceptanceRate = sentIntros === 0 ? 0 : Math.round(
    (intros.filter(i => i.requester_id === userId && i.status === 'accepted').length / sentIntros) * 100
  )

  // Sector distribution of matched profiles
  const sectorCounts = new Map<string, number>()
  matches.forEach(m => m.sectors.forEach(s => sectorCounts.set(s, (sectorCounts.get(s) ?? 0) + 1)))
  const topSectors = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Geography distribution
  const geoCounts = new Map<string, number>()
  matches.forEach(m => m.geography.forEach(g => geoCounts.set(g, (geoCounts.get(g) ?? 0) + 1)))
  const topGeos = [...geoCounts.entries()].sort((a, b) => b[1] - a[1])

  // Fit distribution
  const fitDist = [
    { label: 'Strong Fit',   count: strongFits,                                       color: '#4edea3' },
    { label: 'Good Fit',     count: goodFits,                                          color: '#e9c176' },
    { label: 'Possible Fit', count: matches.filter(m => m.score.label === 'Possible Fit').length, color: '#f59e0b' },
    { label: 'Low Fit',      count: matches.filter(m => m.score.label === 'Low Fit').length,      color: '#ef4444' },
  ]

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Intelligence</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Mandate Performance</h1>
          <p className="text-ee-muted text-sm mt-1">
            Your matching, introduction, and pipeline metrics — updated in real time.
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total matches" value={matches.length} accent="gold"
            sub={`Avg fit score ${avgScore}`} />
          <StatCard label="Strong fits"   value={strongFits} accent="emerald"
            sub={matches.length ? `${Math.round(strongFits/matches.length*100)}% of pipeline` : '—'} />
          <StatCard label="Intros sent"   value={sentIntros}
            sub={`${acceptanceRate}% acceptance`} />
          <StatCard label="Active conns." value={accepted}
            sub={`${receivedIntros} requests received`} />
        </div>

        {/* Fit distribution */}
        <div className="glass-panel p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg text-ee-primary">Fit distribution</h2>
            <p className="text-xs text-ee-muted mt-0.5">How your matches are spread across the scoring buckets.</p>
          </div>
          <div className="space-y-3">
            {fitDist.map(b => (
              <HorizontalBar key={b.label} label={b.label} count={b.count} total={matches.length || 1} color={b.color} />
            ))}
          </div>
        </div>

        {/* Sector + Geography */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-panel p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg text-ee-primary">Top sectors</h2>
              <p className="text-xs text-ee-muted mt-0.5">Where your matched counterparties focus.</p>
            </div>
            <div className="space-y-3">
              {topSectors.length === 0 ? (
                <p className="text-xs text-ee-muted">No sector data yet.</p>
              ) : (
                topSectors.map(([sector, count]) => (
                  <HorizontalBar key={sector} label={sector} count={count} total={matches.length || 1} color="#e9c176" />
                ))
              )}
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg text-ee-primary">Geography</h2>
              <p className="text-xs text-ee-muted mt-0.5">Coverage across your matched pipeline.</p>
            </div>
            <div className="space-y-3">
              {topGeos.length === 0 ? (
                <p className="text-xs text-ee-muted">No geography data yet.</p>
              ) : (
                topGeos.map(([geo, count]) => (
                  <HorizontalBar key={geo} label={geo} count={count} total={matches.length || 1} color="#bec6e0" />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
