-- Role-types expansion (Phase E1).
--
-- Adds three peer role types alongside the existing Angel + Family
-- Office + Concierge identity flags from migration 034:
--   - is_next_gen          — next-generation member of a wealth lineage
--   - is_family_foundation — 501(c)(3) family foundation, charitable entity
--   - is_daf               — Donor-Advised Fund, sponsor-held charitable acct
--
-- Each is independent. A profile can hold any combination (Chelsea could
-- in principle be Angel + Family Office + Next Gen + Concierge). The
-- match algorithm switches from bipartite Angel ↔ FO to a compatibility
-- matrix (see lib/role-compat.ts) defining who-matches-whom across all
-- five investor-side roles. Concierge has no mandate, no match list.
--
-- Each new investor-side role gets its own mandate row in mandates(profile_id, role).
-- The CHECK constraint is widened to allow the three new role strings.
-- Mandates backfill is intentionally NOT done — no existing profile is
-- Next-Gen / Foundation / DAF until admin or self toggles it. The flag
-- write paths (/api/me, /api/admin/users/[id], /api/onboarding) handle
-- mandates row creation.
--
-- Pre-035 read paths are tolerated via try/catch fallbacks in code —
-- this migration is purely additive.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_next_gen          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_family_foundation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_daf               BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial indices — only TRUE rows are interesting for the role-filter
-- queries the match algorithm runs.
CREATE INDEX IF NOT EXISTS profiles_is_next_gen_idx
  ON profiles (is_next_gen) WHERE is_next_gen = TRUE;
CREATE INDEX IF NOT EXISTS profiles_is_family_foundation_idx
  ON profiles (is_family_foundation) WHERE is_family_foundation = TRUE;
CREATE INDEX IF NOT EXISTS profiles_is_daf_idx
  ON profiles (is_daf) WHERE is_daf = TRUE;

-- Widen mandates.role CHECK to admit the three new role strings.
-- Postgres requires DROP + ADD for CHECK constraint replacement.
ALTER TABLE mandates
  DROP CONSTRAINT IF EXISTS mandates_role_check;

ALTER TABLE mandates
  ADD CONSTRAINT mandates_role_check
    CHECK (role IN ('angel', 'family_office', 'next_gen', 'family_foundation', 'daf'));
