-- ============================================================
-- Core table indexes (performance)  —  2026-07-17
-- ============================================================
-- The base schema (supabase/schema.sql) defines NO indexes on the core
-- tables. Every query filters by org_id (RLS does too), and the list pages
-- order by created_at / scheduled_start. Without indexes Postgres scans the
-- whole table each time — fine at low row counts, slow as data grows.
--
-- Non-destructive & reversible: only CREATE INDEX IF NOT EXISTS (adds nothing
-- to your data, changes no rows). Rollback block at the bottom (commented).
-- Feature tables added later (client_documents, job_notes, emails,
-- message_templates, gmail_sync_state) already have their own indexes — not
-- repeated here.
-- ============================================================

-- ---- Contacts: list (org + newest), status filter, pipeline board ----
CREATE INDEX IF NOT EXISTS idx_contacts_org_created   ON contacts (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_org_status    ON contacts (org_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline      ON contacts (pipeline_stage_id);

-- ---- Properties: looked up per contact ----
CREATE INDEX IF NOT EXISTS idx_properties_contact     ON properties (contact_id);
CREATE INDEX IF NOT EXISTS idx_properties_org         ON properties (org_id);

-- ---- Quotes: list, status filter, per-contact ----
CREATE INDEX IF NOT EXISTS idx_quotes_org_created     ON quotes (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_org_status      ON quotes (org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_contact         ON quotes (contact_id);

-- ---- Jobs: list, status filter, schedule (by start time), per-contact ----
CREATE INDEX IF NOT EXISTS idx_jobs_org_created       ON jobs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status        ON jobs (org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled     ON jobs (org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_contact           ON jobs (contact_id);

-- ---- Visits: schedule grid + per-job ----
CREATE INDEX IF NOT EXISTS idx_visits_org_scheduled   ON visits (org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_visits_job             ON visits (job_id);

-- ---- Invoices: list, status filter, per-contact, per-job ----
CREATE INDEX IF NOT EXISTS idx_invoices_org_created   ON invoices (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status    ON invoices (org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_contact       ON invoices (contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job           ON invoices (job_id);

-- ---- Payments: summed per invoice, listed per org ----
CREATE INDEX IF NOT EXISTS idx_payments_invoice       ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_created   ON payments (org_id, created_at DESC);

-- ---- Timesheets: per user + per job (payroll / job costing) ----
CREATE INDEX IF NOT EXISTS idx_timesheets_org_user    ON timesheets (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_job         ON timesheets (job_id);

-- ---- Expenses: per job (job costing) ----
CREATE INDEX IF NOT EXISTS idx_expenses_org           ON expenses (org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_job           ON expenses (job_id);

-- ---- Inbox: conversations by recent activity, messages per thread ----
CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON conversations (org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact  ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation  ON messages (conversation_id, sent_at);

-- ---- Campaigns: list + status ----
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status   ON campaigns (org_id, status);

-- ---- Reviews: per org, per contact/job ----
CREATE INDEX IF NOT EXISTS idx_reviews_org_created    ON reviews (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_contact        ON reviews (contact_id);

-- ---- Automation: engine filters + queue processor ----
CREATE INDEX IF NOT EXISTS idx_wf_exec_workflow       ON workflow_executions (workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_exec_org            ON workflow_executions (org_id);
CREATE INDEX IF NOT EXISTS idx_auto_queue_due         ON automation_queue (status, scheduled_for);

-- ---- Form submissions: per contact ----
CREATE INDEX IF NOT EXISTS idx_form_subs_contact      ON form_submissions (contact_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_org          ON form_submissions (org_id);


-- ============================================================
-- ROLLBACK (paste this block instead to undo everything above)
-- ============================================================
-- DROP INDEX IF EXISTS idx_contacts_org_created, idx_contacts_org_status, idx_contacts_pipeline,
--   idx_properties_contact, idx_properties_org,
--   idx_quotes_org_created, idx_quotes_org_status, idx_quotes_contact,
--   idx_jobs_org_created, idx_jobs_org_status, idx_jobs_org_scheduled, idx_jobs_contact,
--   idx_visits_org_scheduled, idx_visits_job,
--   idx_invoices_org_created, idx_invoices_org_status, idx_invoices_contact, idx_invoices_job,
--   idx_payments_invoice, idx_payments_org_created,
--   idx_timesheets_org_user, idx_timesheets_job,
--   idx_expenses_org, idx_expenses_job,
--   idx_conversations_org_last, idx_conversations_contact, idx_messages_conversation,
--   idx_campaigns_org_status,
--   idx_reviews_org_created, idx_reviews_contact,
--   idx_wf_exec_workflow, idx_wf_exec_org, idx_auto_queue_due,
--   idx_form_subs_contact, idx_form_subs_org;
