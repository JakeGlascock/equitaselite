import { query, queryOne } from '@/lib/db'

export interface BriefingSummary {
  id:           string
  title:        string
  summary:      string
  published_at: string | null
  updated_at:   string
}

export interface BriefingFull extends BriefingSummary {
  recipient_user_id: string
  body:              string
  body_html:         string | null
}

interface DbRow {
  id:                string
  recipient_user_id: string
  title:             string
  summary:           string
  body?:             string
  body_html?:        string | null
  published_at:      Date | string | null
  updated_at:        Date | string
}

function toIso(d: Date | string | null): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : d
}

function toIsoNonNull(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : d
}

// Briefings a given Sovereign recipient is allowed to see. Excludes
// drafts (published_at IS NULL). Returns summary rows — bodies stay
// on /briefings/[id]. Empty array if the table isn't migrated yet.
export async function listBriefingsForRecipient(recipientUserId: string, limit = 25): Promise<BriefingSummary[]> {
  try {
    const rows = await query<DbRow>(
      `SELECT id, recipient_user_id, title, summary, published_at, updated_at
       FROM portfolio_reports
       WHERE recipient_user_id = $1 AND published_at IS NOT NULL
       ORDER BY published_at DESC
       LIMIT $2`,
      [recipientUserId, limit],
    )
    return rows.map(r => ({
      id:           r.id,
      title:        r.title,
      summary:      r.summary,
      published_at: toIso(r.published_at),
      updated_at:   toIsoNonNull(r.updated_at),
    }))
  } catch {
    return []
  }
}

// One briefing by id, gated to the recipient (or a staff caller).
// Returns null if missing OR if the caller isn't the recipient AND
// isn't admin/concierge. Caller decides what 404 to render.
export async function getBriefingForReader(
  briefingId: string,
  callerUserId: string,
  callerIsStaff: boolean,
): Promise<BriefingFull | null> {
  let row: DbRow | null = null
  try {
    row = await queryOne<DbRow>(
      `SELECT id, recipient_user_id, title, summary, body, body_html, published_at, updated_at
       FROM portfolio_reports
       WHERE id = $1 AND published_at IS NOT NULL`,
      [briefingId],
    )
  } catch {
    return null
  }
  if (!row) return null
  if (!callerIsStaff && row.recipient_user_id !== callerUserId) return null
  return {
    id:                row.id,
    recipient_user_id: row.recipient_user_id,
    title:             row.title,
    summary:           row.summary,
    body:              row.body ?? '',
    body_html:         row.body_html ?? null,
    published_at:      toIso(row.published_at),
    updated_at:        toIsoNonNull(row.updated_at),
  }
}
