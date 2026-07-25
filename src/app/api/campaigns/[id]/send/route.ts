import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { paragraphsHtml, shellHtml, signoffText, type EmailShell } from '@/lib/emails/shell'
import { renderTemplate } from '@/lib/templates'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/campaigns/[id]/send'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http')
  && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://fieldcrm-sigma.vercel.app'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, role, full_name')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  if (campaign.type !== 'email') {
    return NextResponse.json({ error: 'SMS campaigns are not wired up yet — only email sending is currently supported.' }, { status: 400 })
  }
  if (!campaign.subject || !campaign.content) {
    return NextResponse.json({ error: 'Campaign is missing a subject or content' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organisations').select('name, email, phone').eq('id', profile.org_id).single()
  if (!org?.email) {
    return NextResponse.json({ error: 'Organisation email not configured. Set it in Settings > Organisation' }, { status: 400 })
  }

  // Prefer the sending user's own connected Gmail; fall back to any team
  // member who has one connected (mirrors notify.ts's alertOwner pattern).
  let accessToken = await getGmailAccessToken(profile.org_id, profile.id).catch(() => null)
  if (!accessToken) {
    const { data: connected } = await supabase
      .from('gmail_sync_state').select('user_id').eq('org_id', profile.org_id).limit(1).maybeSingle()
    if (connected?.user_id) {
      accessToken = await getGmailAccessToken(profile.org_id, connected.user_id).catch(() => null)
    }
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'No Gmail account is connected. Connect one in Settings > Profile > Integrations.' }, { status: 400 })
  }

  // Build contact query based on audience_filters.
  const filters = campaign.audience_filters ?? {}
  let query = supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('org_id', profile.org_id)
    .not('email', 'is', null)
    // AU Spam Act: never include contacts who have opted out.
    .eq('do_not_contact', false)

  if (filters.pipeline_stage_id) query = query.eq('pipeline_stage_id', filters.pipeline_stage_id)
  if (filters.tags && filters.tags.length > 0) query = query.overlaps('tags', filters.tags)

  const { data: recipients } = await query
  const contacts = recipients ?? []

  const shell: EmailShell = {
    orgName: org.name ?? 'us', orgEmail: org.email, orgPhone: org.phone ?? null,
    senderName: profile.full_name, logoUrl: `${APP_URL}/salt-air-logo.png`,
  }
  const fromHeader = shell.orgName ? `"${shell.orgName.replace(/"/g, '')}" <${shell.orgEmail}>` : shell.orgEmail

  let sentCount = 0
  let failedCount = 0

  for (const contact of contacts) {
    const unsubscribeUrl = `${APP_URL}/unsubscribe/${contact.id}`
    const vars = {
      first_name: contact.first_name, last_name: contact.last_name,
      business_name: shell.orgName, unsubscribe_url: unsubscribeUrl,
    }
    const subject = renderTemplate(campaign.subject!, vars)
    let message = renderTemplate(campaign.content!, vars)
    // Every commercial message must carry a functional unsubscribe.
    if (!campaign.content!.includes('{{unsubscribe_url}}')) {
      message += `\n\nUnsubscribe: ${unsubscribeUrl}`
    }

    try {
      const html = shellHtml(shell, paragraphsHtml(message))
      const text = `${message.trim()}\n\n${signoffText(shell)}`
      await sendEmailViaGmail(accessToken, fromHeader, contact.email!, subject, html, text)
      sentCount++
    } catch (err) {
      failedCount++
      await captureError(err, {
        source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
        context: { stage: 'gmail_send', campaignId: id, contactId: contact.id },
      })
    }
  }

  if (sentCount === 0 && contacts.length > 0) {
    return NextResponse.json({ error: 'Failed to send to any recipient' }, { status: 502 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: sentCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, recipient_count: sentCount, failed_count: failedCount, campaign: data })
}
