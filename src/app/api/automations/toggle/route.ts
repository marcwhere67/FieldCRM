import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zUuid } from '@/lib/validation/common'

const toggleSchema = z.object({ workflowId: zUuid, isActive: z.boolean() })

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, toggleSchema)
  if (!parsed.ok) return parsed.response
  const { workflowId, isActive } = parsed.data

  const { error } = await supabase
    .from('workflows')
    .update({ is_active: isActive })
    .eq('id', workflowId)
    .eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ ok: true })
}
