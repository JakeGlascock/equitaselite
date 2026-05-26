-- Sovereign-only deal flow with per-member invitations.
--
-- Admin or concierge creates a `deals` row (the opportunity) and a
-- `deal_invitations` row for each Sovereign they're inviting (curated
-- by mandate match, not blast). Invited members see the deal on
-- /deals; non-invited Sovereigns (and Access/Select) don't.
--
-- "Express interest" flips invitation status to 'interested' and
-- pings the admin/concierge via the notifications table so they can
-- broker the next step. No money / docs move through this table —
-- it's the introduction layer, not the data room.

CREATE TABLE IF NOT EXISTS deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,                  -- markdown body
  sectors         TEXT[] NOT NULL DEFAULT '{}',
  stages          TEXT[] NOT NULL DEFAULT '{}',   -- Seed / Series A / etc.
  check_size_min  BIGINT,                         -- USD, nullable when not disclosed
  check_size_max  BIGINT,
  geography       TEXT,                           -- "US", "EU", "Global", etc.
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed', 'filled')),
  created_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ                     -- optional sunset
);

-- Hot path: list a user's open invitations, ordered most-recent first.
-- Indexed on the join key so the inner-join scan stays cheap.
CREATE TABLE IF NOT EXISTS deal_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id)    ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'interested', 'declined')),
  UNIQUE (deal_id, user_id)
);

CREATE INDEX IF NOT EXISTS deal_invitations_user_idx
  ON deal_invitations (user_id);

-- Partial index — only open deals get listed in admin/concierge views.
CREATE INDEX IF NOT EXISTS deals_open_recent_idx
  ON deals (created_at DESC) WHERE status = 'open';

-- Extend notifications.type to allow 'deal_invitation' (members getting
-- pinged that they were invited) and 'deal_interest' (admin/concierge
-- being pinged that an invitee opted in).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD  CONSTRAINT notifications_type_check
  CHECK (type IN (
    'intro_requested', 'intro_accepted', 'intro_declined',
    'deal_invitation', 'deal_interest'
  ));
