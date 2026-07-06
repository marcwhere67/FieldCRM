-- Phase 7: Client documents / contracts per contact
-- Real file uploads (PDFs, images, docs) stored in a private Supabase Storage bucket,
-- with a metadata row per file linked to a contact. All storage access happens
-- server-side via the service role, so the bucket stays private and no storage.objects
-- RLS policies are required — API routes enforce auth + admin/manager role + org ownership.

CREATE TABLE IF NOT EXISTS client_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'document', -- contract, document, photo, report, other
  title text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL, -- path within the client-documents bucket
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members access client documents" ON client_documents;
CREATE POLICY "org members access client documents"
  ON client_documents FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON client_documents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON client_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_client_documents_contact ON client_documents (contact_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_org ON client_documents (org_id);

-- Private storage bucket. 25 MB per-file limit. Access is server-side (service role) only.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-documents', 'client-documents', false, 26214400)
ON CONFLICT (id) DO NOTHING;
