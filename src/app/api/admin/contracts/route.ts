import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText, zUuid, zDateOnly } from '@/lib/validation/common'

const contractSchema = z.object({
  user_id: zUuid,
  title: zRequiredText(200),
  description: zNullableText(500),
  url: zRequiredText(2000),
  expires_at: z.union([zDateOnly, z.null()]).optional().transform((v) => v ?? null),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('employee_contracts')
    .select('*, users!employee_contracts_user_id_fkey(full_name, email, role)')
    .order('created_at', { ascending: false })

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, contractSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('employee_contracts')
    .insert({ ...parsed.data, org_id: profile.org_id, created_by: profile.id })
    .select('*, users!employee_contracts_user_id_fkey(full_name, email, role)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data, { status: 201 })
}
