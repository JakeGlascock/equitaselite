-- Optional bio shown on /concierge for the default concierge contact
-- (and any future concierge with a bio filled in). Kept in the DB
-- rather than hardcoded in source so the concierge can edit it via
-- the admin/profile flow without a redeploy, and so we don't pin a
-- specific person's name into git history.
--
-- Seed Chelsea Toler's bio here because she's the active concierge
-- at time of writing — the UPDATE is a no-op if her row isn't
-- present yet (e.g. on a fresh dev DB), so the migration is safe
-- regardless of environment state.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

UPDATE profiles
SET bio = 'Co-CEO and Co-Founder of Logictry, where she leads the global rollout of Logic Centers — curated communities for family offices, next-generation inheritors, and impact investors. President of the Keep Families Giving Foundation. Doctoral Merit Fellow at Texas State University researching next-generation family office education. Advisory boards include the Family Office Association, NEXUS, UN SDSN Youth, and the Southwestern Angel Network.'
WHERE LOWER(email) = 'chelsea@equitaselite.com'
  AND is_concierge = TRUE
  AND (bio IS NULL OR bio = '');
