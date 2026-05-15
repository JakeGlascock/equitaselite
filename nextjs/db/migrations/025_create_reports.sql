-- Sector intelligence reports — editorial long-form content authored
-- by admins/concierge, displayed on /reports above the RSS feed. Tier-
-- gated: Access sees titles + locks, Select+ sees full body for
-- reports with min_tier 'access' or 'select', Sovereign sees all.
--
-- body stores Markdown; body_html caches the rendered HTML so we
-- don't re-parse on every read (cached at admin save time).
--
-- slug is unique and URL-safe; used for /reports/[slug] routing.

CREATE TABLE IF NOT EXISTS reports (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT         NOT NULL UNIQUE,
  title         TEXT         NOT NULL,
  summary       TEXT         NOT NULL,
  sector_tag    TEXT         NOT NULL,
  body          TEXT         NOT NULL,
  body_html     TEXT,
  min_tier      TEXT         NOT NULL DEFAULT 'select'
                  CHECK (min_tier IN ('access', 'select', 'sovereign')),
  published_at  TIMESTAMPTZ,
  created_by    TEXT         NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Most reads filter by published + ordered by published_at DESC.
CREATE INDEX IF NOT EXISTS reports_published_idx
  ON reports (published_at DESC)
  WHERE published_at IS NOT NULL;

-- Sector filter for the user-facing list.
CREATE INDEX IF NOT EXISTS reports_sector_idx
  ON reports (sector_tag, published_at DESC)
  WHERE published_at IS NOT NULL;
