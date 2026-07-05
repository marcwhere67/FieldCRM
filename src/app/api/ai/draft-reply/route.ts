import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await req.json()

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, full_name')
    .eq('supabase_auth_id', user.id)
    .single()

  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      channel, status,
      contacts!conversations_contact_id_fkey(first_name, last_name),
      messages(body, direction, created_at)
    `)
    .eq('id', conversationId)
    .eq('org_id', profile!.org_id)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts
  const messages = (conversation.messages as { body: string; direction: string; created_at: string }[] | null) ?? []
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-10)

  const thread = sorted.map(m =>
    `${m.direction === 'inbound' ? contact?.first_name ?? 'Client' : 'Us'}: ${m.body}`
  ).join('\n')

  const prompt = `You are a professional customer service representative for a field service company (cleaning, maintenance, landscaping).
Draft a helpful, friendly reply to the following ${conversation.channel.toUpperCase()} conversation.

Client name: ${contact ? `${contact.first_name} ${contact.last_name}` : 'Client'}
Channel: ${conversation.channel}

Conversation:
${thread}

Write ONLY the reply message — no subject line, no "Draft:", no quotes around it. Keep it concise and professional. For SMS, keep it under 160 characters if possible.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const draft = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ draft })
}
