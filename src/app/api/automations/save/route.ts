import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { workflowId, name, description, triggerType, triggerConditions, steps } = await req.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = {
      name,
      description: description ?? null,
      trigger_type: triggerType,
      trigger_conditions: triggerConditions ?? {},
      steps: steps ?? [],
    }

    let workflow
    if (workflowId) {
      const { data, error } = await supabase
        .from('workflows')
        .update(payload)
        .eq('id', workflowId)
        .eq('org_id', profile.org_id)
        .select('id, name, description, is_active, trigger_type, trigger_conditions, steps, stats, created_at')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      workflow = data
    } else {
      const { data, error } = await supabase
        .from('workflows')
        .insert({ ...payload, org_id: profile.org_id, is_active: true })
        .select('id, name, description, is_active, trigger_type, trigger_conditions, steps, stats, created_at')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      workflow = data
    }

    return NextResponse.json({ workflow })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
