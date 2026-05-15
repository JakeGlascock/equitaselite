import { query, queryOne } from '@/lib/db'

export interface TierCounts {
  total:     number
  sovereign: number
  select:    number
  access:    number
  unset:     number
}

export interface IntroFunnel {
  total:    number
  pending:  number
  accepted: number
  declined: number
  acceptance_rate: number  // 0..1, computed from accepted / (accepted + declined)
}

export interface SectorRow {
  sector:  string
  members: number
}

export interface RoleSplit {
  angel:         number
  family_office: number
}

export interface DensityCell {
  sector: string
  stage:  string
  count:  number
}

export interface RecentSignups {
  last_7d:  number
  last_30d: number
}

const REAL_USER_FILTER = "id NOT LIKE 'demo_%' AND id NOT LIKE 'managed_%' AND onboarding_completed = TRUE"

// All queries default to [] / zero on table-missing (pre-migration env)
// so the dashboard renders cleanly even before the first member onboards.

export async function getTierCounts(): Promise<TierCounts> {
  try {
    const row = await queryOne<{
      total:     string
      sovereign: string
      select:    string
      access:    string
      unset:     string
    }>(
      `SELECT
         COUNT(*)::text                                                       AS total,
         COUNT(*) FILTER (WHERE membership = 'sovereign')::text               AS sovereign,
         COUNT(*) FILTER (WHERE membership = 'select')::text                  AS select,
         COUNT(*) FILTER (WHERE membership = 'access')::text                  AS access,
         COUNT(*) FILTER (WHERE membership IS NULL)::text                     AS unset
       FROM profiles
       WHERE ${REAL_USER_FILTER}`,
    )
    return {
      total:     Number(row?.total     ?? 0),
      sovereign: Number(row?.sovereign ?? 0),
      select:    Number(row?.select    ?? 0),
      access:    Number(row?.access    ?? 0),
      unset:     Number(row?.unset     ?? 0),
    }
  } catch {
    return { total: 0, sovereign: 0, select: 0, access: 0, unset: 0 }
  }
}

export async function getRoleSplit(): Promise<RoleSplit> {
  try {
    const row = await queryOne<{ angel: string; family_office: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'angel')::text         AS angel,
         COUNT(*) FILTER (WHERE role = 'family_office')::text AS family_office
       FROM profiles
       WHERE ${REAL_USER_FILTER}`,
    )
    return {
      angel:         Number(row?.angel ?? 0),
      family_office: Number(row?.family_office ?? 0),
    }
  } catch {
    return { angel: 0, family_office: 0 }
  }
}

export async function getIntroFunnel(): Promise<IntroFunnel> {
  try {
    const row = await queryOne<{
      total:    string
      pending:  string
      accepted: string
      declined: string
    }>(
      `SELECT
         COUNT(*)::text                                       AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::text     AS pending,
         COUNT(*) FILTER (WHERE status = 'accepted')::text    AS accepted,
         COUNT(*) FILTER (WHERE status = 'declined')::text    AS declined
       FROM introductions`,
    )
    const accepted = Number(row?.accepted ?? 0)
    const declined = Number(row?.declined ?? 0)
    const responded = accepted + declined
    return {
      total:           Number(row?.total ?? 0),
      pending:         Number(row?.pending ?? 0),
      accepted,
      declined,
      acceptance_rate: responded === 0 ? 0 : accepted / responded,
    }
  } catch {
    return { total: 0, pending: 0, accepted: 0, declined: 0, acceptance_rate: 0 }
  }
}

export async function getSectorBreakdown(limit = 12): Promise<SectorRow[]> {
  try {
    return await query<SectorRow>(
      `SELECT sector, COUNT(DISTINCT p.id)::int AS members
       FROM profiles p, UNNEST(p.sectors) AS sector
       WHERE ${REAL_USER_FILTER.replace(/\bid\b/g, 'p.id')
                                .replace('onboarding_completed', 'p.onboarding_completed')}
       GROUP BY sector
       ORDER BY members DESC, sector ASC
       LIMIT $1`,
      [limit],
    )
  } catch {
    return []
  }
}

export async function getMandateDensity(): Promise<DensityCell[]> {
  try {
    return await query<DensityCell>(
      `SELECT sector, stage, COUNT(DISTINCT p.id)::int AS count
       FROM profiles p,
            UNNEST(p.sectors) AS sector,
            UNNEST(p.stages)  AS stage
       WHERE ${REAL_USER_FILTER.replace(/\bid\b/g, 'p.id')
                                .replace('onboarding_completed', 'p.onboarding_completed')}
       GROUP BY sector, stage`,
    )
  } catch {
    return []
  }
}

export async function getRecentSignups(): Promise<RecentSignups> {
  try {
    const row = await queryOne<{ d7: string; d30: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text  AS d7,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS d30
       FROM profiles
       WHERE ${REAL_USER_FILTER}`,
    )
    return {
      last_7d:  Number(row?.d7  ?? 0),
      last_30d: Number(row?.d30 ?? 0),
    }
  } catch {
    return { last_7d: 0, last_30d: 0 }
  }
}
