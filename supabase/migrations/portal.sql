-- Phase 25: Customer Portal

-- Add portal auth link to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS portal_auth_id uuid REFERENCES auth.users(id);

-- Allow portal users to read their own contact record
CREATE POLICY "portal users can read own contact"
  ON contacts FOR SELECT
  USING (portal_auth_id = auth.uid());

-- Allow portal users to update their own portal_auth_id (set on first login)
CREATE POLICY "portal users can update own portal_auth_id"
  ON contacts FOR UPDATE
  USING (portal_auth_id = auth.uid())
  WITH CHECK (portal_auth_id = auth.uid());

-- Allow portal users to read their quotes
CREATE POLICY "portal users can read own quotes"
  ON quotes FOR SELECT
  USING (
    contact_id IN (SELECT id FROM contacts WHERE portal_auth_id = auth.uid())
  );

-- Allow portal users to update quote status (approve)
CREATE POLICY "portal users can approve own quotes"
  ON quotes FOR UPDATE
  USING (
    contact_id IN (SELECT id FROM contacts WHERE portal_auth_id = auth.uid())
  )
  WITH CHECK (
    contact_id IN (SELECT id FROM contacts WHERE portal_auth_id = auth.uid())
  );

-- Allow portal users to read their jobs
CREATE POLICY "portal users can read own jobs"
  ON jobs FOR SELECT
  USING (
    contact_id IN (SELECT id FROM contacts WHERE portal_auth_id = auth.uid())
  );

-- Allow portal users to read their invoices
CREATE POLICY "portal users can read own invoices"
  ON invoices FOR SELECT
  USING (
    contact_id IN (SELECT id FROM contacts WHERE portal_auth_id = auth.uid())
  );
