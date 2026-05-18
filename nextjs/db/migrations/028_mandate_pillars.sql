-- Phase 6 — mandate model overhaul.
--
-- Reorganizes the mandate around six pillars and adds two new
-- per-user knobs that the scoring rewrite (Phase B) will read:
--   - `knockouts`       — hard filters that hide counterparties entirely
--   - `mandate_weights` — per-pillar weights for the user's view of scores
--
-- Pillars (column groupings):
--   1. Strategic scope    — sectors / sub_sectors / anti_sectors /
--                            stages / geography / thematic_focus
--   2. Capital mechanics  — check_size_(min|target|max) / deals_per_year /
--                            max_concentration_pct / lead_capacity /
--                            co_invest_appetite
--   3. Time & risk        — holding_period_target_years / loss_appetite /
--                            risk_tolerance (existing) / expected_return
--                            (existing) / timeline (existing)
--   4. Governance         — engagement_style / diligence_depth /
--                            decision_timeline_days
--   5. Counterparty       — preferred_counterparty_types /
--                            min_counterparty_tier / min_verification_level
--   6. Values & alignment — esg_required / impact_themes /
--                            values_exclusions
--
-- All new columns are nullable / have defaults — no existing flow,
-- onboarding step, or smoke test breaks on this migration. The next
-- migration sequence wires the scoring rewrite + UI to read them.

ALTER TABLE profiles
  -- Pillar 1: Strategic scope extensions
  ADD COLUMN IF NOT EXISTS anti_sectors   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sub_sectors    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS thematic_focus TEXT[] NOT NULL DEFAULT '{}',

  -- Pillar 2: Capital mechanics extensions
  ADD COLUMN IF NOT EXISTS check_size_target      NUMERIC,
  ADD COLUMN IF NOT EXISTS deals_per_year         NUMERIC,
  ADD COLUMN IF NOT EXISTS max_concentration_pct  NUMERIC
    CHECK (max_concentration_pct IS NULL
        OR (max_concentration_pct >= 0 AND max_concentration_pct <= 100)),
  ADD COLUMN IF NOT EXISTS lead_capacity      TEXT
    CHECK (lead_capacity IS NULL OR lead_capacity IN ('lead','follow','either')),
  ADD COLUMN IF NOT EXISTS co_invest_appetite TEXT
    CHECK (co_invest_appetite IS NULL OR co_invest_appetite IN ('seeker','open','avoid')),

  -- Pillar 3: Time & risk extensions
  ADD COLUMN IF NOT EXISTS holding_period_target_years NUMERIC,
  ADD COLUMN IF NOT EXISTS loss_appetite TEXT
    CHECK (loss_appetite IS NULL OR loss_appetite IN ('low','moderate','high')),

  -- Pillar 4: Governance & engagement (all new)
  ADD COLUMN IF NOT EXISTS engagement_style TEXT
    CHECK (engagement_style IS NULL OR engagement_style IN ('board','observer','advisory','passive')),
  ADD COLUMN IF NOT EXISTS diligence_depth TEXT
    CHECK (diligence_depth IS NULL OR diligence_depth IN ('light','standard','deep')),
  ADD COLUMN IF NOT EXISTS decision_timeline_days NUMERIC,

  -- Pillar 5: Counterparty profile (mostly new)
  ADD COLUMN IF NOT EXISTS preferred_counterparty_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_counterparty_tier TEXT
    CHECK (min_counterparty_tier IS NULL OR min_counterparty_tier IN ('access','select','sovereign')),
  ADD COLUMN IF NOT EXISTS min_verification_level TEXT
    CHECK (min_verification_level IS NULL OR min_verification_level IN ('accredited','qp','kye')),

  -- Pillar 6: Values & alignment (all new)
  ADD COLUMN IF NOT EXISTS esg_required      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS impact_themes     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS values_exclusions TEXT[] NOT NULL DEFAULT '{}',

  -- Knockouts: array of { kind: 'exclude'|'require', field, value } records.
  -- Filters apply to the OWNER of the row — hides counterparties that fail.
  -- Empty array = wide open. Validated by app code; no DB schema check
  -- so the shape can evolve in Phase B without another migration.
  ADD COLUMN IF NOT EXISTS knockouts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Mandate weights: { pillar: weight_0_to_100 } summing to 100. Asymmetric
  -- by design — each user's weights drive their view of scores. Default
  -- approximates the legacy split (scope-heavy) reshaped over six pillars.
  ADD COLUMN IF NOT EXISTS mandate_weights JSONB NOT NULL DEFAULT
    '{"scope":40,"capital":25,"time_risk":10,"governance":5,"counterparty":10,"values":10}'::jsonb;

-- GIN indexes only on fields the scoring rewrite will actually filter on
-- (knockout-style array overlaps). sub_sectors / thematic_focus are
-- compared for overlap during scoring but not in WHERE clauses, so no
-- index needed at this scale.
CREATE INDEX IF NOT EXISTS profiles_anti_sectors_idx      ON profiles USING GIN (anti_sectors);
CREATE INDEX IF NOT EXISTS profiles_values_exclusions_idx ON profiles USING GIN (values_exclusions);
CREATE INDEX IF NOT EXISTS profiles_knockouts_idx         ON profiles USING GIN (knockouts);
