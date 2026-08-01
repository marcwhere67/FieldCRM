import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/http'
import { zUuid } from '@/lib/validation/common'

const deleteWorkflowSchema = z.object({
  workflowId: zUuid,
})

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, deleteWorkflowSchema)
    if (!parsed.ok) return parsed.response
    const { workflowId } = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('id, org_id').eq('supabase_auth_id', user.id).single()
    if (!profile) return NextResponse.json({ ok: false }, { status: 404 })

    await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId)
      .eq('org_id', profile.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
