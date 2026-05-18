-- Re-seed Chelsea's concierge bio at her new email.
--
-- Migration 027 seeded the bio targeting chelsea@equitaselite.com — but
-- her actual Cognito account uses chelsea@logictry.com, so the original
-- UPDATE was a no-op (no profile row matched). This migration seeds the
-- bio at the correct email.
--
-- Two clauses:
--   1. UPDATE: write the bio if her profile exists, is flagged
--      is_concierge = TRUE, and doesn't already have a bio set.
--   2. SQL no-op if she hasn't been re-invited and toggled yet — the
--      migration is safe to deploy ahead of the recreation flow. When
--      she's later set up, an admin can re-run this UPDATE manually,
--      or we can ship a small "Reseed bio" admin button.
--
-- Idempotent — the (bio IS NULL OR bio = '') guard prevents overwriting
-- a manually-set bio.

UPDATE profiles
SET bio = 'Co-CEO and Co-Founder of Logictry, where she leads the global rollout of Logic Centers — curated communities for family offices, next-generation inheritors, and impact investors. President of the Keep Families Giving Foundation. Doctoral Merit Fellow at Texas State University researching next-generation family office education. Advisory boards include the Family Office Association, NEXUS, UN SDSN Youth, and the Southwestern Angel Network.'
WHERE LOWER(email) = 'chelsea@logictry.com'
  AND is_concierge = TRUE
  AND (bio IS NULL OR bio = '');
