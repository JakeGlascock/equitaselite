-- Multi-role identity + per-role mandates.
--
-- Two shifts in this migration:
--
-- 1) IDENTITY: a profile can now hold any combination of (Angel,
--    Family Office, Concierge). Today's `role` column is a single-
--    valued CHECK constraint, forcing exclusivity between Angel and FO.
--    Concierges were already orthogonal (is_concierge boolean), but a
--    concierge couldn't exist without ALSO being Angel or FO because
--    role NOT NULL.
--
--    Adds is_angel + is_family_office flags, backfilled from role.
--    Drops NOT NULL on role so a pure-concierge profile is possible.
--    role stays as a denormalized "primary identity" string for now —
--    Phase B/C will phase it out gradually.
--
-- 2) MANDATES: each investor-role identity (Angel and/or FO) needs its
--    own mandate. Chelsea as Angel + FO has two distinct mandates with
--    different check sizes, deal-structure preferences, etc.
--
--    New table mandates(profile_id, role) keyed by both, carrying every
--    mandate field. Backfilled from the existing denormalized columns
--    on profiles for whichever role the profile currently holds.
--
--    The mandate columns stay on profiles as a denormalized cache for
--    now — every existing read path keeps working until Phase C moves
--    reads to the sub-table. Phase D drops them.
--
-- Forward-only; safe to re-run thanks to IF NOT EXISTS / ON CONFLICT.

-- ── 1. Identity flags ─────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_angel         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_family_office BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill from existing role. Existing concierges who also held a role
-- get both flags set; pure-concierge-but-with-role records (none today)
-- would also flip correctly.
UPDATE profiles
   SET is_angel = TRUE
 WHERE role = 'angel' AND is_angel = FALSE;

UPDATE profiles
   SET is_family_office = TRUE
 WHERE role = 'family_office' AND is_family_office = FALSE;

-- Drop NOT NULL on role so concierge-only profiles can exist with
-- role IS NULL. The CHECK constraint on role values stays (it accepts
-- NULL since it's now nullable).
ALTER TABLE profiles
  ALTER COLUMN role DROP NOT NULL;

-- Indices on the new flags so match queries that filter by role can
-- use them.
CREATE INDEX IF NOT EXISTS profiles_is_angel_idx
  ON profiles (is_angel) WHERE is_angel = TRUE;
CREATE INDEX IF NOT EXISTS profiles_is_family_office_idx
  ON profiles (is_family_office) WHERE is_family_office = TRUE;

-- ── 2. mandates sub-table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mandates (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('angel', 'family_office')),

  -- Pillar 1: Strategic scope
  sectors        TEXT[] NOT NULL DEFAULT '{}',
  sub_sectors    TEXT[] NOT NULL DEFAULT '{}',
  anti_sectors   TEXT[] NOT NULL DEFAULT '{}',
  stages         TEXT[] NOT NULL DEFAULT '{}',
  geography      TEXT[] NOT NULL DEFAULT '{}',
  thematic_focus TEXT[] NOT NULL DEFAULT '{}',

  -- Pillar 2: Capital mechanics
  check_size_min        NUMERIC(10,2) NOT NULL DEFAULT 0,
  check_size_max        NUMERIC(10,2) NOT NULL DEFAULT 0,
  check_size_target     NUMERIC,
  deals_per_year        NUMERIC,
  max_concentration_pct NUMERIC
    CHECK (max_concentration_pct IS NULL
        OR (max_concentration_pct >= 0 AND max_concentration_pct <= 100)),
  lead_capacity         TEXT
    CHECK (lead_capacity IS NULL OR lead_capacity IN ('lead','follow','either')),
  co_invest_appetite    TEXT
    CHECK (co_invest_appetite IS NULL OR co_invest_appetite IN ('seeker','open','avoid')),

  -- Pillar 3: Time & risk
  risk_tolerance              TEXT
    CHECK (risk_tolerance IS NULL OR risk_tolerance IN ('Conservative','Moderate','Aggressive')),
  expected_return             TEXT,
  timeline                    TEXT,
  holding_period_target_years NUMERIC,
  loss_appetite               TEXT
    CHECK (loss_appetite IS NULL OR loss_appetite IN ('low','moderate','high')),

  -- Pillar 4: Governance & engagement
  engagement_style       TEXT
    CHECK (engagement_style IS NULL OR engagement_style IN ('board','observer','advisory','passive')),
  diligence_depth        TEXT
    CHECK (diligence_depth IS NULL OR diligence_depth IN ('light','standard','deep')),
  decision_timeline_days NUMERIC,

  -- Pillar 5: Counterparty profile
  preferred_counterparty_types TEXT[] NOT NULL DEFAULT '{}',
  min_counterparty_tier        TEXT
    CHECK (min_counterparty_tier IS NULL OR min_counterparty_tier IN ('access','select','sovereign')),
  min_verification_level       TEXT
    CHECK (min_verification_level IS NULL OR min_verification_level IN ('accredited','qp','kye')),

  -- Pillar 6: Values & alignment
  esg_required      BOOLEAN NOT NULL DEFAULT FALSE,
  impact_themes     TEXT[] NOT NULL DEFAULT '{}',
  values_exclusions TEXT[] NOT NULL DEFAULT '{}',

  -- Top-level mandate fields
  aum            TEXT,
  mandate_type   TEXT,
  concentration  TEXT,

  -- Per-pillar weights for this mandate's view of scores (matches the
  -- shape of profiles.mandate_weights — copied row-by-row at backfill).
  mandate_weights JSONB NOT NULL DEFAULT
    '{"scope":40,"capital":25,"timeRisk":10,"governance":5,"counterparty":10,"values":10}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (profile_id, role)
);

-- Standard updated_at trigger pattern (the function already exists from
-- migration 001).
DROP TRIGGER IF EXISTS mandates_updated_at ON mandates;
CREATE TRIGGER mandates_updated_at
  BEFORE UPDATE ON mandates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS mandates_role_idx ON mandates (role);

-- ── 3. Backfill mandates from current profile rows ────────────────────
-- Insert one mandate row per profile that holds a role today. The
-- ON CONFLICT clause makes this re-runnable.

INSERT INTO mandates (
  profile_id, role,
  sectors, sub_sectors, anti_sectors, stages, geography, thematic_focus,
  check_size_min, check_size_max, check_size_target, deals_per_year,
  max_concentration_pct, lead_capacity, co_invest_appetite,
  risk_tolerance, expected_return, timeline,
  holding_period_target_years, loss_appetite,
  engagement_style, diligence_depth, decision_timeline_days,
  preferred_counterparty_types, min_counterparty_tier, min_verification_level,
  esg_required, impact_themes, values_exclusions,
  aum, mandate_type, concentration,
  mandate_weights
)
SELECT
  id, role,
  sectors, sub_sectors, anti_sectors, stages, geography, thematic_focus,
  check_size_min, check_size_max, check_size_target, deals_per_year,
  max_concentration_pct, lead_capacity, co_invest_appetite,
  risk_tolerance, expected_return, timeline,
  holding_period_target_years, loss_appetite,
  engagement_style, diligence_depth, decision_timeline_days,
  preferred_counterparty_types, min_counterparty_tier, min_verification_level,
  esg_required, impact_themes, values_exclusions,
  aum, mandate_type, concentration,
  mandate_weights
FROM profiles
WHERE role IS NOT NULL
ON CONFLICT (profile_id, role) DO NOTHING;
