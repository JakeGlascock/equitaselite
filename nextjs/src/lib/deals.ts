import { query, queryOne } from './db'

// Sovereign deal-flow data access.
//
// Shape mirrors lib/reports.ts: thin pg query wrappers, typed at the
// boundary, no business logic baked in. Tier gating + permission
// checks live in the route handlers (admin only writes; only invited
// members read their own invitations).

export type DealStatus           = 'open' | 'closed' | 'filled'
export type InvitationStatus     = 'pending' | 'interested' | 'declined'

export interface Deal {
  id:              string
  title:           string
  description:     string
  sectors:         string[]
  stages:          string[]
  check_size_min:  number | null
  check_size_max:  number | null
  geography:       string | null
  status:          DealStatus
  created_by:      string | null
  created_at:      string
  updated_at:      string
  expires_at:      string | null
}

export interface DealInvitation {
  id:           string
  deal_id:      string
  user_id:      string
  invited_at:   string
  responded_at: string | null
  status:       InvitationStatus
}

export interface InvitationWithDeal extends DealInvitation {
  deal: Deal
}

// ─── Admin / concierge writes ─────────────────────────────────────

export interface CreateDealInput {
  title:           string
  description:     string
  sectors?:        string[]
  stages?:         string[]
  check_size_min?: number | null
  check_size_max?: number | null
  geography?:      string | null
  expires_at?:     string | null
  created_by:      string
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const row = await queryOne<Deal>(
    `INSERT INTO deals (title, description, sectors, stages,
                        check_size_min, check_size_max, geography,
                        expires_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
    [
      input.title,
      input.description,
      input.sectors  ?? [],
      input.stages   ?? [],
      input.check_size_min ?? null,
      input.check_size_max ?? null,
      input.geography ?? null,
      input.expires_at ?? null,
      input.created_by,
    ],
  )
  if (!row) throw new Error('createDeal returned no row')
  return row
}

export async function updateDealStatus(id: string, status: DealStatus): Promise<void> {
  await query(
    `UPDATE deals SET status = $2, updated_at = NOW() WHERE id = $1`,
    [id, status],
  )
}

export async function listAllDeals(): Promise<Deal[]> {
  return query<Deal>(`SELECT * FROM deals ORDER BY created_at DESC`)
}

export async function getDeal(id: string): Promise<Deal | null> {
  return queryOne<Deal>(`SELECT * FROM deals WHERE id = $1`, [id])
}

// ─── Invitations ──────────────────────────────────────────────────

export async function inviteToDeal(dealId: string, userIds: string[]): Promise<DealInvitation[]> {
  if (userIds.length === 0) return []
  // ON CONFLICT keeps re-invites idempotent — admin can safely paste
  // the same id list twice without double-rows.
  const rows = await query<DealInvitation>(
    `INSERT INTO deal_invitations (deal_id, user_id)
          SELECT $1, unnest($2::text[])
     ON CONFLICT (deal_id, user_id) DO NOTHING
       RETURNING *`,
    [dealId, userIds],
  )
  return rows
}

export async function listInvitationsForDeal(dealId: string): Promise<DealInvitation[]> {
  return query<DealInvitation>(
    `SELECT * FROM deal_invitations WHERE deal_id = $1 ORDER BY invited_at DESC`,
    [dealId],
  )
}

export async function listInvitationsForUser(userId: string): Promise<InvitationWithDeal[]> {
  return query<InvitationWithDeal>(
    `SELECT i.id, i.deal_id, i.user_id, i.invited_at, i.responded_at, i.status,
            jsonb_build_object(
              'id',             d.id,
              'title',          d.title,
              'description',    d.description,
              'sectors',        d.sectors,
              'stages',         d.stages,
              'check_size_min', d.check_size_min,
              'check_size_max', d.check_size_max,
              'geography',      d.geography,
              'status',         d.status,
              'created_by',     d.created_by,
              'created_at',     d.created_at,
              'updated_at',     d.updated_at,
              'expires_at',     d.expires_at
            ) AS deal
       FROM deal_invitations i
       JOIN deals d ON d.id = i.deal_id
      WHERE i.user_id = $1
        AND d.status = 'open'
      ORDER BY i.invited_at DESC`,
    [userId],
  )
}

export async function respondToInvitation(
  invitationId: string,
  userId:       string,
  status:       Exclude<InvitationStatus, 'pending'>,
): Promise<DealInvitation | null> {
  // user_id in WHERE is the load-bearing scoping — stops a stolen
  // session attacker from responding for someone else.
  return queryOne<DealInvitation>(
    `UPDATE deal_invitations
        SET status       = $3,
            responded_at = NOW()
      WHERE id       = $1
        AND user_id  = $2
        AND status   = 'pending'
       RETURNING *`,
    [invitationId, userId, status],
  )
}

export async function getInvitation(invitationId: string): Promise<DealInvitation | null> {
  return queryOne<DealInvitation>(`SELECT * FROM deal_invitations WHERE id = $1`, [invitationId])
}
