CREATE TABLE IF NOT EXISTS access_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  full_name    TEXT NOT NULL,
  firm_name    TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('angel', 'family_office')),
  notes        TEXT,
  status       TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'invited', 'declined')) DEFAULT 'new',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handled_at   TIMESTAMPTZ,
  handled_by   TEXT REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS access_requests_email_idx  ON access_requests (LOWER(email));
