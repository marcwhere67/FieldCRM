import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, company, phone, email, stageId } = await req.json()
    if (!firstName) return NextResponse.json({ error: 'First name required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        org_id: profile.org_id,
        first_name: firstName,
        last_name: lastName || '',
        company_name: company ?? null,
        phone: phone ?? null,
        email: email ?? null,
        pipeline_stage_id: stageId ?? null,
      })
      .select('id, first_name, last_name, company_name, phone, email, pipeline_stage_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
