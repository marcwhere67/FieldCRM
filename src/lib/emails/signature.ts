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

export { buildSenderSignatureHtml, buildSenderSignatureText, type SignatureSender, type SignatureOrg } from './signature-format'

/**
 * Resolves the signature for an email sent by a logged-in staff member: the
 * CRM-built one (name / job title / phone) first, since it's reliably tied to
 * the actual sender regardless of which mailbox is used to send it. Falls
 * back to the connected Gmail account's own signature only if the sender has
 * no name on file — kept for defensiveness, though `users.full_name` is
 * NOT NULL so this branch is not expected to run in practice.
 *
 * website/instagram_url are fetched here (not required from the caller's
 * `org` param) because they ship via a migration
 * (supabase/migrations/user_email_signature.sql) that may not be applied to
 * every environment yet. Isolating the fetch means a missing column just
 * omits those two lines — it can never break an actual quote/invoice send.
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
    const [{ data: emp }, socials] = await Promise.all([
      supabase.from('employee_profiles').select('job_title').eq('user_id', profileId).maybeSingle(),
      supabase.from('organisations').select('website, instagram_url').eq('id', orgId).single(),
    ])
    const website = socials.error ? null : socials.data?.website ?? null
    const instagramUrl = socials.error ? null : socials.data?.instagram_url ?? null
    return buildSenderSignatureHtml(
      { fullName: user.full_name, jobTitle: emp?.job_title ?? null, phone: user.phone },
      { ...org, website, instagramUrl },
    )
  }

  return getGmailSignature(accessToken)
}
