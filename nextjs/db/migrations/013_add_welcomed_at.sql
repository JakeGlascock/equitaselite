-- Tracks whether a new Select+ / Sovereign signup has been welcomed by
-- the concierge team. NULL = not yet welcomed (shows up in the
-- /concierge onboarding queue). Stamped when a concierge or admin
-- clicks "Mark welcomed" on the queue.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ;

-- Partial index speeds up the "needs welcome" query, which is the
-- only realistic read pattern. Most profiles will have welcomed_at
-- set; the index only stores the NULL rows.
CREATE INDEX IF NOT EXISTS profiles_needs_welcome_idx
  ON profiles (created_at)
  WHERE welcomed_at IS NULL
    AND membership IN ('select','sovereign')
    AND onboarding_completed = TRUE;
