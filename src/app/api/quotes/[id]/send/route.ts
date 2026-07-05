import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, org_id, contact_id,
      contacts!quotes_contact_id_fkey(first_name, phone)
    `)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', profile.org_id)
    .single()

  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  const approvalUrl = `${siteUrl}/quote-approval/${quote.id}`

  let sent = false
  let warning: string | null = null

  const to = contact?.phone
  if (!to) {
    warning = 'Contact has no phone number — quote marked as sent but no SMS was sent'
  } else {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER

    if (!sid || !token || !from || sid === 'placeholder' || token === 'placeholder') {
      warning = 'Twilio is not configured — quote marked as sent but no SMS was sent'
    } else {
      const body = `Hi ${contact.first_name}, your quote ${quote.quote_number} from ${org?.name ?? 'us'} is ready to view: ${approvalUrl}`
      try {
        const { default: twilio } = await import('twilio')
        const client = twilio(sid, token)
        const msg = await client.messages.create({ body, from, to })
        sent = true

        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('org_id', profile.org_id)
          .eq('contact_id', quote.contact_id)
          .eq('channel', 'sms')
          .eq('status', 'open')
          .maybeSingle()

        const now = new Date().toISOString()
        const convId = existingConv?.id ?? (await supabase
          .from('conversations')
          .insert({ org_id: profile.org_id, contact_id: quote.contact_id, channel: 'sms', status: 'open', last_message_at: now })
          .select('id')
          .single()).data?.id

        if (convId) {
          await supabase.from('messages').insert({
            org_id: profile.org_id,
            conversation_id: convId,
            direction: 'outbound',
            content: body,
            sent_by: profile.id,
            sent_at: now,
            external_message_id: msg.sid,
          })
          await supabase.from('conversations').update({ last_message_at: now, status: 'open' }).eq('id', convId)
        }
      } catch (err) {
        console.error('Twilio send failed:', err)
        warning = 'SMS failed to send — quote marked as sent'
      }
    }
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sent, warning })
}
