-- Extend user_reports to support the ambient feedback widget. Previously
-- the table only held error-form submissions (effectively all "bug"
-- type). The widget routes submissions into one of three buckets so
-- the founder can triage faster: bugs go in their own pile, ideas
-- inform the roadmap, "other" catches everything else.
--
-- DEFAULT 'bug' backfills all existing rows correctly — every prior
-- submission came from an error surface.

ALTER TABLE user_reports
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'bug'
    CHECK (type IN ('bug', 'idea', 'other'));

CREATE INDEX IF NOT EXISTS user_reports_type_idx
  ON user_reports (type, created_at DESC);
