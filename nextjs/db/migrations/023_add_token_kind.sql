-- Extend preview_tokens to also support pitch-deck links. Same audit
-- mechanics (label, expires_at, max_views, view_count, last_viewed_at,
-- revoked_at, created_by) — only difference is that deck tokens don't
-- need a demo_profile_id (they serve a static HTML deck, not a
-- read-only walkthrough of the live product).
--
-- New `kind` column with CHECK ensures we can't conflate the two at
-- runtime. demo_profile_id becomes nullable so deck rows don't need
-- to reference a profile that isn't relevant to them.

ALTER TABLE preview_tokens
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'preview'
    CHECK (kind IN ('preview', 'deck'));

ALTER TABLE preview_tokens
  ALTER COLUMN demo_profile_id DROP NOT NULL;

-- Belt-and-braces: every preview row should still have a demo profile.
-- This constraint enforces the invariant cleanly without forcing deck
-- rows to invent one.
ALTER TABLE preview_tokens
  ADD CONSTRAINT preview_tokens_kind_profile_check
    CHECK (kind = 'deck' OR demo_profile_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS preview_tokens_kind_idx
  ON preview_tokens (kind, created_at DESC);
