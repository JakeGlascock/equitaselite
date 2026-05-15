import { query } from '@/lib/db'
import type { FeedItem } from '@/components/SurfaceFeed'
import type { Tier } from '@/lib/membership'

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
  if (!d) return null
  return d instanceof Date ? d.toISOString() : d
}

export type Surface = 'insights' | 'discovery' | 'network' | 'reports'

// Pulls the latest items for a given surface. Returns an empty array if
// the rss tables don't exist yet (pre-migration-014 environments).
export async function fetchSurfaceItems(surface: Surface, limit = 50): Promise<FeedItem[]> {
  try {
    const rows = await query<DbRow>(
      `SELECT i.id, i.title, i.summary, i.link,
              f.source_label, f.sector_tag, f.min_tier,
              i.published_at, i.fetched_at
       FROM rss_items i
       JOIN rss_feeds f ON f.id = i.feed_id
       WHERE f.surface = $1 AND f.active = TRUE
       ORDER BY COALESCE(i.published_at, i.fetched_at) DESC
       LIMIT $2`,
      [surface, limit]
    )
    return rows.map(r => ({
      id:          r.id,
      title:       r.title,
      summary:     r.summary ?? '',
      link:        r.link,
      source:      r.source_label,
      sector:      r.sector_tag,
      minTier:     r.min_tier,
      publishedAt: toIso(r.published_at) ?? toIso(r.fetched_at) ?? new Date().toISOString(),
    }))
  } catch {
    return []
  }
}
