import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText } from '@/lib/validation/common'

// Allowlist mirrors supabase/migrations/suppliers.sql — was insert({ ...body }).
const supplierSchema = z.object({
  name: zRequiredText(200),
  contact_name: zNullableText(200),
  email: zNullableText(200),
  phone: zNullableText(40),
  address: zNullableText(300),
  website: zNullableText(300),
  category: zNullableText(100),
  notes: zNullableText(1000),
  is_active: z.boolean().default(true),
})

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, supplierSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
