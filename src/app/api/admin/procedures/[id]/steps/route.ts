import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText, zBoolish } from '@/lib/validation/common'

const stepSchema = z.object({
  title: zRequiredText(200),
  area: z.string().trim().max(100).optional().default('general'),
  description: zNullableText(2000),
  is_required: zBoolish.optional().default(true),
  order_index: z.number().int().nonnegative().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: procedure } = await supabase.from('cleaning_procedures').select('org_id').eq('id', id).single()
  if (!procedure || procedure.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = await parseBody(req, stepSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('procedure_steps')
    .insert({ ...parsed.data, procedure_id: id, org_id: profile.org_id })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data, { status: 201 })
}
