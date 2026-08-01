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
}

/** The block used both for the Settings preview and every sent email. */
export function buildSenderSignatureHtml(sender: SignatureSender, org: SignatureOrg): string {
  const phone = sender.phone?.trim() || org.phone?.trim() || ''
  const lines = [
    esc(sender.fullName),
    sender.jobTitle?.trim() ? esc(sender.jobTitle.trim()) : '',
    org.name ? esc(org.name) : '',
    phone ? esc(phone) : '',
    esc(org.email),
  ].filter(Boolean)
  return `<p>Kind regards,</p>\n    <p>${lines.join('<br>')}</p>`
}

export function buildSenderSignatureText(sender: SignatureSender, org: SignatureOrg): string {
  const phone = sender.phone?.trim() || org.phone?.trim() || ''
  const lines = [
    sender.fullName,
    sender.jobTitle?.trim() || '',
    org.name || '',
    phone,
    org.email,
  ].filter(Boolean)
  return `Kind regards,\n\n${lines.join('\n')}`
}
