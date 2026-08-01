import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText } from '@/lib/validation/common'

const procedureUpdateSchema = z.object({
  clean_type: z.enum(['regular', 'deep', 'airbnb', 'end_of_lease']).optional(),
  title: zRequiredText(200).optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, procedureUpdateSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('cleaning_procedures')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select('*, procedure_steps(*)')
    .single()
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { error } = await supabase.from('cleaning_procedures').delete().eq('id', id).eq('org_id', profile.org_id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ success: true })
}
