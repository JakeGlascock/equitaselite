ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS membership TEXT
    CHECK (membership IN ('access','select','sovereign'));

CREATE INDEX IF NOT EXISTS profiles_membership_idx
  ON profiles (membership) WHERE membership IS NOT NULL;
