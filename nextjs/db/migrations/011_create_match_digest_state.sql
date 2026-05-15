CREATE TABLE IF NOT EXISTS match_digest_state (
  user_id      TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_sent_at TIMESTAMPTZ
);
