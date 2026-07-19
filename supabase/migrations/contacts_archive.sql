-- Soft-delete (archive) support for contacts.
-- Contacts with financial/job history (quotes, jobs, invoices, payments, visits,
-- conversations) cannot be hard-deleted because those FKs are RESTRICT — deleting
-- would orphan records we must keep for AU record-keeping. Instead we archive:
-- hide from lists/pipeline but preserve the row and all its history.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Partial index: the common query is "active contacts" (archived_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_contacts_active
  ON contacts (org_id, created_at DESC)
  WHERE archived_at IS NULL;

-- Rollback:
-- DROP INDEX IF EXISTS idx_contacts_active;
-- ALTER TABLE contacts DROP COLUMN IF EXISTS archived_at;
