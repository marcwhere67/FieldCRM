-- ============================================================
-- Email signature details  —  2026-07-26
-- ============================================================
-- Client emails are now signed by whoever actually sent them. Previously the
-- signature was read from Gmail, which picked up the shared hello@ alias (and
-- therefore a colleague's signature) regardless of who clicked send.
--
-- The per-person parts already exist and need no new columns:
--   users.full_name, users.phone, employee_profiles.job_title
--
-- This migration only adds the SHARED business details that sit under every
-- signature. They also replace a hard-coded saltaircleaning.com.au constant in
-- src/lib/emails/shell.ts, so other orgs get their own details rather than
-- Salt Air's.
--
-- Resolution order at send time:
--   1. the built signature (sender's name/title/phone + these business details)
--   2. their connected Gmail account's own signature
--   3. the generic "Kind regards, <name>" sign-off
--
-- Non-destructive and reversible — three nullable columns, no RLS change
-- (organisations already has an admin-only update policy).
-- ============================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS service_area text;

-- Seed Salt Air's current details so signatures are complete immediately.
UPDATE organisations
SET website      = COALESCE(website, 'https://saltaircleaning.com.au'),
    instagram_url = COALESCE(instagram_url, 'https://www.instagram.com/saltaircleaning'),
    service_area  = COALESCE(service_area, 'Servicing Bass Coast, VIC')
WHERE email = 'hello@saltaircleaning.com.au';


-- ============================================================
-- ROLLBACK (paste to undo)
-- ============================================================
-- ALTER TABLE organisations DROP COLUMN IF EXISTS website;
-- ALTER TABLE organisations DROP COLUMN IF EXISTS instagram_url;
-- ALTER TABLE organisations DROP COLUMN IF EXISTS service_area;
