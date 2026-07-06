import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  const isManager = !!profile && ['admin', 'manager'].includes(profile.role)
  const isSelf = !!profile && profile.id === id
  if (!profile || (!isManager && !isSelf))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rawBody = await req.json()
  // Field staff editing their own profile may only touch personal fields —
  // job title, department, employment type, hourly rate and certifications stay manager/admin-only
  const body = isManager ? rawBody : {
    skills: rawBody.skills,
    emergency_contact_name: rawBody.emergency_contact_name,
    emergency_contact_phone: rawBody.emergency_contact_phone,
    emergency_contact_relation: rawBody.emergency_contact_relation,
    notes: rawBody.notes,
  }

  // Upsert employee_profile by user_id
  const { data, error } = await supabase
    .from('employee_profiles')
    .upsert({ ...body, user_id: id, org_id: profile.org_id }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also update hourly_rate on users table if provided (managers only)
  if (isManager && body.hourly_rate !== undefined) {
    await supabase.from('users').update({ hourly_rate: body.hourly_rate }).eq('id', id).eq('org_id', profile.org_id)
  }

  return NextResponse.json(data)
}
