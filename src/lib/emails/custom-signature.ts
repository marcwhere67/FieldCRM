// Free-form, per-user email signature templates. A staff member writes their
// own signature text with {{merge_field}} placeholders (same {{snake_case}}
// convention and substitution engine as message templates — see
// src/lib/templates.ts) instead of using the CRM's auto-built signature
// (signature-format.ts). Empty/unset means "use the auto-built one" — this
// is purely additive, opt-in per person.
//
// Only the HTML renderer is needed: the plain-text half of every email is
// already derived by stripping the final signature HTML (htmlSignatureToText
// in shell.ts), so a custom template's text version falls out for free.
import { renderTemplate } from '@/lib/templates'
import { esc } from './shell'
import { escAttr, ensureHref, cleanUrlDisplay, instagramHandle } from './signature-format'

export interface SignatureVariable {
  key: string
  label: string
  sample: string
}

// Palette shown in the signature editor. Kept separate from the shared
// TEMPLATE_VARIABLES catalog (src/lib/templates.ts) — that one describes
// CUSTOMER-facing message templates (quote/invoice/appointment); this one
// describes the SENDER's own identity, a different concern with different
// (and in one case colliding — "job_title" means something else there) keys.
export const SIGNATURE_VARIABLES: SignatureVariable[] = [
  { key: 'full_name', label: 'Your name', sample: "Marc O'Hare" },
  { key: 'job_title', label: 'Your job title', sample: 'Co-Founder' },
  { key: 'phone', label: 'Your phone', sample: '0400 000 000' },
  { key: 'business_name', label: 'Business name', sample: 'Salt Air Cleaning' },
  { key: 'email', label: 'Business email', sample: 'hello@saltaircleaning.com.au' },
  { key: 'website', label: 'Website (as a link)', sample: 'saltaircleaning.com.au' },
  { key: 'instagram', label: 'Instagram (as a link)', sample: '@saltaircleaning' },
  { key: 'logo', label: 'Business logo', sample: '[logo image]' },
]

export interface SignatureRenderInput {
  fullName: string
  jobTitle: string | null
  /** Already resolved — sender's own phone, or the org phone as fallback. */
  phone: string | null
  businessName: string | null
  email: string
  website: string | null
  instagramUrl: string | null
  logoUrl: string | null
}

/**
 * Renders a free-form signature template to HTML. The literal text the user
 * typed is escaped (so a stray `<`/`&` can't break the email), then merge
 * fields are substituted with pre-built, already-safe HTML fragments
 * (escaped hrefs/alt text) — matching the same escaping discipline as the
 * auto-built signature in signature-format.ts.
 */
export function renderCustomSignatureHtml(template: string, input: SignatureRenderInput): string {
  const escapedTemplate = esc(template).replace(/\n/g, '<br>')

  const website = input.website?.trim()
    ? `<a href="${escAttr(ensureHref(input.website))}">${esc(cleanUrlDisplay(input.website))}</a>`
    : ''
  const instagram = input.instagramUrl?.trim()
    ? `<a href="${escAttr(ensureHref(input.instagramUrl))}">${esc(instagramHandle(input.instagramUrl))}</a>`
    : ''
  const logo = input.logoUrl?.trim()
    ? `<img src="${escAttr(input.logoUrl.trim())}" alt="${input.businessName ? esc(input.businessName) : 'logo'}" height="32" style="display:block;height:32px;width:auto;margin-top:8px;" />`
    : ''

  return renderTemplate(escapedTemplate, {
    full_name: esc(input.fullName),
    job_title: input.jobTitle?.trim() ? esc(input.jobTitle.trim()) : '',
    phone: input.phone?.trim() ? esc(input.phone.trim()) : '',
    business_name: input.businessName ? esc(input.businessName) : '',
    email: esc(input.email),
    website,
    instagram,
    logo,
  })
}
