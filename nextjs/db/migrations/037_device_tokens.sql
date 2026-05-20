-- Device tokens for native push notifications (Phase M2).
--
-- Each row is a single (user, physical device) install. The same user can
-- have multiple tokens (iPhone + iPad + Android). The same physical device
-- can re-register and get a new token from APNs/FCM; we upsert on
-- (platform, token) so a re-registered token attaches to the latest user.
--
-- Tokens are revoked rather than deleted so we keep the audit trail of
-- which device received which intro/event push. Push dispatch filters on
-- revoked_at IS NULL.

-- profiles.id is TEXT (Cognito sub stored as-is); the FK column matches.
CREATE TABLE IF NOT EXISTS device_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token        TEXT NOT NULL,
  app_version  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ
);

-- One row per physical-device token. A re-registration with the same
-- token updates the existing row's user_id + last_seen_at instead of
-- creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_platform_token_idx
  ON device_tokens (platform, token);

-- Fan-out by user when dispatching a push to all the user's active
-- devices. Partial index — revoked tokens are uninteresting.
CREATE INDEX IF NOT EXISTS device_tokens_user_active_idx
  ON device_tokens (user_id) WHERE revoked_at IS NULL;
