-- Fix the `time_risk` key inside mandate_weights JSONB.
--
-- The Phase 6 TypeScript types (MandateWeights, PillarScores) use
-- camelCase `timeRisk`. Migration 028 accidentally seeded the column
-- DEFAULT with snake_case `time_risk`, which means:
--   1. Every profile created since 028 has `time_risk` instead of
--      `timeRisk` in their mandate_weights JSONB.
--   2. The /profile mandate-weights editor sums show "Sum: NaN / 100"
--      because weights.timeRisk reads as undefined.
--   3. Scoring silently drops the time-risk pillar weight when
--      combining contribs (undefined → NaN propagation).
--
-- Fix in two steps:
--   1. Rename `time_risk` → `timeRisk` on every existing row that
--      carries the bad key. jsonb_set adds the new key at the value
--      of the old one; the `- 'time_risk'` first strips the old key.
--   2. Update the column default so future rows are camelCase.
--
-- Rows that were already written via PATCH /api/me/mandate-weights
-- (which uses camelCase) are unaffected — the WHERE guard skips them.

UPDATE profiles
SET mandate_weights = jsonb_set(
  mandate_weights - 'time_risk',
  '{timeRisk}',
  mandate_weights -> 'time_risk',
  TRUE
)
WHERE mandate_weights ? 'time_risk';

ALTER TABLE profiles
  ALTER COLUMN mandate_weights SET DEFAULT
    '{"scope":40,"capital":25,"timeRisk":10,"governance":5,"counterparty":10,"values":10}'::jsonb;
