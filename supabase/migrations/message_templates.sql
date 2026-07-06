-- Phase 13/6: Email & SMS message templates
-- A reusable library of email + SMS templates. System templates carry a stable
-- `template_key` so route handlers can look them up (e.g. quote_sent, quote_followup)
-- and fall back to hardcoded copy when no row exists. User-created templates have a
-- null key.

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  category text NOT NULL DEFAULT 'custom', -- quote, invoice, appointment, general, custom
  template_key text, -- stable key for system templates (quote_sent, quote_followup, ...)
  name text NOT NULL,
  subject text, -- email only
  body text NOT NULL,
  is_active bool DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  -- one row per system key per org
  UNIQUE (org_id, template_key)
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage message templates" ON message_templates;
CREATE POLICY "org members can manage message templates"
  ON message_templates FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON message_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_message_templates_org ON message_templates (org_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_key ON message_templates (org_id, template_key);

-- ------------------------------------------------------------
-- Seed the two existing hardcoded SMS messages as editable
-- system templates for every existing organisation.
-- ------------------------------------------------------------
INSERT INTO message_templates (org_id, channel, category, template_key, name, body)
SELECT o.id, 'sms', 'quote', 'quote_sent', 'Quote sent',
  'Hi {{first_name}}, your quote {{quote_number}} from {{business_name}} is ready to view: {{quote_url}}'
FROM organisations o
ON CONFLICT (org_id, template_key) DO NOTHING;

INSERT INTO message_templates (org_id, channel, category, template_key, name, body)
SELECT o.id, 'sms', 'quote', 'quote_followup', 'Quote follow-up (48h)',
  'Hi {{first_name}}, just checking in on quote {{quote_number}} from {{business_name}} — {{quote_url}}. Let us know if you have any questions!'
FROM organisations o
ON CONFLICT (org_id, template_key) DO NOTHING;
