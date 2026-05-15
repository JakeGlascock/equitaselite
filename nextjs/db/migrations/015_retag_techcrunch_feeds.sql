-- The 014 seed tagged TechCrunch Venture + TechCrunch FinTech as
-- surface='discovery'. /discovery is actually a real candidate-browser
-- (counterparties on the platform), not a content feed — so those
-- items had nowhere to render. Move them to surface='insights' where
-- they'll appear alongside the other industry-news feeds.

UPDATE rss_feeds
SET surface = 'insights'
WHERE surface = 'discovery'
  AND source_label = 'TechCrunch';
