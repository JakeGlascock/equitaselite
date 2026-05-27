-- P4 product phase: peer co-invest rooms.
--
-- Per-deal message thread for invited Sovereigns. PwC 2025 shows
-- club deals = 69% of FO transactions H1 2025; Fidelity says 69%
-- of FOs source ideas from other FOs. This gives them a curated
-- room to discuss a specific deal without leaving EE.
--
-- Permission model:
--   - Read/post: invited Sovereigns + the deal's created_by
--   - Pin/remove: admin OR the deal's created_by (the concierge
--     who set up the room)
-- Both enforced in the route layer; the table itself is open.
--
-- removed_at is a soft-delete marker so admin/concierge can hide
-- a message without losing the audit trail (created_at, body,
-- author all preserved). Read routes filter on removed_at IS NULL.

CREATE TABLE IF NOT EXISTS deal_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id              UUID NOT NULL REFERENCES deals(id)    ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body                 TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  pinned_by_concierge  BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at           TIMESTAMPTZ,
  removed_by           TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: list a deal's visible messages in chronological order.
CREATE INDEX IF NOT EXISTS deal_messages_deal_idx
  ON deal_messages (deal_id, created_at);

-- Pinned-first view (concierge highlights). Partial index keeps it
-- cheap since most rows aren't pinned.
CREATE INDEX IF NOT EXISTS deal_messages_pinned_idx
  ON deal_messages (deal_id, created_at)
  WHERE pinned_by_concierge = TRUE AND removed_at IS NULL;

-- Extend notifications.type to allow 'deal_message' so invited
-- members get an in-app bell when peers post.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD  CONSTRAINT notifications_type_check
  CHECK (type IN (
    'intro_requested', 'intro_accepted', 'intro_declined',
    'deal_invitation', 'deal_interest',
    'deal_message'
  ));
