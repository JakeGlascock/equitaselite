import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTier } from '@/lib/membership'
import { fetchSurfaceItems } from '@/lib/rss-surface'
import SurfaceFeed from '@/components/SurfaceFeed'

export default async function NetworkPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  const [tier, items] = await Promise.all([
    getTier(userId),
    fetchSurfaceItems('network'),
  ])

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Network</p>
            <h1 className="font-display text-3xl text-ee-gold mt-1">Voices we read</h1>
            <p className="text-ee-muted text-sm mt-1">
              Long-form thinking from operators and investors shaping institutional capital — updated as their feeds publish.
            </p>
          </div>
          {tier === 'access' && (
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs">
              Unlock premium voices →
            </Link>
          )}
        </div>

        <SurfaceFeed
          currentTier={tier}
          items={items}
          featuredIcon="group"
          emptyTitle="No items yet."
          emptyHint="Our first poll of these voices runs within six hours."
        />
      </div>
    </div>
  )
}
