-- P3 product phase: concierge / admin can attach a private read to a
-- specific deal, visible only to the Sovereigns invited to that deal.
--
-- Modeled as two columns on the deals table (not a new table) because:
--   - The note is per-deal, not per-(invitee, deal) — one shared read
--     surfaces to every invited Sovereign for that deal.
--   - Avoids a new join in the hot listInvitationsForUser path.
--   - Matches the existing concierge_annotations philosophy: the
--     concierge author is captured so the UI can attribute the note.
--
-- Two-trust-layers invariant: the rendered note is visually distinct
-- from the deal description and explicitly attributed to the author,
-- so the human-trust signal doesn't blur into the algorithmic-trust
-- deal listing. Permission gating happens in the route handler — the
-- column itself is "data that may or may not be shown."

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS concierge_note            TEXT,
  ADD COLUMN IF NOT EXISTS concierge_note_author_id  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concierge_note_updated_at TIMESTAMPTZ;
