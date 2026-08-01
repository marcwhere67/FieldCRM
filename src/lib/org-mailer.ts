import { SupabaseClient } from '@supabase/supabase-js'
import { getGmailAccessToken, getGmailSignature, sendEmailViaGmail } from '@/lib/gmail'
import { esc, htmlSignatureToText } from '@/lib/emails/shell'

// Shared lookup: any Gmail account connected for the org, from a context with
// no logged-in user (public routes, cron). Returns null if Gmail isn't
// connected or org email is missing — callers treat that as "can't send".
async function resolveOrgGmail(supabase: SupabaseClient, orgId: string) {
  const { data: org } = await supabase
    .from('organisations').select('name, email, phone').eq('id', orgId).single()
  if (!org?.email) return null

  const { data: connected } = await supabase
    .from('gmail_sync_state').select('user_id').eq('org_id', orgId).limit(1).maybeSingle()
  if (!connected?.user_id) return null

  const token = await getGmailAccessToken(orgId, connected.user_id).catch(() => null)
  if (!token) return null

  return { token, orgName: org.name?.trim() || 'FieldCRM', orgEmail: org.email, orgPhone: org.phone as string | null }
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
 * logged-in user (public routes, cron) — branded the same way as quote/
 * invoice/receipt emails: a logo header, and the connected Gmail account's
 * own signature when one is set up, falling back to a generic business
 * sign-off otherwise. This is what closes the gap where public actions (like
 * a customer approving a quote) produced a plain, unbranded confirmation.
 *
 * `messageHtml`/`messageText` are the INNER content only (e.g. paragraphs) —
 * no header, no sign-off; those are added here.
 */
export async function sendBrandedAsOrg(
  supabase: SupabaseClient,
  orgId: string,
  to: string,
  subject: string,
  messageHtml: string,
  messageText: string,
  logoUrl: string,
): Promise<boolean> {
  try {
    const gmail = await resolveOrgGmail(supabase, orgId)
    if (!gmail) return false

    const signatureHtml = await getGmailSignature(gmail.token)
    const from = `"${gmail.orgName.replace(/"/g, '')}" <${gmail.orgEmail}>`

    const signoffHtml = signatureHtml || `<p>Kind regards,</p><p>${esc(gmail.orgName)}</p>`
    const signoffText = signatureHtml ? htmlSignatureToText(signatureHtml) : `Kind regards,\n\n${gmail.orgName}`

    const html = `<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #2C3E50; padding: 16px 24px;">
    <tr><td><img src="${logoUrl}" alt="${esc(gmail.orgName)}" height="40" style="display: block;" /></td></tr>
  </table>
  <div style="padding: 24px;">
    ${messageHtml}
    ${signoffHtml}
  </div>
</body>
</html>`
    const text = `${messageText}\n\n${signoffText}`

    await sendEmailViaGmail(gmail.token, from, to, subject, html, text)
    return true
  } catch {
    return false
  }
}
