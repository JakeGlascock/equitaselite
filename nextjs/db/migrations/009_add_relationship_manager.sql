ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS relationship_manager_id TEXT
    REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_relationship_manager_idx
  ON profiles (relationship_manager_id)
  WHERE relationship_manager_id IS NOT NULL;
