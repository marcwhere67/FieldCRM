import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — update a template (admin/manager only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  // Only these fields are editable; channel/category/key stay fixed after creation.
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.subject !== undefined) patch.subject = body.subject ? String(body.subject).trim() : null
  if (body.body !== undefined) patch.body = String(body.body)
  if (body.is_active !== undefined) patch.is_active = !!body.is_active

  const { data, error } = await supabase
    .from('message_templates')
    .update(patch)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove a template. System templates (with a template_key) can't be deleted,
// only edited, so the app always has copy to fall back on.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase
    .from('message_templates')
    .select('template_key')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (existing?.template_key)
    return NextResponse.json({ error: 'System templates can be edited but not deleted' }, { status: 400 })

  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', profile.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
