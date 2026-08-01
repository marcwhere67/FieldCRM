import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zUuid, zOptionalUuid } from '@/lib/validation/common'
import { runAutomations } from '@/lib/automation-engine'

const moveSchema = z.object({
  contactId: zUuid,
  stageId: zOptionalUuid,
})

export async function POST(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, moveSchema)
  if (!parsed.ok) return parsed.response
  const { contactId, stageId } = parsed.data

  const { error } = await supabase
    .from('contacts')
    .update({ pipeline_stage_id: stageId })
    .eq('id', contactId)
    .eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)

  // Fire automations in the background (don't block the response).
  if (stageId) {
    runAutomations(supabase, 'contact_stage_change', { stageId }, {
      contactId,
      orgId: profile.org_id,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
