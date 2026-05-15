-- One-click unsubscribe token per profile. Embedded in every digest email
-- so recipients can opt out without signing in. UUIDs are unguessable in
-- practice and only carry the opt-out capability (no identity leak —
-- the recipient already knows their own email).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Existing rows got DEFAULT-generated values during the ADD COLUMN. The
-- partial unique index lets us add UNIQUE without a separate UPDATE.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_unsubscribe_token_idx
  ON profiles (unsubscribe_token);
