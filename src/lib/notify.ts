// CRM-native notifications. Currently email-only, via the org's connected
// Gmail (same mechanism as monitor.ts alertOwner). Best-effort: never throws
// back into the caller, so a notification failure can't break lead capture.

import { createServiceClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http')
  && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://fieldcrm-sigma.vercel.app'

export interface NewLeadInfo {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  serviceType?: string | null
  notes?: string | null
}

// Emails the org (its business inbox) that a new website lead has landed in the
// pipeline. Silently skips if no Gmail is connected — the lead is already saved.
export async function notifyNewLead(orgId: string, lead: NewLeadInfo): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: org } = await supabase
      .from('organisations').select('name, email').eq('id', orgId).single()
    if (!org?.email) return

    // Any admin who has connected Gmail can be the sender.
    const { data: connected } = await supabase
      .from('gmail_sync_state').select('user_id').eq('org_id', orgId).limit(1).maybeSingle()
    if (!connected?.user_id) return
    const token = await getGmailAccessToken(orgId, connected.user_id).catch(() => null)
    if (!token) return

    const orgName = org.name?.replace(/"/g, '') ?? 'FieldCRM'
    const from = `"${orgName}" <${org.email}>`
    const subject = `New website lead: ${lead.name}`

    const rows: [string, string | null | undefined][] = [
      ['Name', lead.name],
      ['Phone', lead.phone],
      ['Email', lead.email],
      ['Address', lead.address],
      ['Service', lead.serviceType],
      ['Notes', lead.notes],
    ]
    const rowsHtml = rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#8A9BA6;font-size:13px;vertical-align:top">${k}</td><td style="padding:4px 0;color:#2C3E50;font-size:14px">${escapeHtml(String(v))}</td></tr>`)
      .join('')

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px">
        <div style="background:#2C3E50;padding:20px 24px">
          <span style="color:#fff;font-size:16px;letter-spacing:0.02em">New enquiry from your website</span>
        </div>
        <div style="padding:24px;border:1px solid rgba(44,62,80,0.1);border-top:none">
          <p style="color:#2C3E50;font-size:14px;margin:0 0 16px">A new lead just came through the quote form and has been added to your pipeline.</p>
          <table style="border-collapse:collapse;margin-bottom:20px">${rowsHtml}</table>
          <a href="${APP_URL}/pipeline" style="display:inline-block;background:#76A58F;color:#fff;text-decoration:none;padding:10px 22px;font-size:14px">Open pipeline →</a>
        </div>
      </div>`

    const text = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
      + `\n\nOpen pipeline: ${APP_URL}/pipeline`

    await sendEmailViaGmail(token, from, org.email, subject, html, text)
  } catch {
    // Best-effort — lead is already captured; a failed notification is non-fatal.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
