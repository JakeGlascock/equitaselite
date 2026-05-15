import { query, queryOne } from '@/lib/db'
import { type Tier, priorityRank } from '@/lib/membership'

export type ReportMinTier = 'access' | 'select' | 'sovereign'

export interface ReportSummary {
  id:           string
  slug:         string
  title:        string
  summary:      string
  sector_tag:   string
  min_tier:     ReportMinTier
  published_at: string | null
  updated_at:   string
}

export interface ReportFull extends ReportSummary {
  body:      string
  body_html: string | null
}

interface DbRow {
  id:           string
  slug:         string
  title:        string
  summary:      string
  sector_tag:   string
  min_tier:     ReportMinTier
  body?:        string
  body_html?:   string | null
  published_at: Date | string | null
  updated_at:   Date | string
}

function toIso(d: Date | string | null): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : d
}

function toIsoNonNull(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : d
}

// Lists published reports the caller's tier is allowed to see. Returns
// summaries only (body excluded — small payload for the list view).
// Empty array if the reports table doesn't exist yet (pre-migration env).
export async function listPublishedReports(callerTier: Tier, limit = 50): Promise<ReportSummary[]> {
  const callerRank = priorityRank(callerTier)
  try {
    const rows = await query<DbRow>(
      `SELECT id, slug, title, summary, sector_tag, min_tier, published_at, updated_at
       FROM reports
       WHERE published_at IS NOT NULL
       ORDER BY published_at DESC
       LIMIT $1`,
      [limit],
    )
    // Tier filter is done in app code rather than SQL so the caller
    // sees ALL titles (even those they can't unlock) — they just see
    // the lock state separately. Filter here only to drop reports
    // strictly above the caller's reach when we want to hide them
    // entirely. For now: return all, let the page render the lock UI.
    void callerRank
    return rows.map(r => ({
      id:           r.id,
      slug:         r.slug,
      title:        r.title,
      summary:      r.summary,
      sector_tag:   r.sector_tag,
      min_tier:     r.min_tier,
      published_at: toIso(r.published_at),
      updated_at:   toIsoNonNull(r.updated_at),
    }))
  } catch {
    return []
  }
}

// Fetch a single published report by slug. Returns null if missing,
// or if the caller's tier is below min_tier (treat as "no such
// resource" — the user can see the title in the list with a lock).
export async function getReportForReader(slug: string, callerTier: Tier): Promise<ReportFull | null> {
  let row: DbRow | null = null
  try {
    row = await queryOne<DbRow>(
      `SELECT id, slug, title, summary, sector_tag, min_tier, body, body_html,
              published_at, updated_at
       FROM reports
       WHERE slug = $1 AND published_at IS NOT NULL`,
      [slug],
    )
  } catch {
    return null
  }
  if (!row) return null
  if (priorityRank(callerTier) > priorityRank(row.min_tier)) {
    return null
  }
  return {
    id:           row.id,
    slug:         row.slug,
    title:        row.title,
    summary:      row.summary,
    sector_tag:   row.sector_tag,
    min_tier:     row.min_tier,
    body:         row.body ?? '',
    body_html:    row.body_html ?? null,
    published_at: toIso(row.published_at),
    updated_at:   toIsoNonNull(row.updated_at),
  }
}

// True if a caller on `callerTier` can read a report gated to `reportMinTier`.
// Used by the list view to decide whether to render a lock icon.
export function callerCanRead(callerTier: Tier, reportMinTier: ReportMinTier): boolean {
  return priorityRank(callerTier) <= priorityRank(reportMinTier)
}
