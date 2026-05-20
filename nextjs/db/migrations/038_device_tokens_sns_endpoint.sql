-- AWS SNS Mobile Push integration (Phase M2 transport).
--
-- Each device token gets a corresponding SNS Platform Endpoint ARN.
-- Created at /api/devices/register time so the per-send hot path is a
-- single SNS Publish call against a known ARN rather than an endpoint
-- lookup-or-create round-trip. Nullable because:
--   - the column was added after rows already existed
--   - stub-mode (PUSH_PROVIDER unset) registers without ever calling SNS
--   - if CreatePlatformEndpoint fails at register time we still keep the
--     token row and retry on next register; lib/push handles NULL by
--     skipping that row with a warning

ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS sns_endpoint_arn TEXT;
