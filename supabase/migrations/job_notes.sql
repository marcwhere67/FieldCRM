-- Item 9: Job notes and photos with completion reports

CREATE TABLE IF NOT EXISTS job_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'text', -- text, photo, signature
  content text, -- text notes or photo file path
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_name text -- denormalized for PDF generation
);

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members access job notes" ON job_notes;
CREATE POLICY "org members access job notes"
  ON job_notes FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON job_notes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_job_notes_job ON job_notes (job_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_org ON job_notes (org_id);

-- Photo storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('job-photos', 'job-photos', false, 52428800)
ON CONFLICT (id) DO NOTHING;
