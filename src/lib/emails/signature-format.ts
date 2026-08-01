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
  /** When set, rendered at the top of the signature block. Every email uses
   * the same structure: logo lives IN the signature, not in a separate
   * top-of-email header — so this is the only place a logo appears. */
  logoUrl?: string | null
}

/** `esc()` covers text content; attribute values also need quotes escaped. */
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;')
}

/** Adds a protocol if the admin typed a bare domain/handle URL. */
function ensureHref(url: string): string {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** "https://www.saltaircleaning.com.au/" -> "saltaircleaning.com.au" for display. */
function cleanUrlDisplay(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
}

/** Extracts "@handle" from a typical instagram.com/<handle> URL, else falls back to the cleaned URL. */
function instagramHandle(url: string): string {
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

  // height must be in the inline style, not just the bare HTML attribute —
  // a bare `height="32"` can be overridden by a page-level CSS reset (e.g.
  // Tailwind preflight's `img { height: auto }`), rendering the logo at full
  // natural size instead of a compact signature mark.
  const logo = org.logoUrl?.trim()
    ? `<p><img src="${escAttr(org.logoUrl.trim())}" alt="${org.name ? esc(org.name) : 'logo'}" height="32" style="display:block;height:32px;width:auto;margin-bottom:4px;" /></p>\n    `
    : ''

  return `${logo}<p>Kind regards,</p>\n    <p>${[...nameLines, ...contactLines].join('<br>')}</p>`
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
