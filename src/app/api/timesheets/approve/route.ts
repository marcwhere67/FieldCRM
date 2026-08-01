import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zUuid } from '@/lib/validation/common'

const approveSchema = z.object({
  timesheetId: zUuid,
  approve: z.boolean(),
})

export async function POST(req: Request) {
  // Only managers and admins may approve timesheets (also guarded by a DB trigger).
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, approveSchema)
  if (!parsed.ok) return parsed.response
  const { timesheetId, approve } = parsed.data

  const { error } = await supabase
    .from('timesheets')
    .update({
      approved: approve,
      approved_by: approve ? profile.id : null,
      approved_at: approve ? new Date().toISOString() : null,
    })
    .eq('id', timesheetId)
    .eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ ok: true })
}
