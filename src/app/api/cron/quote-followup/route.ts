import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret !== 'placeholder') {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, org_id, contact_id, sent_at,
      contacts!quotes_contact_id_fkey(first_name, phone),
      organisations!quotes_org_id_fkey(name)
    `)
    .eq('status', 'sent')
    .is('followup_sent_at', null)
    .lte('sent_at', cutoff)
    .limit(100)

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  const twilioReady = !!(sid && token && from && sid !== 'placeholder' && token !== 'placeholder')

  let sent = 0
  let skipped = 0

  for (const quote of quotes ?? []) {
    const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
    const org = Array.isArray(quote.organisations) ? quote.organisations[0] : quote.organisations
    const to = contact?.phone

    if (!to || !twilioReady) { skipped++; continue }

    const approvalUrl = `${siteUrl}/quote-approval/${quote.id}`
    const body = `Hi ${contact.first_name}, just checking in on quote ${quote.quote_number} from ${org?.name ?? 'us'} — ${approvalUrl}. Let us know if you have any questions!`

    try {
      const { default: twilio } = await import('twilio')
      const client = twilio(sid, token)
      const msg = await client.messages.create({ body, from, to })

      const now = new Date().toISOString()
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('org_id', quote.org_id)
        .eq('contact_id', quote.contact_id)
        .eq('channel', 'sms')
        .eq('status', 'open')
        .maybeSingle()

      const convId = existingConv?.id ?? (await supabase
        .from('conversations')
        .insert({ org_id: quote.org_id, contact_id: quote.contact_id, channel: 'sms', status: 'open', last_message_at: now })
        .select('id')
        .single()).data?.id

      if (convId) {
        await supabase.from('messages').insert({
          org_id: quote.org_id,
          conversation_id: convId,
          direction: 'outbound',
          content: body,
          sent_at: now,
          external_message_id: msg.sid,
          is_automated: true,
        })
        await supabase.from('conversations').update({ last_message_at: now, status: 'open' }).eq('id', convId)
      }

      await supabase.from('quotes').update({ followup_sent_at: now }).eq('id', quote.id)
      sent++
    } catch (err) {
      console.error(`Follow-up SMS failed for quote ${quote.id}:`, err)
      skipped++
    }
  }

  return NextResponse.json({ processed: quotes?.length ?? 0, sent, skipped })
}
