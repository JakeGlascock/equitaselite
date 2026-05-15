-- User-submitted error reports. The platform-wide error pages and the
-- /preview-denied panel expose a "Report this" affordance that POSTs to
-- /api/feedback/report; each submission lands here.
--
-- Intentionally NOT FK'd to profiles — preview visitors carry a demo_*
-- "user_id" that wouldn't validate, and we want the row to survive
-- profile deletion either way (audit trail).
--
-- context is JSONB so the client can attach incidental detail (preview
-- mode flag, viewport size, etc.) without us schema-locking it.

CREATE TABLE IF NOT EXISTS user_reports (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,
  digest      TEXT,
  path        TEXT         NOT NULL,
  user_agent  TEXT,
  message     TEXT         NOT NULL,
  context     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_reports_recent_idx
  ON user_reports (created_at DESC);
