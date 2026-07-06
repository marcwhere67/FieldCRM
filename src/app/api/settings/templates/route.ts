import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — list all templates for the org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('category')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new custom template (admin/manager only)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const channel = body.channel === 'email' ? 'email' : 'sms'
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('message_templates')
    .insert({
      org_id: profile.org_id,
      channel,
      category: body.category || 'custom',
      template_key: null, // user-created templates are never system keys
      name: body.name.trim(),
      subject: channel === 'email' ? (body.subject?.trim() || null) : null,
      body: body.body,
      created_by: profile.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
