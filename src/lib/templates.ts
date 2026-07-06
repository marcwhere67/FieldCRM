// Message template rendering — shared by email + SMS across the app.
// Convention: {{variable_name}} placeholders, matching the automation engine.

export type TemplateVars = Record<string, string | number | null | undefined>

// Every variable the template system knows about, grouped for the editor UI.
// `sample` drives the live preview.
export const TEMPLATE_VARIABLES: { key: string; label: string; sample: string; groups: string[] }[] = [
  { key: 'first_name',      label: 'Contact first name', sample: 'Jane',                         groups: ['quote', 'invoice', 'appointment', 'general', 'custom'] },
  { key: 'last_name',       label: 'Contact last name',  sample: 'Smith',                        groups: ['quote', 'invoice', 'appointment', 'general', 'custom'] },
  { key: 'business_name',   label: 'Your business name', sample: 'Salt Air Cleaning',            groups: ['quote', 'invoice', 'appointment', 'general', 'custom'] },
  { key: 'quote_number',    label: 'Quote number',       sample: 'Q-2026-014',                   groups: ['quote'] },
  { key: 'quote_url',       label: 'Quote approval link', sample: 'https://app/quote-approval/…', groups: ['quote'] },
  { key: 'invoice_number',  label: 'Invoice number',     sample: 'INV-2026-031',                 groups: ['invoice'] },
  { key: 'invoice_total',   label: 'Invoice total',      sample: '$495',                         groups: ['invoice'] },
  { key: 'invoice_url',     label: 'Invoice link',       sample: 'https://app/invoice/…',        groups: ['invoice'] },
  { key: 'job_title',       label: 'Job title',          sample: 'Deep Clean',                   groups: ['appointment'] },
  { key: 'job_date',        label: 'Job date',           sample: 'Mon 13 Jul',                   groups: ['appointment'] },
  { key: 'job_time',        label: 'Job time',           sample: '9:00am',                       groups: ['appointment'] },
]

// Replace all {{key}} occurrences. Unknown placeholders are left blank so we never
// leak raw {{tokens}} to a customer.
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const v = vars[key.toLowerCase()]
    return v === null || v === undefined ? '' : String(v)
  })
}

// Variables available to a given template category, for the editor's variable palette.
export function variablesForCategory(category: string) {
  return TEMPLATE_VARIABLES.filter(v => v.groups.includes(category))
}

// Minimal shape of the supabase client method we use — keeps this file server/client agnostic.
interface TemplateQueryable {
  from: (table: string) => any
}

// Fetch a system template's rendered body by key, falling back to hardcoded copy when the
// row is missing (e.g. migration not yet applied). Never throws — sending must not break.
export async function resolveSystemTemplate(
  supabase: TemplateQueryable,
  orgId: string,
  key: string,
  vars: TemplateVars,
  fallback: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from('message_templates')
      .select('subject, body')
      .eq('org_id', orgId)
      .eq('template_key', key)
      .maybeSingle()
    return renderTemplate(data?.body || fallback, vars)
  } catch {
    return renderTemplate(fallback, vars)
  }
}
