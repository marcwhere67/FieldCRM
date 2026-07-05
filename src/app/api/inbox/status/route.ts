import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { conversationId, status } = await req.json()
    if (!conversationId || !status) return NextResponse.json({ ok: false }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ ok: false }, { status: 404 })

    await supabase
      .from('conversations')
      .update({ status })
      .eq('id', conversationId)
      .eq('org_id', profile.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
