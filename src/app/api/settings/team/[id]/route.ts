import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'

const teamMemberUpdateSchema = z.object({
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'manager', 'field']).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, teamMemberUpdateSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('users')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}
