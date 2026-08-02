// Pure signature formatting — zero I/O, safe to import from client
// components (e.g. the Settings → Profile live preview) as well as server
// routes. Kept separate from signature.ts, which additionally imports
// lib/gmail.ts (service-role Supabase client) and must never reach the browser.
import { esc } from './shell'

export interface SignatureSender {
  fullName: string
  jobTitle?: string | null
  phone?: string | null
}

export interface SignatureOrg {
  name: string | null
  phone: string | null
  email: string
  website?: string | null
  instagramUrl?: string | null
  /** NOT rendered by buildSenderSignatureHtml (kept on the type since
   * signature.ts still threads org.logoUrl through to the custom-template
   * renderer, where a user can opt in via the {{logo}} merge field). The
   * CRM-built default signature omits it — every email now has a header
   * banner (see shell.ts) carrying the org logo once; repeating it here
   * would just stack a second copy directly below the first. */
  logoUrl?: string | null
}

/**
 * `esc()` covers text content; attribute values also need quotes escaped.
 * Exported: also used by custom-signature.ts to build the same safe
 * href/src attributes for the free-form signature editor's merge fields.
 */
export function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;')
}

/** Adds a protocol if the admin typed a bare domain/handle URL. */
export function ensureHref(url: string): string {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** "https://www.saltaircleaning.com.au/" -> "saltaircleaning.com.au" for display. */
export function cleanUrlDisplay(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
}

/** Extracts "@handle" from a typical instagram.com/<handle> URL, else falls back to the cleaned URL. */
export function instagramHandle(url: string): string {
  const match = url.trim().match(/instagram\.com\/([^/?#]+)/i)
  return match ? `@${match[1]}` : cleanUrlDisplay(url)
}

/**
 * The block used both for the Settings preview and every sent email.
 * Layout: Name / Job title / Org name (plain lines), then labelled contact
 * details — Phone: / Email: / Website: / Instagram: — each shown only when
 * present. Website and Instagram are clickable links in the HTML version.
 */
export function buildSenderSignatureHtml(sender: SignatureSender, org: SignatureOrg): string {
  const phone = sender.phone?.trim() || org.phone?.trim() || ''

  const nameLines = [
    esc(sender.fullName),
    sender.jobTitle?.trim() ? esc(sender.jobTitle.trim()) : '',
    org.name ? esc(org.name) : '',
  ].filter(Boolean)

  const contactLines: string[] = []
  if (phone) contactLines.push(`Phone: ${esc(phone)}`)
  if (org.email) contactLines.push(`Email: ${esc(org.email)}`)
  if (org.website?.trim()) {
    contactLines.push(`Website: <a href="${escAttr(ensureHref(org.website))}">${esc(cleanUrlDisplay(org.website))}</a>`)
  }
  if (org.instagramUrl?.trim()) {
    contactLines.push(`Instagram: <a href="${escAttr(ensureHref(org.instagramUrl))}">${esc(instagramHandle(org.instagramUrl))}</a>`)
  }

  return `<p>Kind regards,</p>\n    <p>${[...nameLines, ...contactLines].join('<br>')}</p>`
}

export function buildSenderSignatureText(sender: SignatureSender, org: SignatureOrg): string {
  const phone = sender.phone?.trim() || org.phone?.trim() || ''

  const nameLines = [sender.fullName, sender.jobTitle?.trim() || '', org.name || ''].filter(Boolean)

  const contactLines: string[] = []
  if (phone) contactLines.push(`Phone: ${phone}`)
  if (org.email) contactLines.push(`Email: ${org.email}`)
  if (org.website?.trim()) contactLines.push(`Website: ${ensureHref(org.website)}`)
  if (org.instagramUrl?.trim()) contactLines.push(`Instagram: ${ensureHref(org.instagramUrl)}`)

  return `Kind regards,\n\n${[...nameLines, ...contactLines].join('\n')}`
}
