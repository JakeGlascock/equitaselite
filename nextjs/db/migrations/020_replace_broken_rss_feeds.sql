-- Fix the two RSS feeds that failed in the first prod poll on 2026-05-15:
--   - Axios Pro Rata (HTTP 404) → URL moved, no longer published as a
--     standalone RSS feed. Axios pushes newsletter signups instead.
--   - The Information (HTTP 403) → now paywalled, no public RSS.
--
-- Both deactivated (active=FALSE) rather than deleted so the audit
-- trail survives. Their rss_items rows would be filtered out by
-- fetchSurfaceItems anyway since it joins WHERE active=TRUE.
--
-- Backfilling Axios Pro Rata's coverage gap with Newcomer
-- (newcomer.co/feed) — Eric Newcomer's actively-published substack on
-- venture capital and startup dealmaking. Same surface (insights), same
-- access tier, fills the same editorial slot.

UPDATE rss_feeds
   SET active = FALSE
 WHERE source_label IN ('Axios Pro Rata', 'The Information')
   AND active = TRUE;

INSERT INTO rss_feeds (url, name, source_label, sector_tag, surface, min_tier, active)
VALUES ('https://www.newcomer.co/feed', 'Newcomer', 'Newcomer', 'Cross-sector', 'insights', 'access', TRUE)
ON CONFLICT (url) DO NOTHING;
