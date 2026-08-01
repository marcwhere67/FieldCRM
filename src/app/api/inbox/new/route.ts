import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zUuid, zRequiredText } from '@/lib/validation/common'

const CHANNELS = ['sms', 'email'] as const

const newConversationSchema = z.object({
  contactId: zUuid,
  message: zRequiredText(5000),
  channel: z.enum(CHANNELS).optional().default('sms'),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, newConversationSchema)
    if (!parsed.ok) return parsed.response
    const { contactId, message, channel } = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email')
      .eq('id', contactId)
      .eq('org_id', profile.org_id)
      .single()
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const now = new Date().toISOString()

    // Create or find existing open conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, channel, status, last_message_at, unread_count, created_at, contacts!conversations_contact_id_fkey(id, first_name, last_name, phone, email)')
      .eq('contact_id', contactId)
      .eq('org_id', profile.org_id)
      .eq('channel', channel)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conv = existing

    if (!conv) {
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          org_id: profile.org_id,
          contact_id: contactId,
          channel,
          status: 'open',
          last_message_at: now,
        })
        .select('id, channel, status, last_message_at, unread_count, created_at, contacts!conversations_contact_id_fkey(id, first_name, last_name, phone, email)')
        .single()

      if (error) return jsonError(friendlyDbError(error), 500)
      conv = newConv
    }

    // Send via Twilio if SMS
    let externalMessageId: string | null = null
    if (channel === 'sms' && contact.phone) {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_PHONE_NUMBER

      if (sid && token && from && sid !== 'placeholder' && token !== 'placeholder') {
        try {
          const { default: twilio } = await import('twilio')
          const client = twilio(sid, token)
          const msg = await client.messages.create({ body: message, from, to: contact.phone })
          externalMessageId = msg.sid
        } catch (err) {
          console.error('Twilio error:', err)
        }
      }
    }

    await supabase.from('messages').insert({
      org_id: profile.org_id,
      conversation_id: conv.id,
      direction: 'outbound',
      content: message,
      sent_by: profile.id,
      sent_at: now,
      external_message_id: externalMessageId,
    })

    await supabase
      .from('conversations')
      .update({ last_message_at: now })
      .eq('id', conv.id)

    return NextResponse.json({ conversation: conv })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
