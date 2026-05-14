CREATE TABLE IF NOT EXISTS introductions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  message      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_intro CHECK (requester_id != recipient_id),
  CONSTRAINT unique_pair UNIQUE (requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS introductions_requester_idx ON introductions (requester_id);
CREATE INDEX IF NOT EXISTS introductions_recipient_idx ON introductions (recipient_id);
CREATE INDEX IF NOT EXISTS introductions_status_idx    ON introductions (status);
