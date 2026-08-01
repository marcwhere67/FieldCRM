import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zNullableText, zMoneyInput, zDateOnly } from '@/lib/validation/common'

const certificationSchema = z.object({
  name: z.string().trim().max(200).default(''),
  issued: z.union([zDateOnly, z.literal('')]).optional().default(''),
  expires: z.union([zDateOnly, z.literal('')]).optional().default(''),
  issuer: z.string().trim().max(200).default(''),
})

const profileUpdateSchema = z.object({
  hire_date: z.union([zDateOnly, z.literal(''), z.null()]).optional().transform((v) => (v ? v : null)),
  job_title: zNullableText(200),
  department: zNullableText(200),
  employment_type: z.enum(['full_time', 'part_time', 'casual', 'contractor']).optional(),
  skills: z.array(z.string().trim().max(100)).max(100).optional(),
  certifications: z.array(certificationSchema).max(100).optional(),
  emergency_contact_name: zNullableText(200),
  emergency_contact_phone: zNullableText(50),
  emergency_contact_relation: zNullableText(100),
  notes: zNullableText(2000),
  hourly_rate: z.union([zMoneyInput, z.null()]).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  const isManager = !!profile && ['admin', 'manager'].includes(profile.role)
  const isSelf = !!profile && profile.id === id
  if (!profile || (!isManager && !isSelf))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseBody(req, profileUpdateSchema)
  if (!parsed.ok) return parsed.response
  const rawBody = parsed.data

  // Field staff editing their own profile may only touch personal fields —
  // job title, department, employment type, hourly rate and certifications stay manager/admin-only
  const body = isManager ? rawBody : {
    skills: rawBody.skills,
    emergency_contact_name: rawBody.emergency_contact_name,
    emergency_contact_phone: rawBody.emergency_contact_phone,
    emergency_contact_relation: rawBody.emergency_contact_relation,
    notes: rawBody.notes,
  }

  // Upsert employee_profile by user_id
  const { data, error } = await supabase
    .from('employee_profiles')
    .upsert({ ...body, user_id: id, org_id: profile.org_id }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)

  // Also update hourly_rate on users table if provided (managers only)
  if (isManager && rawBody.hourly_rate !== undefined) {
    await supabase.from('users').update({ hourly_rate: rawBody.hourly_rate }).eq('id', id).eq('org_id', profile.org_id)
  }

  return NextResponse.json(data)
}
