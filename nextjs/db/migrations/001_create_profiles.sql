CREATE TABLE profiles (
  id                   TEXT PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  role                 TEXT NOT NULL CHECK (role IN ('angel', 'family_office')),
  full_name            TEXT NOT NULL,
  title                TEXT,
  firm_name            TEXT NOT NULL,
  location             TEXT,
  aum                  TEXT,
  sectors              TEXT[]    NOT NULL DEFAULT '{}',
  stages               TEXT[]    NOT NULL DEFAULT '{}',
  geography            TEXT[]    NOT NULL DEFAULT '{}',
  check_size_min       NUMERIC(10,2) NOT NULL DEFAULT 0,
  check_size_max       NUMERIC(10,2) NOT NULL DEFAULT 0,
  risk_tolerance       TEXT CHECK (risk_tolerance IN ('Conservative', 'Moderate', 'Aggressive')),
  expected_return      TEXT,
  timeline             TEXT,
  mandate_type         TEXT,
  concentration        TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX profiles_role_idx ON profiles (role);
CREATE INDEX profiles_onboarding_idx ON profiles (onboarding_completed);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
