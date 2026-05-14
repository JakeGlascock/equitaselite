import { queryOne } from '@/lib/db'

export type Tier = 'access' | 'select' | 'sovereign'

export const DEFAULT_TIER: Tier = 'access'

export interface TierLimits {
  // null = unlimited. Match cap is "top N in their dashboard view".
  matchesPerMonth: number | null
  // Intros sent (created) in a rolling 30-day window. 0 = blocked entirely.
  // Number.POSITIVE_INFINITY = unlimited.
  introsPerMonth:  number
  // Lower number = earlier in others' match lists (placement boost).
  priorityRank:    number
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  access:    { matchesPerMonth: 10,   introsPerMonth: 0,                       priorityRank: 2 },
  select:    { matchesPerMonth: null, introsPerMonth: 5,                       priorityRank: 1 },
  sovereign: { matchesPerMonth: null, introsPerMonth: Number.POSITIVE_INFINITY, priorityRank: 0 },
}

export function getLimits(tier: Tier): TierLimits {
  return TIER_LIMITS[tier]
}

// Where does a candidate sit in the placement order? Used by the dashboard
// to bubble higher-tier members up. Null/missing membership sorts last.
export function priorityRank(tier: Tier | null | undefined): number {
  if (!tier) return TIER_LIMITS[DEFAULT_TIER].priorityRank + 1
  return TIER_LIMITS[tier].priorityRank
}

const TIER_VALUES: readonly Tier[] = ['access', 'select', 'sovereign']
export function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (TIER_VALUES as readonly string[]).includes(v)
}

// Resolve a user's tier. Falls back to DEFAULT_TIER if:
//   - the membership column hasn't been initialized yet, OR
//   - the user row's membership is NULL (legacy users predating Phase 0).
export async function getTier(userId: string): Promise<Tier> {
  try {
    const row = await queryOne<{ membership: Tier | null }>(
      'SELECT membership FROM profiles WHERE id = $1',
      [userId]
    )
    if (!row) return DEFAULT_TIER
    return isTier(row.membership) ? row.membership : DEFAULT_TIER
  } catch {
    return DEFAULT_TIER
  }
}

// Count introductions the user has *requested* in the last 30 days. Used to
// enforce introsPerMonth.
export async function getIntroCountLast30Days(userId: string): Promise<number> {
  try {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM introductions
       WHERE requester_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    )
    return Number(row?.count ?? 0)
  } catch {
    return 0
  }
}

export interface IntroQuotaCheck {
  ok:        boolean
  tier:      Tier
  used:      number
  limit:     number  // Infinity for sovereign
  remaining: number  // Infinity for sovereign, 0 if blocked
}

// Single point of truth for "can this user send another intro right now?".
// Caller decides what to do on !ok (reject with 402, show upgrade CTA, etc.).
export async function checkIntroQuota(userId: string): Promise<IntroQuotaCheck> {
  const tier  = await getTier(userId)
  const limit = TIER_LIMITS[tier].introsPerMonth
  const used  = await getIntroCountLast30Days(userId)
  const ok    = used < limit
  const remaining = limit === Number.POSITIVE_INFINITY ? Infinity : Math.max(0, limit - used)
  return { ok, tier, used, limit, remaining }
}
