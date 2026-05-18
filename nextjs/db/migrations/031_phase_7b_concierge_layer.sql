-- Phase 7B foundation — Layer 2 (concierge) data substrate.
--
-- Three additions, all designed for the *experienced* concierge
-- endorsement model decided 2026-05-18:
--
--   1. introductions.origin — distinguishes algorithm-driven intros
--      from concierge-brokered ones. Defaulted 'algorithm' so existing
--      rows + the default INSERT path stay correct without backfill.
--
--   2. concierge_annotations — Chelsea's private notes on counterparties.
--      The `visibility` column is the visibility-readiness lever: stays
--      'private' under the experienced model; flipping to 'member_visible'
--      later (per project_equitaselite_visible_endorsement_plan.md) is a
--      one-column UPDATE rather than a schema migration.
--
--   3. concierge_audit_log — append-only log of concierge actions. Becomes
--      the source data if we ever want "Chelsea has worked with N firms
--      in your sector" track-record displays.

-- 1. Origin column on introductions ───────────────────────────────────────
ALTER TABLE introductions
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'algorithm'
    CHECK (origin IN ('algorithm', 'concierge'));

CREATE INDEX IF NOT EXISTS introductions_origin_idx ON introductions (origin);

-- 2. Concierge annotations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concierge_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concierge_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  counterparty_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note            TEXT NOT NULL,
  -- vouch_strength is OPTIONAL — Chelsea may want to take a note ("met at
  -- SXSW, follow up next quarter") without committing to a vouch level.
  vouch_strength  TEXT CHECK (vouch_strength IS NULL OR
                              vouch_strength IN ('know','worked_with','would_invest')),
  -- The visibility lever. Stays 'private' under the experienced model —
  -- only concierge + admins read it. Flipping to 'member_visible' or
  -- 'public' surfaces the annotation in the member UI. See
  -- project_equitaselite_visible_endorsement_plan.md for the flip-day work.
  visibility      TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','member_visible','public')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT      no_self_annotation CHECK (concierge_id != counterparty_id),
  CONSTRAINT      unique_concierge_counterparty UNIQUE (concierge_id, counterparty_id)
);

CREATE INDEX IF NOT EXISTS concierge_annotations_counterparty_idx
  ON concierge_annotations (counterparty_id);
CREATE INDEX IF NOT EXISTS concierge_annotations_concierge_idx
  ON concierge_annotations (concierge_id);
CREATE INDEX IF NOT EXISTS concierge_annotations_visibility_idx
  ON concierge_annotations (visibility) WHERE visibility != 'private';

-- Reuse the existing set_updated_at trigger function (defined in
-- migration 001 alongside profiles).
DROP TRIGGER IF EXISTS concierge_annotations_updated_at ON concierge_annotations;
CREATE TRIGGER concierge_annotations_updated_at
  BEFORE UPDATE ON concierge_annotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Concierge audit log ──────────────────────────────────────────────────
-- Append-only log of every concierge action — intros brokered, annotations
-- updated, members prioritized, etc. Schema is intentionally loose
-- (JSONB payload) so new action types don't require migrations.
CREATE TABLE IF NOT EXISTS concierge_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concierge_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  -- subject_type + subject_id let us point at any row in the system
  -- (profile, introduction, annotation, etc.) without a polymorphic FK.
  subject_type    TEXT,
  subject_id      TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_audit_log_concierge_idx
  ON concierge_audit_log (concierge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS concierge_audit_log_subject_idx
  ON concierge_audit_log (subject_type, subject_id)
  WHERE subject_type IS NOT NULL;
