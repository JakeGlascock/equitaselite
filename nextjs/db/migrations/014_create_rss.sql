-- RSS-driven content pipeline. Replaces the hardcoded REPORTS array on
-- /insights with rotating items pulled from curated public feeds every
-- 6 hours by scripts/rss-poll.mjs.
--
-- rss_feeds is the curated source list. rss_items is the deduplicated
-- catalogue of headlines + summaries. We never store full article
-- bodies — items render as headline + snippet + link to the source
-- (publishers retain all rights to their content).

CREATE TABLE IF NOT EXISTS rss_feeds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  source_label TEXT NOT NULL,                       -- e.g. "Axios"
  sector_tag   TEXT NOT NULL,                       -- maps to InsightsClient sector chips
  surface      TEXT NOT NULL CHECK (surface IN ('insights','discovery','network','reports')),
  min_tier     TEXT NOT NULL CHECK (min_tier IN ('access','select','sovereign')) DEFAULT 'access',
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rss_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id      UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  guid         TEXT NOT NULL,                       -- feed-provided id, used for dedup
  title        TEXT NOT NULL,
  summary      TEXT,
  link         TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feed_id, guid)
);

CREATE INDEX IF NOT EXISTS rss_items_published_idx ON rss_items (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS rss_items_feed_idx      ON rss_items (feed_id);

-- Seed the curated feed list. ON CONFLICT keeps the seed idempotent —
-- re-running this migration is a no-op for existing rows.
INSERT INTO rss_feeds (url, name, source_label, sector_tag, surface, min_tier) VALUES
  -- Insights: general market + sector commentary
  ('https://api.axios.com/feed/pro-rata',                       'Axios Pro Rata',           'Axios',        'Cross-sector', 'insights', 'access'),
  ('https://feeds.a.dj.com/rss/RSSMarketsMain.xml',             'WSJ Markets',              'WSJ',          'Cross-sector', 'insights', 'access'),
  ('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'NYT Business',             'NY Times',     'Cross-sector', 'insights', 'access'),
  ('https://news.crunchbase.com/feed/',                         'Crunchbase News',          'Crunchbase',   'Cross-sector', 'insights', 'access'),
  ('https://www.theinformation.com/feed',                       'The Information',          'The Information','Cross-sector','insights','select'),
  ('https://feeds.bloomberg.com/markets/news.rss',              'Bloomberg Markets',        'Bloomberg',    'Cross-sector', 'insights', 'select'),

  -- Discovery: fundraising announcements + new deals
  ('https://techcrunch.com/category/venture/feed/',             'TechCrunch Venture',       'TechCrunch',   'AI / ML',      'discovery', 'access'),
  ('https://techcrunch.com/category/fintech/feed/',             'TechCrunch FinTech',       'TechCrunch',   'FinTech',      'discovery', 'access'),

  -- Network: people + firm news
  ('https://abovethecrowd.com/feed/',                           'Above the Crowd',          'Bill Gurley',  'Cross-sector', 'network',   'access'),
  ('https://stratechery.com/feed/',                             'Stratechery',              'Ben Thompson', 'SaaS',         'network',   'select'),

  -- Reports: SEC filings + research
  ('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=10-K&output=atom', 'SEC 10-K Filings', 'SEC EDGAR',    'Cross-sector', 'reports', 'select'),
  ('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom',  'SEC 8-K Filings',  'SEC EDGAR',    'Cross-sector', 'reports', 'select')
ON CONFLICT (url) DO NOTHING;
