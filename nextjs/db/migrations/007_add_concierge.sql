ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_concierge BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS managed_by   TEXT REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_is_concierge_idx ON profiles (is_concierge) WHERE is_concierge = TRUE;
CREATE INDEX IF NOT EXISTS profiles_managed_by_idx   ON profiles (managed_by) WHERE managed_by IS NOT NULL;
