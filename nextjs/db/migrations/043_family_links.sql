-- P5 v1: parent ↔ next-gen seat link.
--
-- BoA 2025: 62% of FOs name next-gen prep as top concern. EE
-- already has Next-Gen as a peer role (migration 035) — this
-- adds the link from a Next-Gen profile back to the wealth-
-- holding parent (FO / Family Foundation / DAF). The "shadow
-- view" UX where the next-gen reads the parent's surfaces is
-- deferred to P5b; this migration is the data foundation only.
--
-- Why a column on profiles (not a join table):
--   - One next-gen has at most one parent seat. The "many parents
--     per next-gen" case (e.g. dual-family child) is rare enough
--     that we'd rather model it explicitly later than carry the
--     complexity now.
--   - A parent can have multiple next-gen seats — captured by
--     querying "WHERE parent_profile_id = $1".
--
-- ON DELETE SET NULL: deleting the parent doesn't cascade-delete
-- the next-gen's own profile. The next-gen stays but loses their
-- shadow link.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS parent_profile_id TEXT
    REFERENCES profiles(id) ON DELETE SET NULL;

-- Anti-cycle guard: a profile can't be its own parent. CHECK
-- constraints can't reference other rows, but self-reference is
-- enforceable at insert/update time.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_no_self_parent;
ALTER TABLE profiles
  ADD  CONSTRAINT profiles_no_self_parent
    CHECK (parent_profile_id IS NULL OR parent_profile_id <> id);

-- Hot path: "list every next-gen seat linked to me" on /profile.
CREATE INDEX IF NOT EXISTS profiles_parent_idx
  ON profiles (parent_profile_id)
  WHERE parent_profile_id IS NOT NULL;
