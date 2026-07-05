import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ contacts: [] }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ contacts: [] }, { status: 404 })

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone')
    .eq('org_id', profile.org_id)
    .order('first_name')

  return NextResponse.json({ contacts: contacts ?? [] })
}
