-- Magic-link tokens for the "investor preview" mode. Each token routes
-- an unauthenticated visitor to view the platform as a specific demo
-- profile, with mutations blocked and a banner overlaid. Used for
-- fundraising-investor demos — the founder shares a token-bearing URL
-- and revokes / expires it later from /admin.

CREATE TABLE IF NOT EXISTS preview_tokens (
  -- 32-byte hex from crypto.randomBytes(32). 64 chars, URL-safe.
  token            TEXT         PRIMARY KEY,
  -- Human label so the founder remembers who they sent which token to.
  label            TEXT         NOT NULL,
  -- Which demo profile the visitor sees the platform as. Must be a
  -- profiles row whose id starts with 'demo_'.
  demo_profile_id  TEXT         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Absolute expiry. Default +14 days when omitted on insert.
  expires_at       TIMESTAMPTZ  NOT NULL,
  -- Per-token usage cap (shared screens / refreshes). When view_count
  -- reaches max_views the token is treated as exhausted.
  max_views        INTEGER      NOT NULL DEFAULT 25 CHECK (max_views > 0),
  view_count       INTEGER      NOT NULL DEFAULT 0,
  last_viewed_at   TIMESTAMPTZ,
  -- Kill switch — set to NOW() to revoke immediately without deleting
  -- the audit row.
  revoked_at       TIMESTAMPTZ,
  -- Who minted the token (admin id).
  created_by       TEXT         NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Most reads are by token (primary key, already indexed).
-- Admin listing uses created_at DESC.
CREATE INDEX IF NOT EXISTS preview_tokens_recent_idx
  ON preview_tokens (created_at DESC);
