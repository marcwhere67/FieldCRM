import { SupabaseClient } from '@supabase/supabase-js'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'

// Sends mail "as the business" from a context with no logged-in user (public
// routes, cron). Finds any Gmail account connected for the org and sends
// through it. Best-effort by design: returns false rather than throwing, so a
// failed notification can never break the customer-facing action that triggered it.
export async function sendAsOrg(
  supabase: SupabaseClient,
  orgId: string,
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
): Promise<boolean> {
  try {
    const { data: org } = await supabase
      .from('organisations').select('name, email').eq('id', orgId).single()
    if (!org?.email) return false

    const { data: connected } = await supabase
      .from('gmail_sync_state').select('user_id').eq('org_id', orgId).limit(1).maybeSingle()
    if (!connected?.user_id) return false

    const token = await getGmailAccessToken(orgId, connected.user_id).catch(() => null)
    if (!token) return false

    const from = `"${org.name?.replace(/"/g, '') ?? 'FieldCRM'}" <${org.email}>`
    await sendEmailViaGmail(token, from, to, subject, htmlBody, textBody)
    return true
  } catch {
    return false
  }
}
