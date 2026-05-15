import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTier } from '@/lib/membership'
import { fetchSurfaceItems } from '@/lib/rss-surface'
import { listPublishedReports, callerCanRead } from '@/lib/reports'
import SurfaceFeed from '@/components/SurfaceFeed'

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ReportsPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  const tier = await getTier(userId)
  const [items, reports] = await Promise.all([
    fetchSurfaceItems('reports'),
    listPublishedReports(tier),
  ])

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Filings &amp; research</p>
            <h1 className="font-display text-3xl text-ee-gold mt-1">Reports</h1>
            <p className="text-ee-muted text-sm mt-1">
              In-house editorial below; SEC filings and analyst research streamed from public regulatory feeds, refreshed every six hours.
            </p>
          </div>
          {tier === 'access' && (
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs">
              Unlock full reports →
            </Link>
          )}
        </div>

        {reports.length > 0 && (
          <section>
            <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase mb-4">Editorial</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map(r => {
                const canRead = callerCanRead(tier, r.min_tier)
                return (
                  <article key={r.id} className="glass-panel p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-widest">
                      <span className="text-ee-muted">{r.sector_tag}</span>
                      <span className="text-ee-muted/40">·</span>
                      <span className="text-ee-muted">{fmtDate(r.published_at)}</span>
                      {!canRead && (
                        <>
                          <span className="text-ee-muted/40">·</span>
                          <span className="text-ee-gold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">lock</span>
                            {r.min_tier === 'sovereign' ? 'Sovereign' : 'Select'}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-xl text-ee-primary leading-tight">
                      {canRead
                        ? <Link href={`/reports/${r.slug}`} className="hover:text-ee-gold transition-colors">{r.title}</Link>
                        : <span>{r.title}</span>
                      }
                    </h2>
                    <p className="text-sm text-ee-muted leading-relaxed flex-grow">{r.summary}</p>
                    {canRead ? (
                      <Link href={`/reports/${r.slug}`} className="text-xs font-data uppercase tracking-widest text-ee-gold hover:underline mt-2">
                        Read →
                      </Link>
                    ) : (
                      <Link href="/pricing" className="text-xs font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold transition-colors mt-2">
                        Upgrade to read →
                      </Link>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase mb-4">Filings &amp; news</p>
          <SurfaceFeed
            currentTier={tier}
            items={items}
            featuredIcon="description"
            emptyTitle="No filings yet."
            emptyHint="SEC EDGAR is polled every six hours. New 10-K and 8-K filings will appear here as they're released."
          />
        </section>
      </div>
    </div>
  )
}
