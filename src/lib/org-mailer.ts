import { SupabaseClient } from '@supabase/supabase-js'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { shellHtml, signoffText, type EmailShell } from '@/lib/emails/shell'
import { resolveSenderSignatureHtml } from '@/lib/emails/signature'

// Shared lookup: any Gmail account connected for the org, from a context with
// no logged-in user (public routes, cron). Returns null if Gmail isn't
// connected or org email is missing — callers treat that as "can't send".
// `userId` is the CRM user that connected the token — used as the signature
// identity when the caller has no more specific sender to credit.
async function resolveOrgGmail(supabase: SupabaseClient, orgId: string) {
  const { data: org } = await supabase
    .from('organisations').select('name, email, phone').eq('id', orgId).single()
  if (!org?.email) return null

  const { data: connected } = await supabase
    .from('gmail_sync_state').select('user_id').eq('org_id', orgId).limit(1).maybeSingle()
  if (!connected?.user_id) return null

  const token = await getGmailAccessToken(orgId, connected.user_id).catch(() => null)
  if (!token) return null

  return {
    token, userId: connected.user_id as string,
    orgName: org.name?.trim() || 'FieldCRM', orgEmail: org.email, orgPhone: org.phone as string | null,
  }
}

// Sends mail "as the business" from a context with no logged-in user (public
// routes, cron). Best-effort by design: returns false rather than throwing, so a
// failed notification can never break the customer-facing action that triggered it.
//
// No personal signature here: this is for INTERNAL/ops alerts (e.g. "quote
// accepted" going to the org's own inbox), which don't need branding — the
// body itself should carry whatever business sign-off is appropriate. For a
// CUSTOMER-facing email, use sendBrandedAsOrg instead.
export async function sendAsOrg(
  supabase: SupabaseClient,
  orgId: string,
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
): Promise<boolean> {
  try {
    const gmail = await resolveOrgGmail(supabase, orgId)
    if (!gmail) return false

    const from = `"${gmail.orgName.replace(/"/g, '')}" <${gmail.orgEmail}>`
    await sendEmailViaGmail(gmail.token, from, to, subject, htmlBody, textBody)
    return true
  } catch {
    return false
  }
}

/**
 * Sends a CUSTOMER-facing email "as the business" from a context with no
 * logged-in user (public routes, cron) — built with the exact same shell
 * (shellHtml) and signature resolution (resolveSenderSignatureHtml) as every
 * other customer email, so structure never drifts between "a staff member
 * clicked Send" and "a customer triggered this automatically".
 *
 * `messageHtml`/`messageText` are the INNER content only (e.g. paragraphs) —
 * no header, no sign-off; those are added here, same as shellHtml everywhere else.
 *
 * `senderProfileId` credits a specific person in the signature (e.g. whoever
 * actually sent the quote being accepted). Falls back to whichever CRM user
 * has Gmail connected for the org when there's no more specific sender to
 * credit — the same fallback the job-auto-invoice email already uses.
 */
export async function sendBrandedAsOrg(
  supabase: SupabaseClient,
  orgId: string,
  to: string,
  subject: string,
  messageHtml: string,
  messageText: string,
  logoUrl: string,
  senderProfileId?: string | null,
): Promise<boolean> {
  try {
    const gmail = await resolveOrgGmail(supabase, orgId)
    if (!gmail) return false

    const shell: EmailShell = {
      orgName: gmail.orgName, orgEmail: gmail.orgEmail, orgPhone: gmail.orgPhone,
      senderName: gmail.orgName, logoUrl,
    }
    shell.signatureHtml = await resolveSenderSignatureHtml(
      supabase, senderProfileId ?? gmail.userId, orgId, gmail.token,
      { name: gmail.orgName, phone: gmail.orgPhone, email: gmail.orgEmail, logoUrl },
    )

    const from = `"${gmail.orgName.replace(/"/g, '')}" <${gmail.orgEmail}>`
    const html = shellHtml(shell, messageHtml)
    const text = `${messageText}\n\n${signoffText(shell)}`

    await sendEmailViaGmail(gmail.token, from, to, subject, html, text)
    return true
  } catch {
    return false
  }
}
