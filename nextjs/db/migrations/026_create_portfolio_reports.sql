-- Bespoke portfolio intelligence — per-Sovereign weekly memos authored
-- by admin/concierge, surfaced on /concierge for the recipient and at
-- /briefings/[id] in detail. The "Bespoke portfolio intelligence" line
-- on /pricing → Sovereign tier becomes real here.
--
-- Markdown body cached as HTML at save time (same pattern as
-- reports). recipient_user_id FK ensures cascade cleanup when a
-- Sovereign offboards.

CREATE TABLE IF NOT EXISTS portfolio_reports (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id TEXT         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT         NOT NULL,
  summary           TEXT         NOT NULL,
  body              TEXT         NOT NULL,
  body_html         TEXT,
  published_at      TIMESTAMPTZ,
  created_by        TEXT         NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Most reads filter to (recipient, published) ordered most-recent first.
CREATE INDEX IF NOT EXISTS portfolio_reports_recipient_idx
  ON portfolio_reports (recipient_user_id, published_at DESC NULLS LAST);

-- For the admin "all briefings" view: list everything ordered by recency.
CREATE INDEX IF NOT EXISTS portfolio_reports_recent_idx
  ON portfolio_reports (COALESCE(published_at, created_at) DESC);
