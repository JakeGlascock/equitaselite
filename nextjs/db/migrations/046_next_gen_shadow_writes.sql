-- P5e — permission tuning for next-gen seats while shadowing.
--
-- Today the shadow gate (lib/shadow.ts + middleware) hard-403s every
-- mutating /api/ call when the next-gen has a shadow cookie set. This
-- migration opens the door for two specific actions:
--   - posting in a deal room thread
--   - RSVPing to an event
-- ...both performed BY the next-gen but ON BEHALF OF the parent.
--
-- Attribution model:
--   - The row is written with user_id = the next-gen's actual id
--     (writes always anchor to the actual signed-in user; we never
--     impersonate the parent in identity-bearing columns).
--   - The new shadowed_parent_id column captures "this action was
--     taken while shadowing <parent>", which the UI uses to render
--     a "(on behalf of <parent>)" badge and the audit pipeline uses
--     to notify the parent.
--
-- Both columns are NULLable + ON DELETE SET NULL, so unlinking a
-- next-gen seat from a parent doesn't cascade-delete historical
-- attribution (parent_profile_id on profiles is the same shape).
-- Old rows from before this migration stay NULL — they were posted
-- by the user as themselves, not while shadowing, which is correct.

ALTER TABLE deal_messages
  ADD COLUMN IF NOT EXISTS shadowed_parent_id TEXT
    REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deal_messages_shadowed_parent_idx
  ON deal_messages (shadowed_parent_id)
  WHERE shadowed_parent_id IS NOT NULL;

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS shadowed_parent_id TEXT
    REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_rsvps_shadowed_parent_idx
  ON event_rsvps (shadowed_parent_id)
  WHERE shadowed_parent_id IS NOT NULL;

-- Extend notifications.type so the parent can be audited when a
-- next-gen acts on their behalf. 'next_gen_action' covers both deal
-- comments and event RSVPs — the body/link disambiguate the surface.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD  CONSTRAINT notifications_type_check
  CHECK (type IN (
    'intro_requested', 'intro_accepted', 'intro_declined',
    'deal_invitation', 'deal_interest',
    'deal_message',
    'next_gen_shadow',
    'next_gen_action'
  ));
