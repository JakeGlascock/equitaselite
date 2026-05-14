import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTier } from '@/lib/membership'
import InsightsClient from './InsightsClient'

export default async function InsightsPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')
  const tier = await getTier(userId)

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Intelligence</p>
            <h1 className="font-display text-3xl text-ee-gold mt-1">Insights</h1>
            <p className="text-ee-muted text-sm mt-1">
              Sector reports, mandate benchmarks, and market commentary — curated for institutional investors.
            </p>
          </div>
          {tier === 'access' && (
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs">
              Unlock reports →
            </Link>
          )}
        </div>

        <InsightsClient currentTier={tier} />
      </div>
    </div>
  )
}
