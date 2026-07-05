import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ messages: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ messages: [] }, { status: 401 })

  const { data: messages } = await supabase
    .from('messages')
    .select('id, direction, content, sent_at, sent_by, is_automated, external_message_id')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })

  // Mark messages as read
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .eq('direction', 'inbound')

  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)

  return NextResponse.json({ messages: messages ?? [] })
}
