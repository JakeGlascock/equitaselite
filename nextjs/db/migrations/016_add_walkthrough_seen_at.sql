-- Tracks whether the user has completed (or skipped) the first-login
-- walkthrough. NULL = tour pending (driver fires on next /dashboard
-- visit). Stamped to NOW() when the user finishes or skips, or back
-- to NULL when they hit "Show the tour again" on /profile.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS walkthrough_seen_at TIMESTAMPTZ;

-- Backfill: anyone already onboarded at migration time is assumed to
-- know the product. Stamp them now so the tour doesn't ambush them on
-- their next visit. Only new invitees (and current Onboarding-status
-- rows whose onboarding_completed is still FALSE) will see the tour
-- on first post-onboarding visit.
UPDATE profiles
SET walkthrough_seen_at = NOW()
WHERE walkthrough_seen_at IS NULL
  AND onboarding_completed = TRUE;
