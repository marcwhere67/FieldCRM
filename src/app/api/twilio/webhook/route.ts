import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'

// Twilio sends form-encoded POST to this endpoint when an SMS arrives
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    // Reject requests that don't carry a valid Twilio signature.
    // Enforced once a real auth token is configured (placeholder = local dev).
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (authToken && authToken !== 'placeholder') {
      const signature = req.headers.get('x-twilio-signature') ?? ''
      const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/webhook`
      const paramsObj = Object.fromEntries(params.entries())
      if (!twilio.validateRequest(authToken, signature, url, paramsObj)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
      }
    }

    const from = params.get('From')
    const to = params.get('To')
    const messageSid = params.get('MessageSid')
    const content = params.get('Body') ?? ''

    if (!from || !content) {
      return new NextResponse('<?xml version="1.0"?><Response/>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Use service role client — no user session on webhook
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find org by Twilio number
    // For now, find the org whose TWILIO_PHONE_NUMBER matches `to`
    // In production you'd store this mapping in the DB
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id')
      .limit(1)

    const orgId = orgs?.[0]?.id
    if (!orgId) {
      return new NextResponse('<?xml version="1.0"?><Response/>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Find contact by phone number
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', from)
      .maybeSingle()

    let contactId = contact?.id

    // Auto-create contact if not found
    if (!contactId) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          first_name: from,
          last_name: '',
          phone: from,
          is_active: true,
        })
        .select('id')
        .single()
      contactId = newContact?.id
    }

    if (!contactId) {
      return new NextResponse('<?xml version="1.0"?><Response/>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const now = new Date().toISOString()

    // Find or create open SMS conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('org_id', orgId)
      .eq('contact_id', contactId)
      .eq('channel', 'sms')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let convId = existingConv?.id

    if (!convId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          org_id: orgId,
          contact_id: contactId,
          channel: 'sms',
          status: 'open',
          last_message_at: now,
          unread_count: 1,
        })
        .select('id')
        .single()
      convId = newConv?.id
    } else {
      await supabase
        .from('conversations')
        .update({
          last_message_at: now,
          unread_count: (existingConv?.unread_count ?? 0) + 1,
        })
        .eq('id', convId)
    }

    if (!convId) {
      return new NextResponse('<?xml version="1.0"?><Response/>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    await supabase.from('messages').insert({
      org_id: orgId,
      conversation_id: convId,
      direction: 'inbound',
      content,
      sent_at: now,
      external_message_id: messageSid,
    })

    // Return empty TwiML — no auto-reply
    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('Twilio webhook error:', err)
    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
