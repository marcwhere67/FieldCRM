import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitor'
import { generateRecurringJobs } from '@/lib/recurring'
import { jsonError, friendlyDbError } from '@/lib/http'
import { parseBody } from '@/lib/http'
import { zRequiredText, zNullableText, zUuid, zOptionalUuid, zDateOnly, zLineItems } from '@/lib/validation/common'

const FREQUENCIES = ['weekly', 'fortnightly', 'four_weekly', 'monthly'] as const
const SOURCE = 'api/agreements'

const agreementSchema = z.object({
  title: zRequiredText(200),
  contact_id: zUuid,
  property_id: zOptionalUuid,
  frequency: z.enum(FREQUENCIES, { error: 'Choose how often it repeats' }),
  anchor_date: zDateOnly,
  first_visit_date: z.union([zDateOnly, z.null()]).optional().transform((v) => v ?? null),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}/, 'Enter a valid time')
    .transform((s) => s.slice(0, 5))
    .optional()
    .default('09:00'),
  duration_minutes: z
    .number()
    .finite()
    .optional()
    .transform((n) => Math.max(15, Number.isFinite(n) ? (n as number) : 120)),
  end_date: z.union([zDateOnly, z.null()]).optional().transform((v) => v ?? null),
  line_items: zLineItems.optional().default([]),
  assigned_users: z.array(zUuid).optional().default([]),
  instructions: zNullableText(2000),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only managers or admins can set up recurring services' }, { status: 403 })
  }

  const parsed = await parseBody(req, agreementSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const payload = {
    org_id: profile.org_id,
    contact_id: body.contact_id,
    property_id: body.property_id,
    title: body.title,
    frequency: body.frequency,
    anchor_date: body.anchor_date,
    first_visit_date: body.first_visit_date,
    start_time: body.start_time,
    duration_minutes: body.duration_minutes,
    end_date: body.end_date,
    line_items: body.line_items,
    assigned_users: body.assigned_users,
    instructions: body.instructions,
    active: true,
  }

  const { data, error } = await supabase
    .from('service_agreements').insert(payload).select('id').single()

  if (error || !data) {
    await captureError(error ?? new Error('Agreement insert returned no row'), {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id, context: { contact_id: body.contact_id, frequency: body.frequency },
    })
    return jsonError(friendlyDbError(error), 400)
  }

  // Generate the upcoming jobs now so they land on the schedule immediately,
  // rather than waiting for the daily cron. Best-effort — the agreement is
  // already saved, and the cron will backfill if this fails.
  try {
    await generateRecurringJobs(createServiceClient())
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'generate_on_create', agreementId: data.id },
    })
  }

  return NextResponse.json({ id: data.id })
}
