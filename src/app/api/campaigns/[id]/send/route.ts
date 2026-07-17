import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  // Build contact query based on audience_filters
  const filters = campaign.audience_filters ?? {}
  let query = supabase
    .from('contacts')
    .select('id, email, phone', { count: 'exact' })
    .eq('org_id', profile.org_id)
    // AU Spam Act: never include contacts who have opted out.
    .eq('do_not_contact', false)

  if (campaign.type === 'email') query = query.not('email', 'is', null)
  if (campaign.type === 'sms') query = query.not('phone', 'is', null)
  if (filters.pipeline_stage_id) query = query.eq('pipeline_stage_id', filters.pipeline_stage_id)
  if (filters.tags && filters.tags.length > 0) query = query.overlaps('tags', filters.tags)

  const { count } = await query

  // Placeholder send — in production wire up Resend (email) or Twilio (SMS).
  // When wiring the real send, personalise per recipient and append the
  // unsubscribe link so every commercial message carries one:
  //   const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe/${contact.id}`
  //   body = campaign.content.replace(/{{unsubscribe_url}}/g, unsubscribeUrl)
  //          + (campaign.content.includes('{{unsubscribe_url}}') ? '' : `\n\nUnsubscribe: ${unsubscribeUrl}`)
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, recipient_count: count ?? 0, campaign: data })
}
