import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText } from '@/lib/validation/common'

const procedureSchema = z.object({
  clean_type: z.enum(['regular', 'deep', 'airbnb', 'end_of_lease'], { error: 'Choose a valid clean type' }),
  title: zRequiredText(200),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('cleaning_procedures')
    .select('*, procedure_steps(*)')
    .order('clean_type')

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, procedureSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('cleaning_procedures')
    .insert({ ...parsed.data, org_id: profile.org_id, created_by: profile.id })
    .select('*, procedure_steps(*)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data, { status: 201 })
}
