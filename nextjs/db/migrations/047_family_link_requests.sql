-- P5f — cross-account family-link consent flow.
--
-- Today /api/me/next-gen-invite hard-409s when the invited email
-- already has a profile (P5c chose to defer cross-account linking
-- to its own phase). P5f adds the consent surface: the parent's
-- invite becomes a "link request" the existing user can accept or
-- decline from their own /profile.
--
-- Model:
--   - One row per (requester, target) pending request, enforced by
--     the partial unique index below — re-clicking Invite is a no-op
--     while the request is pending.
--   - Status machine: pending → {accepted, declined, cancelled}.
--     Cascading from a deleted profile (either side) collapses the
--     row entirely rather than leaving an orphan — we don't need
--     historical record-keeping for unaccepted requests.
--   - 14-day default expiry mirrors the preview/deck-token cadence.
--     We don't enforce it server-side in v1 (the target sees the
--     request until they act on it); a future cron could prune.
--   - requester_id <> target_id is a CHECK, mirroring the same
--     anti-self-link invariant the profiles table already has on
--     parent_profile_id.

CREATE TABLE IF NOT EXISTS family_link_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  CHECK (requester_id <> target_id)
);

-- Hot path: target's pending inbox for the /profile incoming panel.
CREATE INDEX IF NOT EXISTS family_link_requests_target_idx
  ON family_link_requests (target_id, status, created_at DESC);

-- Outgoing requests for the requester's "pending invitation" badge.
CREATE INDEX IF NOT EXISTS family_link_requests_requester_idx
  ON family_link_requests (requester_id, status, created_at DESC);

-- One pending request at a time per (requester, target) pair. The
-- WHERE clause is what makes it a partial unique — accepted and
-- declined rows are historical and can coexist with a new pending.
CREATE UNIQUE INDEX IF NOT EXISTS family_link_requests_no_dup_pending_idx
  ON family_link_requests (requester_id, target_id)
  WHERE status = 'pending';

-- Notification type extension. Three new types:
--   - family_link_request:  target's bell when a parent invites them
--   - family_link_accepted: requester's bell when target accepts
--   - family_link_declined: requester's bell when target declines
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD  CONSTRAINT notifications_type_check
  CHECK (type IN (
    'intro_requested', 'intro_accepted', 'intro_declined',
    'deal_invitation', 'deal_interest',
    'deal_message',
    'next_gen_shadow',
    'next_gen_action',
    'family_link_request', 'family_link_accepted', 'family_link_declined'
  ));
