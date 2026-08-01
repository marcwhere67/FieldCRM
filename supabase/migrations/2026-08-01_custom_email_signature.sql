-- ============================================================
-- Per-user custom email signature template — 2026-08-01
-- ============================================================
-- Lets each staff member write their own free-form signature (with
-- {{merge_field}} placeholders for name/phone/business details/logo/etc.)
-- instead of the CRM's auto-built one. Empty/null means "use the auto-built
-- signature" — the existing behaviour is the default, nothing changes for a
-- user who never sets this.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature_template text;

-- ============================================================
-- ROLLBACK (paste to undo)
-- ============================================================
-- ALTER TABLE users DROP COLUMN IF EXISTS email_signature_template;
