-- Per-property procedure notes: property-specific quirks pinned to a procedure step
-- (e.g. "BBQ key in 3rd drawer", "gate code 4821"). Shown inline to techs on the job
-- checklist. Both admins and techs (any org member) can add/edit — organic knowledge capture.

CREATE TABLE IF NOT EXISTS property_procedure_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES procedure_steps(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (property_id, step_id)
);

ALTER TABLE property_procedure_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members access property procedure notes" ON property_procedure_notes;
CREATE POLICY "org members access property procedure notes"
  ON property_procedure_notes FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON property_procedure_notes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON property_procedure_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_property_procedure_notes_property ON property_procedure_notes (property_id);
CREATE INDEX IF NOT EXISTS idx_property_procedure_notes_org ON property_procedure_notes (org_id);

-- ------------------------------------------------------------
-- ROLLBACK:
-- DROP TABLE IF EXISTS property_procedure_notes;
-- ------------------------------------------------------------
