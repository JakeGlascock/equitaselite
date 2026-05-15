import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTier } from '@/lib/membership'
import { fetchSurfaceItems } from '@/lib/rss-surface'
import SurfaceFeed from '@/components/SurfaceFeed'

export default async function InsightsPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  const [tier, items] = await Promise.all([
    getTier(userId),
    fetchSurfaceItems('insights'),
  ])

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Intelligence</p>
            <h1 className="font-display text-3xl text-ee-gold mt-1">Insights</h1>
            <p className="text-ee-muted text-sm mt-1">
              Curated coverage from the publications that shape institutional capital — refreshed every six hours.
            </p>
          </div>
          {tier === 'access' && (
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs">
              Unlock premium sources →
            </Link>
          )}
        </div>

        <SurfaceFeed
          currentTier={tier}
          items={items}
          featuredIcon="insights"
          emptyTitle="No items yet."
          emptyHint="Our first poll of these feeds runs within six hours."
        />
      </div>
    </div>
  )
}
