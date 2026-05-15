-- Bootstrap the demo profile cohort used by:
--   1. The "Operate as" concierge tooling
--   2. The investor-preview links feature (admin picks one per token)
--   3. Screenshots / QA / matching-engine smoke checks
--
-- The /api/admin/seed-demo-data button stays in place for re-seeding
-- from the admin UI, but new environments no longer need to remember
-- to click it — the demo set lands automatically with migrations.
--
-- ON CONFLICT (id) DO NOTHING: if an environment already ran the
-- admin-button seeder (or this migration on a prior deploy), existing
-- demo rows are left alone. The data is otherwise identical between
-- the two paths.
--
-- walkthrough_seen_at is stamped NOW() so the regular first-login
-- walkthrough never fires for demo profiles. (Preview mode already
-- suppresses it via the layout flag — this is belt-and-braces.)

INSERT INTO profiles (
  id, email, role, full_name, title, firm_name, location, aum,
  sectors, stages, geography,
  check_size_min, check_size_max, risk_tolerance,
  expected_return, timeline, mandate_type, concentration,
  membership, onboarding_completed, walkthrough_seen_at
) VALUES
  -- ───── Angel investors ─────
  ('demo_angel_sarah_chen', 'sarah.chen@demo.equitaselite.com', 'angel', 'Sarah Chen',
   'Former VP Product, Stripe', 'Chen Ventures', 'San Francisco, CA', NULL,
   ARRAY['FinTech','SaaS','AI / ML'], ARRAY['Pre-Seed','Seed'], ARRAY['North America'],
   0.25, 2, 'Aggressive', '10x+', '5-7 years', NULL, NULL,
   'select', TRUE, NOW()),

  ('demo_angel_david_patel', 'david.patel@demo.equitaselite.com', 'angel', 'David Patel',
   'Cardiologist & Investor', 'Patel Capital', 'Boston, MA', NULL,
   ARRAY['Healthcare','Life Sciences','Deep Tech'], ARRAY['Seed','Series A'], ARRAY['North America','Europe'],
   0.5, 5, 'Moderate', '5x-10x', '7-10 years', NULL, NULL,
   'select', TRUE, NOW()),

  ('demo_angel_marcus_williams', 'marcus.williams@demo.equitaselite.com', 'angel', 'Marcus Williams',
   'Founder & CEO, Halcyon (acquired)', 'Williams Holdings', 'Austin, TX', NULL,
   ARRAY['Consumer','AI / ML','SaaS'], ARRAY['Pre-Seed','Seed'], ARRAY['North America','Global'],
   0.25, 1, 'Aggressive', '10x+', '5-7 years', NULL, NULL,
   'sovereign', TRUE, NOW()),

  ('demo_angel_jennifer_okonkwo', 'jennifer.okonkwo@demo.equitaselite.com', 'angel', 'Jennifer Okonkwo',
   'Climate Tech Advisor, Former Tesla', 'Okonkwo Partners', 'Seattle, WA', NULL,
   ARRAY['Clean Energy','Deep Tech'], ARRAY['Seed','Series A'], ARRAY['North America','Europe'],
   0.5, 3, 'Moderate', '5x-10x', '7-10 years', NULL, NULL,
   'access', TRUE, NOW()),

  ('demo_angel_robert_lin', 'robert.lin@demo.equitaselite.com', 'angel', 'Robert Lin',
   'Managing Partner, Lin Capital', 'Lin Capital', 'Singapore', NULL,
   ARRAY['FinTech','AI / ML','SaaS'], ARRAY['Series A','Series B'], ARRAY['Asia-Pacific','Global'],
   1, 10, 'Moderate', '5x-10x', '5-7 years', NULL, NULL,
   'sovereign', TRUE, NOW()),

  ('demo_angel_alexandra_romanov', 'alexandra.romanov@demo.equitaselite.com', 'angel', 'Alexandra Romanov',
   'Defense Tech Advisor, Ex-Palantir', 'Romanov & Co.', 'Arlington, VA', NULL,
   ARRAY['Defense Tech','Deep Tech','AI / ML'], ARRAY['Seed','Series A'], ARRAY['North America'],
   0.5, 5, 'Aggressive', '10x+', '7-10 years', NULL, NULL,
   'select', TRUE, NOW()),

  ('demo_angel_priya_sharma', 'priya.sharma@demo.equitaselite.com', 'angel', 'Priya Sharma',
   'GP, Sharma Seed Fund', 'Sharma Seed', 'New York, NY', NULL,
   ARRAY['SaaS','FinTech','AI / ML'], ARRAY['Seed','Series A'], ARRAY['North America','Global'],
   0.5, 3, 'Moderate', '5x-10x', '5-7 years', NULL, NULL,
   'sovereign', TRUE, NOW()),

  ('demo_angel_james_thompson', 'james.thompson@demo.equitaselite.com', 'angel', 'James Thompson',
   'Independent Investor', 'Thompson Holdings', 'London, UK', NULL,
   ARRAY['Life Sciences','Healthcare'], ARRAY['Pre-Seed','Seed'], ARRAY['Europe','North America'],
   0.25, 1, 'Conservative', '2x-5x', '7-10 years', NULL, NULL,
   'access', TRUE, NOW()),

  -- ───── Family offices ─────
  ('demo_fo_hartwell', 'invest@hartwellcapital.demo', 'family_office', 'Catherine Hartwell',
   'Chief Investment Officer', 'Hartwell Capital', 'Greenwich, CT', '$50M–$250M',
   ARRAY['Real Estate','FinTech','Consumer'], ARRAY['Series B+','Growth'], ARRAY['North America','Europe'],
   2, 10, 'Conservative', NULL, NULL, 'Balanced', 'Direct',
   'select', TRUE, NOW()),

  ('demo_fo_stein', 'investments@steinfo.demo', 'family_office', 'Michael Stein',
   'Managing Director', 'Stein Family Office', 'New York, NY', '$250M–$1B',
   ARRAY['FinTech','SaaS','AI / ML'], ARRAY['Series B','Series B+'], ARRAY['North America','Global'],
   5, 25, 'Moderate', NULL, NULL, 'Growth', 'Direct',
   'sovereign', TRUE, NOW()),

  ('demo_fo_patel_holdings', 'office@patelholdings.demo', 'family_office', 'Anish Patel',
   'Head of Investments', 'Patel Holdings', 'Mumbai, India', '$50M–$250M',
   ARRAY['Healthcare','Life Sciences','Deep Tech'], ARRAY['Series A','Series B'], ARRAY['Asia-Pacific','Global'],
   1, 5, 'Moderate', NULL, NULL, 'Venture', 'Syndicated',
   'select', TRUE, NOW()),

  ('demo_fo_ridgemont', 'investments@ridgemont.demo', 'family_office', 'Charles Ridgemont III',
   'Principal', 'Ridgemont Partners', 'Dallas, TX', '$250M–$1B',
   ARRAY['Real Estate','Clean Energy','Consumer'], ARRAY['Series B+','Growth'], ARRAY['North America'],
   5, 15, 'Conservative', NULL, NULL, 'Value', 'Direct',
   'sovereign', TRUE, NOW()),

  ('demo_fo_yamada', 'family@yamada-investments.demo', 'family_office', 'Hiroshi Yamada',
   'Principal', 'Yamada Investments', 'Tokyo, Japan', '$50M–$250M',
   ARRAY['Deep Tech','AI / ML','Defense Tech'], ARRAY['Series A','Series B'], ARRAY['Asia-Pacific','North America'],
   2, 10, 'Aggressive', NULL, NULL, 'Venture', 'Direct',
   'select', TRUE, NOW()),

  ('demo_fo_vasquez', 'principal@vasquezcapital.demo', 'family_office', 'Isabella Vasquez',
   'Managing Principal', 'Vasquez Capital Group', 'Miami, FL', '$50M–$250M',
   ARRAY['Consumer','SaaS','FinTech'], ARRAY['Seed','Series A'], ARRAY['North America','Latin America'],
   1, 5, 'Aggressive', NULL, NULL, 'Venture', 'Syndicated',
   'access', TRUE, NOW()),

  ('demo_fo_mountain_peak', 'office@mountainpeak.demo', 'family_office', 'Rebecca Lin-Anderson',
   'Chief Investment Officer', 'Mountain Peak Holdings', 'Denver, CO', '>$1B',
   ARRAY['Defense Tech','AI / ML','Deep Tech'], ARRAY['Series B','Series B+','Growth'], ARRAY['North America','Global'],
   10, 50, 'Moderate', NULL, NULL, 'Growth', 'Direct',
   'sovereign', TRUE, NOW()),

  ('demo_fo_lakeside', 'office@lakesidefamilytrust.demo', 'family_office', 'Edward Lakeside',
   'Trustee', 'Lakeside Family Trust', 'Zurich, Switzerland', '$250M–$1B',
   ARRAY['SaaS','Healthcare','Clean Energy'], ARRAY['Series A','Series B','Growth'], ARRAY['Europe','Global'],
   2, 10, 'Conservative', NULL, NULL, 'Balanced', 'Both',
   'sovereign', TRUE, NOW())
ON CONFLICT (id) DO NOTHING;
