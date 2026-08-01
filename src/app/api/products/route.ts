import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zMoneyInput, zRequiredText, zNullableText } from '@/lib/validation/common'

// Previously `insert({ ...body })` — any authenticated manager could set columns
// the form never exposes (id, active, arbitrary future columns). The schema is
// now the allowlist; org_id is still applied server-side, last.
const productSchema = z.object({
  name: zRequiredText(200),
  description: zNullableText(1000),
  type: z.enum(['service', 'product'], { error: 'Choose either a service or a product' }).default('service'),
  unit_price: zMoneyInput,
  unit: zNullableText(50),
  category: zNullableText(100),
  active: z.boolean().default(true),
})

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, productSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('products')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
