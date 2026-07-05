import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json()
    if (!conversationId || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Get conversation + contact phone for Twilio
    const { data: conv } = await supabase
      .from('conversations')
      .select(`
        id, channel, org_id,
        contacts!conversations_contact_id_fkey(phone)
      `)
      .eq('id', conversationId)
      .eq('org_id', profile.org_id)
      .single()

    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    let externalMessageId: string | null = null

    // Attempt Twilio send if SMS and keys configured
    if (conv.channel === 'sms') {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_PHONE_NUMBER
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts
      const to = (contact as any)?.phone

      if (sid && token && from && to && sid !== 'placeholder' && token !== 'placeholder') {
        try {
          const { default: twilio } = await import('twilio')
          const client = twilio(sid, token)
          const msg = await client.messages.create({ body: content, from, to })
          externalMessageId = msg.sid
        } catch (err) {
          console.error('Twilio send failed:', err)
          // Continue — save message even if Twilio fails
        }
      }
    }

    const now = new Date().toISOString()

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: profile.org_id,
        conversation_id: conversationId,
        direction: 'outbound',
        content,
        sent_by: profile.id,
        sent_at: now,
        external_message_id: externalMessageId,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase
      .from('conversations')
      .update({ last_message_at: now, status: 'open' })
      .eq('id', conversationId)

    return NextResponse.json({ messageId: message.id, sent: !!externalMessageId })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
