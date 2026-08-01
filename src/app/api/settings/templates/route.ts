import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText } from '@/lib/validation/common'

// GET — list all templates for the org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('category')
    .order('name')
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

const templateSchema = z.object({
  channel: z.enum(['sms', 'email']).optional().default('sms'),
  category: zRequiredText(100).optional().default('custom'),
  name: zRequiredText(200),
  subject: zNullableText(300),
  body: zRequiredText(5000),
})

// POST — create a new custom template (admin/manager only)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseBody(req, templateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('message_templates')
    .insert({
      org_id: profile.org_id,
      channel: body.channel,
      category: body.category,
      template_key: null, // user-created templates are never system keys
      name: body.name,
      subject: body.channel === 'email' ? body.subject : null,
      body: body.body,
      created_by: profile.id,
    })
    .select()
    .single()
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data, { status: 201 })
}
