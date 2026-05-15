CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('Summit','Roundtable','Webinar','Showcase')),
  date        TIMESTAMPTZ NOT NULL,
  duration    TEXT NOT NULL,
  location    TEXT NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  min_tier    TEXT NOT NULL CHECK (min_tier IN ('access','select','sovereign')) DEFAULT 'access',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_date_idx ON events (date);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id    UUID NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvps_user_idx ON event_rsvps (user_id);
