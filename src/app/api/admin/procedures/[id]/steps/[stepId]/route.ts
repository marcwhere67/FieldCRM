import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  const { stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('procedure_steps')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', stepId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  const { stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { count } = await supabase
    .from('job_procedure_progress')
    .select('id', { count: 'exact', head: true })
    .eq('step_id', stepId)

  if (count && count > 0) {
    // Referenced by job history — archive instead of hard-deleting so past job records stay intact.
    const { data, error } = await supabase.from('procedure_steps').update({ status: 'archived' }).eq('id', stepId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: true, step: data })
  }

  const { error } = await supabase.from('procedure_steps').delete().eq('id', stepId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
