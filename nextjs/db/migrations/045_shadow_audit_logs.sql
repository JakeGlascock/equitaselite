-- P5d — per-view audit log for the next-gen shadow feature.
--
-- The P5b session-level audit (one notifications row per enable)
-- told the parent THAT the next-gen accessed their seat. This table
-- tells them WHAT was looked at. The parent can scan the recent
-- activity panel on /profile to see "next-gen viewed /dashboard
-- twice this week and /deals once."
--
-- One row per (parent, next_gen, pathname) within a 1-hour debounce
-- window (enforced by the lib insert helper, not by the schema —
-- query-based dedup keeps the schema simple and the truncation
-- behavior tunable without a migration).
--
-- Rows are insert-only; nothing deletes them except FK cascade.
-- Storage is bounded by activity volume; if it grows unwieldy we
-- can add a TTL job later.

CREATE TABLE IF NOT EXISTS shadow_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  next_gen_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- The route the next-gen was on when the pivot happened, eg
  -- '/dashboard', '/deals', '/connections', '/match/[uuid]'. We
  -- collapse match/[id] entries by replacing the id with the literal
  -- token in the lib helper so different candidate views aggregate.
  pathname      TEXT NOT NULL CHECK (length(pathname) BETWEEN 1 AND 200),
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: "show me the last 50 activity entries for my seat."
CREATE INDEX IF NOT EXISTS shadow_audit_logs_parent_idx
  ON shadow_audit_logs (parent_id, viewed_at DESC);

-- Secondary lookup for the dedup query: "did we log a view of this
-- pathname by this next-gen within the last hour?" Composite + a
-- viewed_at sort key supports the WHERE clause efficiently.
CREATE INDEX IF NOT EXISTS shadow_audit_logs_dedup_idx
  ON shadow_audit_logs (parent_id, next_gen_id, pathname, viewed_at DESC);
