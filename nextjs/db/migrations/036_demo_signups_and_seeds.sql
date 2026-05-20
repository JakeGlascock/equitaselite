-- Public-demo schema + demo data expansion (Phase F1).
--
-- Two pieces:
-- 1) demo_signups — magic-link state for prospects who submit the
--    public /try form. A row lives ~30 min as a pending verification;
--    after the prospect clicks the link, a preview_tokens row gets
--    minted and the demo session starts. The demo_signups row stays
--    as the audit + lead record.
-- 2) Demo profile + mandate seeds for the three role types added in
--    migration 035 (Next-Gen, Family Foundation, DAF). The public
--    demo needs realistic counterparties on all five investor sides;
--    today's seed (migration 019) only covers Angel + FO.
--
-- Mandate rows are seeded explicitly for the new demo profiles
-- (migration 034's backfill only ran for profiles with role IS NOT
-- NULL; the new profiles have role = NULL since their identity lives
-- in the boolean flags).

-- ── 1. demo_signups ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS demo_signups (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 64-char hex magic-link token (crypto.randomBytes(32)). UNIQUE +
  -- indexed for the verify lookup.
  magic_token     TEXT         NOT NULL UNIQUE,
  -- Lead capture fields (the 5-field form on /try).
  full_name       TEXT         NOT NULL,
  email           TEXT         NOT NULL,
  firm_name       TEXT         NOT NULL,
  aum_range       TEXT         NOT NULL,
  intended_use    TEXT         NOT NULL,
  -- Which role context the prospect picked. Drives which demo profile
  -- the eventual preview token binds to.
  viewing_as_role TEXT         NOT NULL
    CHECK (viewing_as_role IN ('angel','family_office','next_gen','family_foundation','daf')),
  -- Submission ip — used by the rate-limiter + abuse audit.
  ip_address      INET,
  -- Verification window. Default 30 min from submission.
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  magic_expires_at TIMESTAMPTZ NOT NULL,
  -- Stamped when the magic link is clicked.
  verified_at     TIMESTAMPTZ,
  -- The preview_tokens row that got minted for the verified session
  -- (NULL until verified). Foreign-key the actual session token.
  preview_token   TEXT         REFERENCES preview_tokens(token) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS demo_signups_email_idx       ON demo_signups (email);
CREATE INDEX IF NOT EXISTS demo_signups_created_at_idx  ON demo_signups (created_at DESC);
CREATE INDEX IF NOT EXISTS demo_signups_ip_recent_idx
  ON demo_signups (ip_address, created_at DESC) WHERE ip_address IS NOT NULL;

-- ── 2a. Demo profile seeds — Next-Gen ────────────────────────────────

INSERT INTO profiles (
  id, email, role, full_name, title, firm_name, location, aum,
  sectors, stages, geography,
  check_size_min, check_size_max, risk_tolerance,
  expected_return, timeline, mandate_type, concentration,
  membership, onboarding_completed, walkthrough_seen_at,
  is_angel, is_family_office, is_next_gen, is_family_foundation, is_daf
) VALUES
  ('demo_ng_ava_thornton', 'ava.thornton@demo.equitaselite.com', NULL, 'Ava Thornton',
   'Principal, Thornton Family Trust (Next Gen)', 'Thornton Family Trust', 'New York, NY', NULL,
   ARRAY['Consumer','AI / ML','Clean Energy'], ARRAY['Seed','Series A'], ARRAY['North America','Europe'],
   0.5, 5, 'Moderate', '5x-10x', '5-7 years', NULL, NULL,
   'select', TRUE, NOW(),
   FALSE, FALSE, TRUE, FALSE, FALSE),

  ('demo_ng_lucas_kim', 'lucas.kim@demo.equitaselite.com', NULL, 'Lucas Kim',
   'Founder & Next-Gen Allocator', 'Kim Holdings', 'San Francisco, CA', NULL,
   ARRAY['AI / ML','SaaS','FinTech'], ARRAY['Pre-Seed','Seed'], ARRAY['North America','Asia-Pacific'],
   0.25, 1, 'Aggressive', '10x+', '5-7 years', NULL, NULL,
   'access', TRUE, NOW(),
   FALSE, FALSE, TRUE, FALSE, FALSE),

  ('demo_ng_isabella_moretti', 'isabella.moretti@demo.equitaselite.com', NULL, 'Isabella Moretti',
   'Next-Gen Principal · Impact', 'Moretti Family Office', 'Milan, Italy', NULL,
   ARRAY['Clean Energy','Healthcare','Life Sciences'], ARRAY['Seed','Series A'], ARRAY['Europe','Global'],
   0.5, 3, 'Moderate', '5x-10x', '7-10 years', NULL, NULL,
   'sovereign', TRUE, NOW(),
   FALSE, FALSE, TRUE, FALSE, FALSE),

  ('demo_ng_julian_okafor', 'julian.okafor@demo.equitaselite.com', NULL, 'Julian Okafor',
   'Next-Gen Investor · Real Estate + Tech', 'Okafor Group', 'London, UK', NULL,
   ARRAY['Real Estate','FinTech','SaaS'], ARRAY['Series A','Series B'], ARRAY['Europe','Africa','North America'],
   1, 5, 'Moderate', '5x-10x', '7-10 years', NULL, NULL,
   'select', TRUE, NOW(),
   FALSE, FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── 2b. Demo profile seeds — Family Foundation ───────────────────────

INSERT INTO profiles (
  id, email, role, full_name, title, firm_name, location, aum,
  sectors, stages, geography,
  check_size_min, check_size_max, risk_tolerance,
  expected_return, timeline, mandate_type, concentration,
  membership, onboarding_completed, walkthrough_seen_at,
  is_angel, is_family_office, is_next_gen, is_family_foundation, is_daf
) VALUES
  ('demo_ff_pemberton', 'invest@pemberton-foundation.demo', NULL, 'Helen Pemberton',
   'Executive Director', 'Pemberton Family Foundation', 'Boston, MA', '$50M–$250M',
   ARRAY['Healthcare','Life Sciences','Clean Energy'], ARRAY['Seed','Series A','Series B'], ARRAY['North America','Global'],
   1, 10, 'Moderate', NULL, NULL, 'Impact', 'Both',
   'sovereign', TRUE, NOW(),
   FALSE, FALSE, FALSE, TRUE, FALSE),

  ('demo_ff_sunrise', 'allocations@sunrise-initiative.demo', NULL, 'Daniel Reyes',
   'Chief Investment Officer', 'Sunrise Climate Initiative', 'Portland, OR', '$250M–$1B',
   ARRAY['Clean Energy','Deep Tech'], ARRAY['Series A','Series B','Series B+'], ARRAY['North America','Europe','Asia-Pacific'],
   2, 15, 'Moderate', NULL, NULL, 'Impact', 'Direct',
   'sovereign', TRUE, NOW(),
   FALSE, FALSE, FALSE, TRUE, FALSE),

  ('demo_ff_kessler', 'investments@kessler-trust.demo', NULL, 'Margaret Kessler',
   'Trustee & CIO', 'Kessler Family Trust', 'Chicago, IL', '$10M–$50M',
   ARRAY['Life Sciences','Healthcare'], ARRAY['Seed','Series A'], ARRAY['North America'],
   0.5, 3, 'Conservative', NULL, NULL, 'Impact', 'Syndicated',
   'select', TRUE, NOW(),
   FALSE, FALSE, FALSE, TRUE, FALSE),

  ('demo_ff_atlas', 'partners@atlas-giving.demo', NULL, 'Rohan Mehta',
   'Director of Investments', 'Atlas Giving Foundation', 'Geneva, Switzerland', '>$1B',
   ARRAY['Healthcare','Clean Energy','FinTech'], ARRAY['Series A','Series B','Growth'], ARRAY['Global','Europe','Asia-Pacific'],
   5, 25, 'Moderate', NULL, NULL, 'Impact', 'Direct',
   'sovereign', TRUE, NOW(),
   FALSE, FALSE, FALSE, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── 2c. Demo profile seeds — Donor-Advised Funds ─────────────────────

INSERT INTO profiles (
  id, email, role, full_name, title, firm_name, location, aum,
  sectors, stages, geography,
  check_size_min, check_size_max, risk_tolerance,
  expected_return, timeline, mandate_type, concentration,
  membership, onboarding_completed, walkthrough_seen_at,
  is_angel, is_family_office, is_next_gen, is_family_foundation, is_daf
) VALUES
  ('demo_daf_horizon', 'team@horizon-daf.demo', NULL, 'Patricia Vance',
   'Fund Advisor', 'Horizon DAF (Fidelity Charitable)', 'San Francisco, CA', '$10M–$50M',
   ARRAY['Healthcare','Clean Energy','Consumer'], ARRAY['Series A','Series B'], ARRAY['North America'],
   0.5, 3, 'Conservative', NULL, NULL, 'Impact', 'Both',
   'select', TRUE, NOW(),
   FALSE, FALSE, FALSE, FALSE, TRUE),

  ('demo_daf_kessler_charitable', 'office@kessler-daf.demo', NULL, 'Thomas Kessler',
   'Donor Advisor', 'Kessler Charitable DAF', 'Boston, MA', '$10M–$50M',
   ARRAY['Healthcare','Life Sciences'], ARRAY['Seed','Series A'], ARRAY['North America'],
   0.25, 2, 'Conservative', NULL, NULL, 'Impact', 'Syndicated',
   'select', TRUE, NOW(),
   FALSE, FALSE, FALSE, FALSE, TRUE),

  ('demo_daf_legacy', 'advisors@legacy-partners.demo', NULL, 'Nathaniel Brooks',
   'Senior Donor Advisor', 'Legacy Partners DAF', 'New York, NY', '$50M–$250M',
   ARRAY['Healthcare','Clean Energy','Real Estate'], ARRAY['Series A','Series B','Growth'], ARRAY['North America','Global'],
   1, 10, 'Moderate', NULL, NULL, 'Balanced', 'Direct',
   'sovereign', TRUE, NOW(),
   FALSE, FALSE, FALSE, FALSE, TRUE),

  ('demo_daf_pacific', 'investments@pacific-giving.demo', NULL, 'Yuki Watanabe',
   'Donor Services Director', 'Pacific Giving DAF', 'Seattle, WA', '$10M–$50M',
   ARRAY['Clean Energy','Deep Tech','Life Sciences'], ARRAY['Seed','Series A'], ARRAY['North America','Asia-Pacific'],
   0.5, 3, 'Moderate', NULL, NULL, 'Impact', 'Both',
   'select', TRUE, NOW(),
   FALSE, FALSE, FALSE, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Mandate rows for the new demo profiles ────────────────────────
-- The new profiles have role = NULL (their identity is in the flags),
-- so migration 034's backfill skipped them. Mirror the denormalized
-- mandate fields into the mandates table under each profile's role.

INSERT INTO mandates (
  profile_id, role,
  sectors, stages, geography,
  check_size_min, check_size_max, risk_tolerance,
  expected_return, timeline, mandate_type, concentration,
  aum
)
SELECT
  p.id,
  CASE
    WHEN p.is_next_gen          THEN 'next_gen'
    WHEN p.is_family_foundation THEN 'family_foundation'
    WHEN p.is_daf               THEN 'daf'
  END AS role,
  p.sectors, p.stages, p.geography,
  p.check_size_min, p.check_size_max, p.risk_tolerance,
  p.expected_return, p.timeline, p.mandate_type, p.concentration,
  p.aum
FROM profiles p
WHERE p.id IN (
  'demo_ng_ava_thornton', 'demo_ng_lucas_kim', 'demo_ng_isabella_moretti', 'demo_ng_julian_okafor',
  'demo_ff_pemberton', 'demo_ff_sunrise', 'demo_ff_kessler', 'demo_ff_atlas',
  'demo_daf_horizon', 'demo_daf_kessler_charitable', 'demo_daf_legacy', 'demo_daf_pacific'
)
ON CONFLICT (profile_id, role) DO NOTHING;
