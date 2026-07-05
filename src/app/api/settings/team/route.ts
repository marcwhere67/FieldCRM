import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { email, full_name, role, phone } = body

  // Use service role to create the auth user and send invite
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { data: newUser, error: userError } = await serviceClient
    .from('users')
    .insert({
      org_id: profile.org_id,
      email,
      full_name,
      role,
      phone: phone || null,
      supabase_auth_id: authData.user.id,
    })
    .select()
    .single()

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 })
  return NextResponse.json(newUser, { status: 201 })
}
