import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAutomations } from '@/lib/automation-engine'

export async function POST(req: NextRequest) {
  try {
    const { contactId, stageId } = await req.json()
    if (!contactId) return NextResponse.json({ ok: false }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ ok: false }, { status: 404 })

    const { error } = await supabase
      .from('contacts')
      .update({ pipeline_stage_id: stageId ?? null })
      .eq('id', contactId)
      .eq('org_id', profile.org_id)

    if (error) return NextResponse.json({ ok: false }, { status: 500 })

    // Fire automations in background (don't block response)
    if (stageId) {
      runAutomations(supabase, 'contact_stage_change', { stageId }, {
        contactId,
        orgId: profile.org_id,
      }).catch(console.error)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
