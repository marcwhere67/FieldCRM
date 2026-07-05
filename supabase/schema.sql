-- FieldCRM Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANISATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organisations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  abn text,
  phone text,
  email text,
  address text,
  logo_url text,
  stripe_account_id text,
  twilio_subaccount_sid text,
  default_payment_terms_days int DEFAULT 14,
  timezone text DEFAULT 'Australia/Melbourne',
  subscription_plan text DEFAULT 'starter'
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','manager','field')),
  phone text,
  avatar_url text,
  hourly_rate numeric(10,2),
  is_active bool DEFAULT true,
  supabase_auth_id uuid REFERENCES auth.users(id)
);

-- ============================================================
-- PIPELINE STAGES (referenced by contacts)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  pipeline_type text NOT NULL DEFAULT 'leads'
);

-- ============================================================
-- CAMPAIGNS (referenced by contacts)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'draft',
  subject text,
  content text,
  audience_filters jsonb DEFAULT '{}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int DEFAULT 0,
  open_count int DEFAULT 0,
  click_count int DEFAULT 0,
  reply_count int DEFAULT 0
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  company_name text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  country text DEFAULT 'Australia',
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','prospect','active','inactive','archived')),
  source text,
  source_campaign_id uuid REFERENCES campaigns(id),
  pipeline_stage_id uuid REFERENCES pipeline_stages(id),
  tags text[] DEFAULT '{}',
  custom_fields jsonb DEFAULT '{}',
  lifetime_value numeric(12,2) DEFAULT 0,
  notes text,
  assigned_to uuid REFERENCES users(id),
  last_contacted_at timestamptz,
  do_not_contact bool DEFAULT false
);

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label text DEFAULT 'Home',
  address_line1 text NOT NULL,
  address_line2 text,
  suburb text NOT NULL,
  state text NOT NULL,
  postcode text NOT NULL,
  lat numeric(10,7),
  lng numeric(10,7),
  access_notes text,
  gate_code text
);

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'job',
  tax_rate numeric(5,2) DEFAULT 10.0,
  is_active bool DEFAULT true
);

-- ============================================================
-- QUOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  property_id uuid REFERENCES properties(id),
  quote_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','approved','declined','expired','converted')),
  line_items jsonb DEFAULT '[]',
  subtotal numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  notes text,
  internal_notes text,
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  signature_url text,
  converted_to_job_id uuid,
  pdf_url text,
  declined_at timestamptz,
  notes_client text,
  notes_internal text,
  deposit_type text NOT NULL DEFAULT 'none' CHECK (deposit_type IN ('none','percentage','fixed')),
  deposit_value numeric(10,2) NOT NULL DEFAULT 0,
  deposit_amount numeric(10,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  property_id uuid REFERENCES properties(id),
  quote_id uuid REFERENCES quotes(id),
  job_number text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  job_type text NOT NULL DEFAULT 'one_off',
  recurrence_rule text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','in_progress','completed','cancelled','invoiced','paid')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  assigned_users uuid[] DEFAULT '{}',
  checklist jsonb DEFAULT '[]',
  instructions text,
  photos jsonb DEFAULT '[]',
  materials_used jsonb DEFAULT '[]',
  total_hours numeric(6,2),
  invoice_id uuid,
  source_lead_id uuid REFERENCES contacts(id)
);

-- Add forward ref after jobs table exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_quotes_converted_to_job') THEN
    ALTER TABLE quotes ADD CONSTRAINT fk_quotes_converted_to_job FOREIGN KEY (converted_to_job_id) REFERENCES jobs(id);
  END IF;
END $$;

-- ============================================================
-- VISITS
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  property_id uuid REFERENCES properties(id),
  visit_number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','skipped')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  assigned_users uuid[] DEFAULT '{}',
  notes text
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  job_id uuid REFERENCES jobs(id),
  invoice_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','partial','paid','overdue','void')),
  line_items jsonb DEFAULT '[]',
  subtotal numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  stripe_payment_intent_id text,
  pdf_url text,
  notes text,
  invoice_type text NOT NULL DEFAULT 'standard' CHECK (invoice_type IN ('standard','deposit','final')),
  deposit_credit numeric(12,2) NOT NULL DEFAULT 0,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  stripe_payment_link text
);

-- Add forward ref on jobs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_jobs_invoice') THEN
    ALTER TABLE jobs ADD CONSTRAINT fk_jobs_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id);
  END IF;
END $$;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  contact_id uuid NOT NULL REFERENCES contacts(id),
  amount numeric(12,2) NOT NULL,
  method text NOT NULL,
  stripe_payment_intent_id text,
  receipt_number text UNIQUE,
  receipt_pdf_url text,
  recorded_at timestamptz DEFAULT now(),
  recorded_by uuid REFERENCES users(id)
);

-- ============================================================
-- TIMESHEETS
-- ============================================================
CREATE TABLE IF NOT EXISTS timesheets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  job_id uuid REFERENCES jobs(id),
  visit_id uuid REFERENCES visits(id),
  clocked_in_at timestamptz NOT NULL,
  clocked_out_at timestamptz,
  clock_in_lat numeric(10,7),
  clock_in_lng numeric(10,7),
  clock_out_lat numeric(10,7),
  clock_out_lng numeric(10,7),
  clock_in_address text,
  clock_out_address text,
  total_minutes int,
  notes text,
  approved bool DEFAULT false,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  channel text NOT NULL CHECK (channel IN ('sms','email','facebook_dm','instagram_dm','whatsapp','live_chat','call')),
  external_thread_id text,
  status text DEFAULT 'open',
  assigned_to uuid REFERENCES users(id),
  last_message_at timestamptz,
  unread_count int DEFAULT 0
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  content text NOT NULL,
  media_urls text[] DEFAULT '{}',
  sent_by uuid REFERENCES users(id),
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  external_message_id text,
  is_automated bool DEFAULT false,
  automation_workflow_id uuid
);

-- ============================================================
-- WORKFLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active bool DEFAULT true,
  trigger_type text NOT NULL,
  trigger_conditions jsonb DEFAULT '{}',
  steps jsonb DEFAULT '[]',
  stats jsonb DEFAULT '{}'
);

-- ============================================================
-- WORKFLOW EXECUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id),
  contact_id uuid REFERENCES contacts(id),
  job_id uuid REFERENCES jobs(id),
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  steps_completed int DEFAULT 0,
  error text
);

-- ============================================================
-- AUTOMATION QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflows(id),
  execution_id uuid REFERENCES workflow_executions(id),
  contact_id uuid REFERENCES contacts(id),
  step_index int NOT NULL DEFAULT 0,
  step_config jsonb DEFAULT '{}',
  scheduled_for timestamptz NOT NULL,
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
);

-- ============================================================
-- CALL TRACKING NUMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS call_tracking_numbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id),
  phone_number text NOT NULL,
  twilio_sid text,
  label text,
  total_calls int DEFAULT 0
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id),
  job_id uuid REFERENCES jobs(id),
  platform text NOT NULL,
  rating int CHECK (rating BETWEEN 1 AND 5),
  content text,
  author_name text,
  external_review_id text,
  response text,
  responded_at timestamptz,
  ai_response_draft text,
  received_at timestamptz DEFAULT now()
);

-- ============================================================
-- FORMS
-- ============================================================
CREATE TABLE IF NOT EXISTS forms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  fields jsonb DEFAULT '[]',
  submit_workflow_id uuid REFERENCES workflows(id),
  embed_code text,
  short_url text,
  submission_count int DEFAULT 0
);

-- ============================================================
-- FORM SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES forms(id),
  contact_id uuid REFERENCES contacts(id),
  data jsonb DEFAULT '{}',
  submitted_at timestamptz DEFAULT now(),
  source_url text,
  utm_source text,
  utm_campaign text
);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id),
  category text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL,
  tax_included bool DEFAULT true,
  receipt_url text,
  recorded_by uuid REFERENCES users(id),
  expense_date date DEFAULT CURRENT_DATE
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organisations','users','pipeline_stages','campaigns','contacts','properties',
    'services','quotes','jobs','visits','invoices','payments','timesheets',
    'conversations','messages','workflows','workflow_executions','automation_queue',
    'call_tracking_numbers','reviews','forms','form_submissions','expenses'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organisations','users','pipeline_stages','campaigns','contacts','properties',
    'services','quotes','jobs','visits','invoices','payments','timesheets',
    'conversations','messages','workflows','workflow_executions','automation_queue',
    'call_tracking_numbers','reviews','forms','form_submissions','expenses'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END;
$$;

-- Helper function: get org_id for the authenticated user
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get role for the authenticated user
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text AS $$
  SELECT role FROM users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organisations: users can only see their own org
CREATE POLICY "org_select" ON organisations FOR SELECT
  USING (id = auth_user_org_id());

CREATE POLICY "org_update" ON organisations FOR UPDATE
  USING (id = auth_user_org_id() AND auth_user_role() = 'admin');

-- Generic org-scoped policy macro for other tables
-- We'll create select/insert/update/delete for each table

-- Users
CREATE POLICY "users_select" ON users FOR SELECT USING (org_id = auth_user_org_id());
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (org_id = auth_user_org_id() AND auth_user_role() IN ('admin','manager'));
CREATE POLICY "users_update" ON users FOR UPDATE USING (org_id = auth_user_org_id() AND auth_user_role() IN ('admin','manager'));
CREATE POLICY "users_delete" ON users FOR DELETE USING (org_id = auth_user_org_id() AND auth_user_role() = 'admin');

-- Macro for standard tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'pipeline_stages','campaigns','contacts','properties','services','quotes',
    'jobs','visits','invoices','payments','timesheets','conversations','messages',
    'workflows','workflow_executions','automation_queue','call_tracking_numbers',
    'reviews','forms','form_submissions','expenses'
  ]) LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON %I FOR SELECT USING (org_id = auth_user_org_id());
      CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (org_id = auth_user_org_id());
      CREATE POLICY "%s_update" ON %I FOR UPDATE USING (org_id = auth_user_org_id());
      CREATE POLICY "%s_delete" ON %I FOR DELETE USING (org_id = auth_user_org_id());
    ', t, t, t, t, t, t, t, t);
  END LOOP;
END;
$$;
