import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isUserAdmin } from '@/lib/admin'
import {
  getTierCounts,
  getRoleSplit,
  getIntroFunnel,
  getSectorBreakdown,
  getMandateDensity,
  getRecentSignups,
} from '@/lib/analytics'

export const dynamic = 'force-dynamic'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export default async function AnalyticsPage() {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')
  if (!(await isUserAdmin(userId, userEmail))) redirect('/dashboard')

  const [tiers, roles, funnel, sectors, density, signups] = await Promise.all([
    getTierCounts(),
    getRoleSplit(),
    getIntroFunnel(),
    getSectorBreakdown(),
    getMandateDensity(),
    getRecentSignups(),
  ])

  // Build a sorted axis list and a (sector,stage) → count map for the
  // heatmap grid render. Sectors ordered by total density across all
  // stages so the busiest sectors appear at the top.
  const sectorTotals = new Map<string, number>()
  const stageTotals  = new Map<string, number>()
  const cellMap      = new Map<string, number>()
  for (const c of density) {
    sectorTotals.set(c.sector, (sectorTotals.get(c.sector) ?? 0) + c.count)
    stageTotals.set(c.stage,   (stageTotals.get(c.stage)  ?? 0) + c.count)
    cellMap.set(`${c.sector}::${c.stage}`, c.count)
  }
  const sectorList = [...sectorTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  const stageList  = [...stageTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  const maxCell    = Math.max(0, ...density.map(c => c.count))

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-10">

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <Link href="/admin" className="text-[11px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold transition-colors">
              ← Admin
            </Link>
            <h1 className="font-display text-3xl text-ee-gold mt-2">Mandate analytics</h1>
            <p className="text-ee-muted text-sm mt-1">
              Real numbers from the platform — refreshed on every page load. Demo and managed accounts excluded.
            </p>
          </div>
        </div>

        {/* Top-level KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total members"   value={tiers.total} />
          <KPI label="Sovereign"       value={tiers.sovereign} accent />
          <KPI label="Select"          value={tiers.select} />
          <KPI label="Access"          value={tiers.access} />
          <KPI label="Angels"          value={roles.angel} />
          <KPI label="Family offices"  value={roles.family_office} />
          <KPI label="Signups · 7d"    value={signups.last_7d} />
          <KPI label="Signups · 30d"   value={signups.last_30d} />
        </section>

        {/* Intro funnel */}
        <section className="space-y-3">
          <h2 className="font-display text-xl text-ee-primary">Introduction funnel</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label="Total intros"     value={funnel.total} />
            <KPI label="Pending"          value={funnel.pending} />
            <KPI label="Accepted"         value={funnel.accepted} accent />
            <KPI label="Declined"         value={funnel.declined} />
            <KPI label="Acceptance rate"  value={pct(funnel.acceptance_rate)} />
          </div>
          {funnel.total === 0 && (
            <p className="text-xs text-ee-muted">No introductions yet — the funnel populates once members start requesting intros.</p>
          )}
        </section>

        {/* Sector breakdown */}
        <section className="space-y-3">
          <h2 className="font-display text-xl text-ee-primary">Members by sector</h2>
          {sectors.length === 0 ? (
            <p className="text-xs text-ee-muted">No members in declared sectors yet.</p>
          ) : (
            <div className="glass-panel p-5 space-y-2">
              {sectors.map(s => {
                const maxMembers = Math.max(...sectors.map(x => x.members))
                const ratio = maxMembers === 0 ? 0 : s.members / maxMembers
                return (
                  <div key={s.sector} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-xs text-ee-primary truncate">{s.sector}</div>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ee-gold/60 rounded-full"
                        style={{ width: `${Math.max(2, ratio * 100)}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-xs text-ee-muted tabular-nums">{s.members}</div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Mandate density heatmap */}
        <section className="space-y-3">
          <h2 className="font-display text-xl text-ee-primary">Mandate density (sectors × stages)</h2>
          <p className="text-xs text-ee-muted">
            How many members have each sector × stage combination in their declared mandate. Members count multiple times if their mandate covers several sector × stage cells.
          </p>
          {density.length === 0 ? (
            <p className="text-xs text-ee-muted">No declared mandates yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left p-2 font-data uppercase tracking-widest text-[9px] text-ee-muted"></th>
                    {stageList.map(stage => (
                      <th key={stage} className="text-center p-2 font-data uppercase tracking-widest text-[9px] text-ee-muted whitespace-nowrap">{stage}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectorList.map(sector => (
                    <tr key={sector}>
                      <th className="text-left pr-3 py-2 text-ee-primary whitespace-nowrap font-normal">{sector}</th>
                      {stageList.map(stage => {
                        const c = cellMap.get(`${sector}::${stage}`) ?? 0
                        const intensity = maxCell === 0 ? 0 : c / maxCell
                        const bg = c === 0
                          ? 'rgba(255,255,255,0.03)'
                          : `rgba(233,193,118,${0.1 + intensity * 0.6})`
                        const color = intensity > 0.5 ? '#031427' : '#bec6e0'
                        return (
                          <td
                            key={stage}
                            className="text-center min-w-[3rem] py-2 px-1 rounded tabular-nums"
                            style={{ background: bg, color }}
                          >
                            {c || ''}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

function KPI({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`glass-panel p-4 ${accent ? 'border-ee-gold/40' : ''}`}>
      <p className="font-data text-[10px] tracking-widest uppercase text-ee-muted mb-1.5">{label}</p>
      <p className={`font-display text-3xl tabular-nums ${accent ? 'text-ee-gold' : 'text-ee-primary'}`}>
        {value}
      </p>
    </div>
  )
}
