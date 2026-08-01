-- ============================================================
-- Track who sent each quote — 2026-08-01
-- ============================================================
-- The quote-acceptance confirmation email (sent when a customer approves a
-- quote on the public /quote-approval page) needs to know WHICH staff member
-- to credit in the signature — the person who actually sent that quote, not
-- an arbitrary "whichever Gmail is connected" guess. `quotes` had no record
-- of who sent it, so this adds one.
--
-- Nullable and non-destructive: existing quotes have no sender on record and
-- fall back to whichever Gmail account is connected for the org (unchanged
-- behaviour for anything sent before this column existed).
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- ROLLBACK (paste to undo)
-- ============================================================
-- ALTER TABLE quotes DROP COLUMN IF EXISTS sent_by;
