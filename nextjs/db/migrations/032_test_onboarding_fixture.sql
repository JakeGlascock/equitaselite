-- Test-fixture profile for walking the onboarding wizard without
-- burning a real Cognito invite. Any admin can "Operate as" this
-- profile from /admin → Test fixtures → Start onboarding test.
-- The start endpoint resets these fields to baseline on every click
-- so each test run starts from a clean slate.
--
-- The is_test flag is what lets acting-as.ts know this row is safe
-- to impersonate by ANY admin (vs the managed_by gate, which is for
-- concierge-managed accounts).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS profiles_is_test_idx
  ON profiles (is_test) WHERE is_test = TRUE;

INSERT INTO profiles (
  id, email, role, full_name, firm_name,
  sectors, stages, geography,
  check_size_min, check_size_max,
  onboarding_completed, is_test, email_notifications_enabled
) VALUES (
  'test_onboarding_fixture',
  'test_onboarding@example.com',
  'angel',
  'Test Onboarding',
  'Test Fixture',
  '{}', '{}', '{}',
  0, 0,
  FALSE, TRUE, FALSE
)
ON CONFLICT (id) DO UPDATE SET is_test = TRUE;
