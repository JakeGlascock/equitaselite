-- Bespoke concierge requests submitted via /concierge.
-- One row per submission. The concierge team handles these out-of-band
-- (typically by email reply to the requester); status flips from 'open'
-- to 'handled' once they've responded.

CREATE TABLE IF NOT EXISTS concierge_requests (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category    TEXT         NOT NULL CHECK (category IN ('introduction','diligence','vetting','market','mandate','other')),
  urgency     TEXT         NOT NULL CHECK (urgency IN ('Routine','Within a week','Within 48 hours')),
  details     TEXT         NOT NULL,
  status      TEXT         NOT NULL DEFAULT 'open' CHECK (status IN ('open','handled')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  handled_at  TIMESTAMPTZ
);

-- Partial index for the realistic read pattern: the concierge dashboard
-- (not yet built) will fetch open requests in reverse-chronological order.
CREATE INDEX IF NOT EXISTS concierge_requests_open_idx
  ON concierge_requests (created_at DESC)
  WHERE status = 'open';

-- Per-user history (less critical but cheap).
CREATE INDEX IF NOT EXISTS concierge_requests_user_idx
  ON concierge_requests (user_id, created_at DESC);
