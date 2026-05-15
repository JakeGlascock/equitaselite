import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { query } from '@/lib/db'
import { getTier, type Tier } from '@/lib/membership'
import InsightsClient, { type InsightItem } from './InsightsClient'

interface DbRow {
  id:           string
  title:        string
  summary:      string | null
  link:         string
  source_label: string
  sector_tag:   string
  min_tier:     Tier
  published_at: Date | string | null
  fetched_at:   Date | string
}

function toIso(d: Date | string | null): string | null {
  if (!d)               return null
  if (d instanceof Date) return d.toISOString()
  return d
}

export default async function InsightsPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')
  const tier = await getTier(userId)

  // Pull the most recent ~50 items across all 'insights' feeds. Empty
  // result is fine — page renders a "check back soon" empty state.
  // Catches a missing-table error so pre-migration-014 environments
  // don't blow up.
  let items: InsightItem[] = []
  try {
    const rows = await query<DbRow>(
      `SELECT i.id, i.title, i.summary, i.link,
              f.source_label, f.sector_tag, f.min_tier,
              i.published_at, i.fetched_at
       FROM rss_items i
       JOIN rss_feeds f ON f.id = i.feed_id
       WHERE f.surface = 'insights' AND f.active = TRUE
       ORDER BY COALESCE(i.published_at, i.fetched_at) DESC
       LIMIT 50`
    )
    items = rows.map(r => ({
      id:           r.id,
      title:        r.title,
      summary:      r.summary ?? '',
      link:         r.link,
      source:       r.source_label,
      sector:       r.sector_tag,
      minTier:      r.min_tier,
      publishedAt:  toIso(r.published_at) ?? toIso(r.fetched_at) ?? new Date().toISOString(),
    }))
  } catch { /* rss tables not yet migrated */ }

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

        <InsightsClient currentTier={tier} items={items} />
      </div>
    </div>
  )
}
