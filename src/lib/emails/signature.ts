// Resolves the per-sender email signature for an actual send. The pure
// formatting logic lives in signature-format.ts (client-safe, no I/O); this
// file additionally talks to Supabase and Gmail, so it must only be imported
// from server code (route handlers), never from a 'use client' component.
//
// WHY this exists (2026-08-01): these emails used to fetch whichever
// signature was CURRENTLY configured in the connected Gmail account's own
// settings (getGmailSignature). That works when one person owns the mailbox,
// but Salt Air shares a single hello@ login between two staff members —
// Gmail's signature is a property of the MAILBOX, not of who's logged into
// the CRM, so every automated send showed whoever last edited it in Gmail,
// not whoever actually sent the email. This signature is built from CRM data
// instead, keyed to the real sender.
import { SupabaseClient } from '@supabase/supabase-js'
import { getGmailSignature } from '@/lib/gmail'
import { buildSenderSignatureHtml, type SignatureOrg } from './signature-format'
import { renderCustomSignatureHtml } from './custom-signature'

export { buildSenderSignatureHtml, buildSenderSignatureText, type SignatureSender, type SignatureOrg } from './signature-format'

/**
 * Resolves the signature for an email sent by a logged-in staff member.
 * Priority order:
 *   1. The sender's own free-form template (custom-signature.ts), if they've
 *      written one in Settings → Profile.
 *   2. The CRM-built one (name / job title / phone) — reliably tied to the
 *      actual sender regardless of which mailbox is used to send it.
 *   3. The connected Gmail account's own signature — kept for defensiveness
 *      only; not expected to run since `users.full_name` is NOT NULL.
 *
 * website/instagram_url/email_signature_template are fetched here (not
 * required from the caller's `org` param) because they ship via migrations
 * that may not be applied to every environment yet. Isolating the fetch
 * means a missing column just falls back a step — it can never break an
 * actual quote/invoice send.
 */
export async function resolveSenderSignatureHtml(
  supabase: SupabaseClient,
  profileId: string,
  orgId: string,
  accessToken: string,
  org: SignatureOrg,
): Promise<string | null> {
  const { data: user } = await supabase
    .from('users').select('full_name, phone').eq('id', profileId).single()

  if (user?.full_name) {
    const [{ data: emp }, socials, customTemplate] = await Promise.all([
      supabase.from('employee_profiles').select('job_title').eq('user_id', profileId).maybeSingle(),
      supabase.from('organisations').select('website, instagram_url').eq('id', orgId).single(),
      supabase.from('users').select('email_signature_template').eq('id', profileId).single(),
    ])
    const website = socials.error ? null : socials.data?.website ?? null
    const instagramUrl = socials.error ? null : socials.data?.instagram_url ?? null
    const template = customTemplate.error ? null : customTemplate.data?.email_signature_template ?? null
    const jobTitle = emp?.job_title ?? null
    const phone = user.phone ?? org.phone

    if (template?.trim()) {
      return renderCustomSignatureHtml(template, {
        fullName: user.full_name, jobTitle, phone,
        businessName: org.name, email: org.email, website, instagramUrl, logoUrl: org.logoUrl ?? null,
      })
    }

    return buildSenderSignatureHtml(
      { fullName: user.full_name, jobTitle, phone: user.phone },
      { ...org, website, instagramUrl },
    )
  }

  return getGmailSignature(accessToken)
}
