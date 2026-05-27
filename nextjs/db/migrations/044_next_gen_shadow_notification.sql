-- P5b: extend notifications.type CHECK so the parent can be told when
-- a linked next-gen begins a shadow-view session.
--
-- The shadow session itself doesn't write a row beyond the notification —
-- the cookie is the session state, the notification is the audit trail.
-- Per-view logging (each page load) is intentionally NOT done in v1:
-- one row per enable keeps notification volume sane, and a parent who
-- wants finer-grained audit can be addressed later if it matters.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD  CONSTRAINT notifications_type_check
  CHECK (type IN (
    'intro_requested', 'intro_accepted', 'intro_declined',
    'deal_invitation', 'deal_interest',
    'deal_message',
    'next_gen_shadow'
  ));
