-- Off-Market mode (Sovereign-only feature).
--
-- An off-market profile is invisible to other members on the directory,
-- match results, and profile detail pages. They remain visible to:
--   - themselves
--   - their assigned RM (relationship_manager_id)
--   - admins (operational necessity)
--   - confirmed connections (anyone with a status = 'accepted' intro on
--     either side)
--
-- Reveal model: an off-market user initiates an outward intro. That
-- act reveals their identity to the recipient (so the recipient can
-- decide whether to accept). On acceptance, the two become connected
-- and the off-market user is permanently visible to that party.
--
-- Downgrade behaviour: when a Sovereign drops tier while off-market,
-- off_market_grace_until is set to NOW() + 7 days. After that grace
-- window expires, is_off_market flips back to FALSE on next lazy load.
-- See lib/membership.ts (Phase 5).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_off_market          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS off_market_grace_until TIMESTAMPTZ;

-- Partial index — only off-market rows are interesting for filtering.
CREATE INDEX IF NOT EXISTS profiles_is_off_market_idx
  ON profiles (is_off_market) WHERE is_off_market = TRUE;
