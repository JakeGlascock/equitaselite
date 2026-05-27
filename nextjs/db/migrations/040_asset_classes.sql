-- P1 product phase: asset-class affinity under Pillar 1 (Strategic Scope).
--
-- BlackRock 2025 Family Office Report: 32% of family offices intend to
-- increase private credit allocation, 30% infrastructure — highest of
-- any alt class. Capturing this as a mandate field lets the matcher
-- up-weight counterparties whose asset-class affinity overlaps.
--
-- Modeled as TEXT[] (same shape as sectors / sub_sectors / etc.) so a
-- profile can opt into multiple classes — Private Credit + Real Estate
-- + Buyout is a normal mix. Empty array = no asset-class preference;
-- the matcher skips the sub-score (won't penalize legacy profiles).
--
-- App code validates the values (PRIVATE_CREDIT, INFRASTRUCTURE,
-- REAL_ESTATE, VENTURE, BUYOUT, HEDGE, ABSOLUTE_RETURN, NATURAL_RES,
-- PRIVATE_DEBT_SPECIALTY) — kept out of the DB CHECK so we can iterate
-- on the canonical list without another migration.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS asset_classes TEXT[] NOT NULL DEFAULT '{}';

-- Mirror the column on the per-role mandates sub-table (migration 034)
-- so multi-role users can express different asset-class affinity per
-- role (e.g. Angel = VENTURE only; Family Office = INFRASTRUCTURE +
-- PRIVATE_CREDIT).
ALTER TABLE mandates
  ADD COLUMN IF NOT EXISTS asset_classes TEXT[] NOT NULL DEFAULT '{}';
