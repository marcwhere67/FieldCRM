import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: procedure } = await supabase.from('cleaning_procedures').select('org_id').eq('id', id).single()
  if (!procedure || procedure.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('procedure_steps')
    .insert({ ...body, procedure_id: id, org_id: profile.org_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
