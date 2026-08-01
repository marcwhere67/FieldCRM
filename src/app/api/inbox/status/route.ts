import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/http'
import { zUuid } from '@/lib/validation/common'

const STATUSES = ['open', 'closed'] as const

const statusSchema = z.object({
  conversationId: zUuid,
  status: z.enum(STATUSES, { error: 'Invalid status' }),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, statusSchema)
    if (!parsed.ok) return parsed.response
    const { conversationId, status } = parsed.data

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
