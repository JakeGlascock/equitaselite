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
  // P3 — concierge note attached to the deal. Visible only to invited
  // Sovereigns on the member /deals page; rendered as a visually
  // distinct block to preserve the two-trust-layers separation.
  concierge_note:            string | null
  concierge_note_author_id:  string | null
  concierge_note_updated_at: string | null
}

export interface DealInvitation {
  id:           string
  deal_id:      string
  user_id:      string
  invited_at:   string
  responded_at: string | null
  status:       InvitationStatus
}

/** Joined shape used on the member-side /deals page so the UI can
 *  attribute the concierge note ("Note from {full_name}"). */
export interface InvitationWithDeal extends DealInvitation {
  deal: Deal & {
    concierge_note_author_name: string | null
  }
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
  /** P3 — optional concierge note set at creation time. */
  concierge_note?: string | null
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const note = (input.concierge_note ?? '').trim()
  const row = await queryOne<Deal>(
    `INSERT INTO deals (title, description, sectors, stages,
                        check_size_min, check_size_max, geography,
                        expires_at, created_by,
                        concierge_note, concierge_note_author_id, concierge_note_updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12)
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
      note ? note             : null,
      note ? input.created_by : null,
      note ? new Date()       : null,
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

/** P3 — set or clear the concierge note on a deal. Author is the
 *  caller (admin or concierge). Empty/whitespace strings clear all
 *  three concierge-note columns so the member side renders nothing. */
export async function updateDealConciergeNote(
  dealId:   string,
  note:     string | null,
  authorId: string,
): Promise<void> {
  const trimmed = (note ?? '').trim()
  if (trimmed) {
    await query(
      `UPDATE deals
          SET concierge_note            = $2,
              concierge_note_author_id  = $3,
              concierge_note_updated_at = NOW(),
              updated_at                = NOW()
        WHERE id = $1`,
      [dealId, trimmed, authorId],
    )
  } else {
    await query(
      `UPDATE deals
          SET concierge_note            = NULL,
              concierge_note_author_id  = NULL,
              concierge_note_updated_at = NULL,
              updated_at                = NOW()
        WHERE id = $1`,
      [dealId],
    )
  }
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
  // LEFT JOIN to profiles so the concierge note can be attributed by
  // name on the member side ("Note from Alice"). Falls back to a
  // generic "the concierge" if the author was deleted or unjoined.
  return query<InvitationWithDeal>(
    `SELECT i.id, i.deal_id, i.user_id, i.invited_at, i.responded_at, i.status,
            jsonb_build_object(
              'id',                         d.id,
              'title',                      d.title,
              'description',                d.description,
              'sectors',                    d.sectors,
              'stages',                     d.stages,
              'check_size_min',             d.check_size_min,
              'check_size_max',             d.check_size_max,
              'geography',                  d.geography,
              'status',                     d.status,
              'created_by',                 d.created_by,
              'created_at',                 d.created_at,
              'updated_at',                 d.updated_at,
              'expires_at',                 d.expires_at,
              'concierge_note',             d.concierge_note,
              'concierge_note_author_id',   d.concierge_note_author_id,
              'concierge_note_updated_at',  d.concierge_note_updated_at,
              'concierge_note_author_name', author.full_name
            ) AS deal
       FROM deal_invitations i
       JOIN deals d ON d.id = i.deal_id
       LEFT JOIN profiles author ON author.id = d.concierge_note_author_id
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

/** P4 — is this caller permitted to read/post in this deal's room?
 *  Returns true iff they have an invitation to the deal OR they
 *  authored it. Used by the messages routes for the auth gate. */
export async function isMemberOfDealRoom(dealId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM deal_invitations WHERE deal_id = $1 AND user_id = $2
       UNION
       SELECT 1 FROM deals             WHERE id      = $1 AND created_by = $2
     ) AS ok`,
    [dealId, userId],
  ).catch(() => null)
  return !!row?.ok
}

// ─── Deal messages (P4) ───────────────────────────────────────────

export interface DealMessage {
  id:                   string
  deal_id:              string
  user_id:              string
  /** Joined author name + firm, so the UI can render without an extra fetch. */
  user_name:            string | null
  user_firm:            string | null
  body:                 string
  pinned_by_concierge:  boolean
  removed_at:           string | null
  created_at:           string
  /** P5e — null for regular messages; set when a next-gen posted while
   *  shadowing this parent seat. UI renders "(on behalf of <firm>)". */
  shadowed_parent_id:   string | null
  shadowed_parent_firm: string | null
}

export async function postDealMessage(
  dealId:              string,
  userId:              string,
  body:                string,
  shadowedParentId?:   string | null,
): Promise<DealMessage> {
  // Re-fetch with the profile JOINs (author + optional shadowed parent)
  // so the response includes everything the UI needs in one round trip.
  // Pre-046 fallback: if the shadowed_parent_id column doesn't exist
  // yet, retry with the original INSERT shape so the route keeps
  // working on older schemas — shadow attribution is then just absent.
  try {
    const row = await queryOne<DealMessage>(
      `WITH ins AS (
         INSERT INTO deal_messages (deal_id, user_id, body, shadowed_parent_id)
              VALUES ($1, $2, $3, $4)
           RETURNING *
       )
       SELECT ins.*,
              p.full_name AS user_name,
              p.firm_name AS user_firm,
              sp.firm_name AS shadowed_parent_firm
         FROM ins
         LEFT JOIN profiles p  ON p.id  = ins.user_id
         LEFT JOIN profiles sp ON sp.id = ins.shadowed_parent_id`,
      [dealId, userId, body, shadowedParentId ?? null],
    )
    if (!row) throw new Error('postDealMessage returned no row')
    return row
  } catch {
    const row = await queryOne<DealMessage>(
      `WITH ins AS (
         INSERT INTO deal_messages (deal_id, user_id, body)
              VALUES ($1, $2, $3)
           RETURNING *
       )
       SELECT ins.*,
              p.full_name AS user_name,
              p.firm_name AS user_firm,
              NULL::text  AS shadowed_parent_firm
         FROM ins LEFT JOIN profiles p ON p.id = ins.user_id`,
      [dealId, userId, body],
    )
    if (!row) throw new Error('postDealMessage returned no row')
    return row
  }
}

export async function listDealMessages(dealId: string): Promise<DealMessage[]> {
  try {
    return await query<DealMessage>(
      `SELECT m.id, m.deal_id, m.user_id, m.body,
              m.pinned_by_concierge, m.removed_at, m.created_at,
              m.shadowed_parent_id,
              p.full_name  AS user_name,
              p.firm_name  AS user_firm,
              sp.firm_name AS shadowed_parent_firm
         FROM deal_messages m
         LEFT JOIN profiles p  ON p.id  = m.user_id
         LEFT JOIN profiles sp ON sp.id = m.shadowed_parent_id
        WHERE m.deal_id    = $1
          AND m.removed_at IS NULL
        ORDER BY m.pinned_by_concierge DESC, m.created_at ASC`,
      [dealId],
    )
  } catch {
    // Pre-046 fallback. No shadow_parent column; map it to null.
    return query<DealMessage>(
      `SELECT m.id, m.deal_id, m.user_id, m.body,
              m.pinned_by_concierge, m.removed_at, m.created_at,
              NULL::text AS shadowed_parent_id,
              p.full_name AS user_name,
              p.firm_name AS user_firm,
              NULL::text  AS shadowed_parent_firm
         FROM deal_messages m
         LEFT JOIN profiles p ON p.id = m.user_id
        WHERE m.deal_id    = $1
          AND m.removed_at IS NULL
        ORDER BY m.pinned_by_concierge DESC, m.created_at ASC`,
      [dealId],
    )
  }
}

export async function getDealMessage(messageId: string): Promise<DealMessage | null> {
  return queryOne<DealMessage>(
    `SELECT m.id, m.deal_id, m.user_id, m.body,
            m.pinned_by_concierge, m.removed_at, m.created_at,
            p.full_name AS user_name, p.firm_name AS user_firm
       FROM deal_messages m
       LEFT JOIN profiles p ON p.id = m.user_id
      WHERE m.id = $1`,
    [messageId],
  )
}

export async function setDealMessagePinned(
  messageId: string,
  pinned:    boolean,
): Promise<void> {
  await query(
    `UPDATE deal_messages SET pinned_by_concierge = $2 WHERE id = $1`,
    [messageId, pinned],
  )
}

export async function removeDealMessage(
  messageId: string,
  removedBy: string,
): Promise<void> {
  await query(
    `UPDATE deal_messages
        SET removed_at = NOW(),
            removed_by = $2
      WHERE id = $1
        AND removed_at IS NULL`,
    [messageId, removedBy],
  )
}

/** Invited members of a deal room — for fan-out notifications when
 *  a new message lands. Excludes the poster (handled at call site). */
export async function listDealRoomUserIds(dealId: string): Promise<string[]> {
  const rows = await query<{ user_id: string }>(
    `SELECT user_id FROM deal_invitations WHERE deal_id = $1
       UNION
     SELECT created_by AS user_id FROM deals WHERE id = $1 AND created_by IS NOT NULL`,
    [dealId],
  ).catch(() => [])
  return rows.map(r => r.user_id)
}
