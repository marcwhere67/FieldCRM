import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText, zEmail } from '@/lib/validation/common'

const ROLES = ['admin', 'manager', 'field'] as const

const inviteSchema = z.object({
  email: zEmail,
  full_name: zRequiredText(200),
  role: z.enum(ROLES, { error: 'Choose a valid role' }),
  phone: zNullableText(40),
})

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

  const parsed = await parseBody(req, inviteSchema)
  if (!parsed.ok) return parsed.response
  const { email, full_name, role, phone } = parsed.data

  // Use service role to create the auth user and send invite
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  })

  if (authError) return jsonError(friendlyDbError(authError), 500)

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

  if (userError) return jsonError(friendlyDbError(userError), 500)
  return NextResponse.json(newUser, { status: 201 })
}
