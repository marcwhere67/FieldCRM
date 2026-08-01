import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zUuid, zOptionalUuid, zRequiredText, zNullableText } from '@/lib/validation/common'

// workflows is a "restricted" table (managers+ write) per p0_lockdown RLS.
const saveSchema = z.object({
  workflowId: zOptionalUuid,
  name: zRequiredText(200),
  description: zNullableText(1000),
  triggerType: zRequiredText(50),
  triggerConditions: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(z.unknown()).max(100, 'Too many steps').default([]),
})

const SELECT = 'id, name, description, is_active, trigger_type, trigger_conditions, steps, stats, created_at'

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, saveSchema)
  if (!parsed.ok) return parsed.response
  const { workflowId, name, description, triggerType, triggerConditions, steps } = parsed.data

  const payload = {
    name,
    description,
    trigger_type: triggerType,
    trigger_conditions: triggerConditions,
    steps,
  }

  if (workflowId) {
    const { data, error } = await supabase
      .from('workflows')
      .update(payload)
      .eq('id', zUuid.parse(workflowId))
      .eq('org_id', profile.org_id)
      .select(SELECT)
      .single()
    if (error) return jsonError(friendlyDbError(error), 400)
    return NextResponse.json({ workflow: data })
  }

  const { data, error } = await supabase
    .from('workflows')
    .insert({ ...payload, org_id: profile.org_id, is_active: true })
    .select(SELECT)
    .single()
  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ workflow: data })
}
