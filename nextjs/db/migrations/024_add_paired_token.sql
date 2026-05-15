-- Each deck token is paired with a preview token at mint time. When an
-- investor opens /deck/[token], the route handler substitutes the
-- __PREVIEW_URL__ placeholder in pitch.html with the paired preview's
-- /preview/[paired-token] URL — giving each recipient their own
-- read-only walkthrough of the platform with audit + revoke parity.
--
-- preview tokens never have a paired_token (a CHECK enforces this).
-- deck tokens have an optional paired_token (rendered URL falls back
-- to a static CTA when paired_token is NULL — e.g. for legacy deck
-- rows minted before this migration).
--
-- ON DELETE SET NULL on the FK: if the paired preview is ever hard-
-- deleted, the deck row survives and falls back to the static CTA.

ALTER TABLE preview_tokens
  ADD COLUMN IF NOT EXISTS paired_token TEXT
    REFERENCES preview_tokens(token) ON DELETE SET NULL;

ALTER TABLE preview_tokens
  ADD CONSTRAINT preview_tokens_paired_kind_check
    CHECK (kind = 'deck' OR paired_token IS NULL);

CREATE INDEX IF NOT EXISTS preview_tokens_paired_idx
  ON preview_tokens (paired_token)
  WHERE paired_token IS NOT NULL;
