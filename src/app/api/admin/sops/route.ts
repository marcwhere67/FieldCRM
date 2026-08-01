import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText } from '@/lib/validation/common'

const sopSchema = z.object({
  title: zRequiredText(200),
  category: zRequiredText(100),
  content: zRequiredText(20000),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sops')
    .select('*, users!sops_created_by_fkey(full_name)')
    .order('category').order('title')

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, sopSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('sops')
    .insert({ ...parsed.data, org_id: profile.org_id, created_by: profile.id })
    .select('*, users!sops_created_by_fkey(full_name)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data, { status: 201 })
}
