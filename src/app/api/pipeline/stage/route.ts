import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('supabase_auth_id', userId)
    .single()
  return data
}

export async function POST(req: NextRequest) {
  try {
    const { name, color, position } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await getProfile(supabase, user.id)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .insert({ org_id: profile.org_id, name, color: color ?? '#6366f1', position: position ?? 0 })
      .select('id, name, position, color')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ stage })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { stageId, name, color } = await req.json()
    if (!stageId) return NextResponse.json({ error: 'stageId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await getProfile(supabase, user.id)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .update({ name, color })
      .eq('id', stageId)
      .eq('org_id', profile.org_id)
      .select('id, name, position, color')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ stage })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { stageId } = await req.json()
    if (!stageId) return NextResponse.json({ error: 'stageId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await getProfile(supabase, user.id)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Unassign contacts in this stage first
    await supabase
      .from('contacts')
      .update({ pipeline_stage_id: null })
      .eq('pipeline_stage_id', stageId)
      .eq('org_id', profile.org_id)

    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', stageId)
      .eq('org_id', profile.org_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
