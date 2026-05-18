import { query, queryOne } from '@/lib/db'

// Phase 7B helpers — Layer 2 (concierge) data access. Built for the
// "experienced" endorsement model (decided 2026-05-18); the underlying
// schema is designed-for-visibility-readiness per
// project_equitaselite_visible_endorsement_plan.md.

export type VouchStrength = 'know' | 'worked_with' | 'would_invest'
export type Visibility    = 'private' | 'member_visible' | 'public'

export interface ConciergeAnnotation {
  id:              string
  concierge_id:    string
  counterparty_id: string
  note:            string
  vouch_strength:  VouchStrength | null
  visibility:      Visibility
  created_at:      string | Date
  updated_at:      string | Date
}

// ── Annotations ─────────────────────────────────────────────────────────

export async function listAnnotationsForConcierge(
  conciergeId: string,
  limit: number = 200,
): Promise<ConciergeAnnotation[]> {
  return query<ConciergeAnnotation>(
    `SELECT id, concierge_id, counterparty_id, note, vouch_strength,
            visibility, created_at, updated_at
     FROM concierge_annotations
     WHERE concierge_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [conciergeId, limit],
  )
}

export async function getAnnotationForCounterparty(
  conciergeId:    string,
  counterpartyId: string,
): Promise<ConciergeAnnotation | null> {
  return queryOne<ConciergeAnnotation>(
    `SELECT id, concierge_id, counterparty_id, note, vouch_strength,
            visibility, created_at, updated_at
     FROM concierge_annotations
     WHERE concierge_id = $1 AND counterparty_id = $2`,
    [conciergeId, counterpartyId],
  )
}

export interface UpsertAnnotationInput {
  concierge_id:    string
  counterparty_id: string
  note:            string
  vouch_strength?: VouchStrength | null
  // Visibility is intentionally NOT settable on upsert at v1 — the
  // experienced model keeps everything 'private'. When/if we flip to
  // visible, add a setVisibility() helper rather than threading it
  // through the CRUD path (per the flip-day plan).
}

export async function upsertAnnotation(input: UpsertAnnotationInput): Promise<ConciergeAnnotation | null> {
  return queryOne<ConciergeAnnotation>(
    `INSERT INTO concierge_annotations
       (concierge_id, counterparty_id, note, vouch_strength)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (concierge_id, counterparty_id) DO UPDATE
       SET note = EXCLUDED.note,
           vouch_strength = EXCLUDED.vouch_strength
     RETURNING id, concierge_id, counterparty_id, note, vouch_strength,
               visibility, created_at, updated_at`,
    [
      input.concierge_id,
      input.counterparty_id,
      input.note,
      input.vouch_strength ?? null,
    ],
  )
}

export async function deleteAnnotation(id: string, conciergeId: string): Promise<boolean> {
  // Scoped delete: only the annotation's owner-concierge can delete it.
  // Admins acting on behalf of a concierge should use a separate flow.
  const result = await queryOne<{ id: string }>(
    `DELETE FROM concierge_annotations
     WHERE id = $1 AND concierge_id = $2
     RETURNING id`,
    [id, conciergeId],
  )
  return !!result
}

// ── Audit log ───────────────────────────────────────────────────────────

export interface LogConciergeActionInput {
  concierge_id:  string
  action:        string
  subject_type?: string
  subject_id?:   string
  payload?:      Record<string, unknown>
}

export async function logConciergeAction(input: LogConciergeActionInput): Promise<void> {
  await query(
    `INSERT INTO concierge_audit_log
       (concierge_id, action, subject_type, subject_id, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.concierge_id,
      input.action,
      input.subject_type ?? null,
      input.subject_id   ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  )
}

export interface AuditLogEntry {
  id:           string
  concierge_id: string | null
  action:       string
  subject_type: string | null
  subject_id:   string | null
  payload:      Record<string, unknown>
  created_at:   string | Date
}

export async function recentConciergeActions(
  conciergeId: string,
  limit: number = 50,
): Promise<AuditLogEntry[]> {
  return query<AuditLogEntry>(
    `SELECT id, concierge_id, action, subject_type, subject_id, payload, created_at
     FROM concierge_audit_log
     WHERE concierge_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conciergeId, limit],
  )
}
