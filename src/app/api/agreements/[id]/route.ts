import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitor'
import { generateRecurringJobs } from '@/lib/recurring'
import { melbourneDateOnly } from '@/lib/format'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zUuid, zDateOnly, zLineItems } from '@/lib/validation/common'

// Fields that change WHEN/HOW the recurring jobs fall — a change to any of these
// means the already-generated future jobs are stale and must be rebuilt.
const SCHEDULE_FIELDS = ['anchor_date', 'frequency', 'first_visit_date', 'start_time', 'duration_minutes', 'end_date']

// Remove upcoming not-yet-started jobs for an agreement (leave completed/invoiced
// history untouched). Same safe rule the cancel path uses.
async function deleteFutureJobs(supabase: Awaited<ReturnType<typeof createClient>>, agreementId: string, orgId: string) {
  await supabase
    .from('jobs')
    .delete()
    .eq('service_agreement_id', agreementId)
    .eq('org_id', orgId)
    .in('status', ['scheduled', 'draft'])
    .gte('scheduled_start', new Date().toISOString())
}

const FREQUENCIES = ['weekly', 'fortnightly', 'four_weekly', 'monthly']
const SOURCE = 'api/agreements/[id]'

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: profile } = await supabase
    .from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return { error: 'Only managers or admins can change recurring services', status: 403 as const }
  }
  return { profile }
}

// Every field is optional — a PATCH only touches the keys the client actually
// sent. Values are still fully validated when present, closing the mass-
// assignment hole the old ad-hoc `typeof` checks left open (no allowlist of
// keys, no rejection of malformed-but-truthy values).
const agreementPatchSchema = z.object({
  active: z.boolean().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  anchor_date: zDateOnly.optional(),
  first_visit_date: z.union([zDateOnly, z.null()]).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}/, 'Enter a valid time').transform((s) => s.slice(0, 5)).optional(),
  duration_minutes: z.number().finite().transform((n) => Math.max(15, n)).optional(),
  end_date: z.union([zDateOnly, z.null()]).optional(),
  line_items: zLineItems.optional(),
  assigned_users: z.array(zUuid).optional(),
  property_id: z.union([zUuid, z.null()]).optional(),
  // Not zNullableText: that helper always resolves undefined -> null, which
  // would make "instructions omitted" indistinguishable from "clear
  // instructions" and silently wipe the field on every unrelated PATCH.
  instructions: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v == null ? null : v.trim().slice(0, 2000) || null)),
}).partial()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const guard = await requireManager(supabase)
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const parsed = await parseBody(req, agreementPatchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const patch: Record<string, unknown> = {}

  if (body.active !== undefined) patch.active = body.active
  if (body.title !== undefined) patch.title = body.title
  if (body.frequency !== undefined) patch.frequency = body.frequency
  if (body.anchor_date !== undefined) patch.anchor_date = body.anchor_date
  if (body.first_visit_date !== undefined) patch.first_visit_date = body.first_visit_date
  if (body.start_time !== undefined) patch.start_time = body.start_time
  if (body.duration_minutes !== undefined) patch.duration_minutes = body.duration_minutes
  if (body.end_date !== undefined) patch.end_date = body.end_date
  if (body.line_items !== undefined) patch.line_items = body.line_items
  if (body.assigned_users !== undefined) patch.assigned_users = body.assigned_users
  if (body.property_id !== undefined) patch.property_id = body.property_id
  if (body.instructions !== undefined) patch.instructions = body.instructions

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  // Work out whether the schedule needs rebuilding, and how.
  const scheduleChanged = SCHEDULE_FIELDS.some(f => f in patch)
  const paused = patch.active === false
  const resumed = patch.active === true
  const rebuild = !paused && (scheduleChanged || resumed)

  // If we're rebuilding, move the cursor back to yesterday so generation
  // restarts from today forward (NOT from a past anchor — that would recreate
  // occurrences that already happened).
  if (rebuild) patch.last_generated_date = melbourneDateOnly(new Date(Date.now() - 86400000))

  const { data, error } = await supabase
    .from('service_agreements').update(patch).eq('id', id).eq('org_id', guard.profile.org_id).select('id').single()

  if (error || !data) {
    await captureError(error ?? new Error('Agreement update returned no row'), {
      source: SOURCE, level: 'error', orgId: guard.profile.org_id, userId: guard.profile.id, context: { id },
    })
    return jsonError(error ? friendlyDbError(error) : 'Failed to update', 400)
  }

  // Reshuffle the schedule to match the new settings (best-effort — the edit is
  // already saved, and the daily cron will backfill if this fails).
  // - paused: clear upcoming jobs.
  // - schedule changed or resumed: clear the stale upcoming jobs, then regenerate.
  // - only content changed: update upcoming jobs in place (keep their dates).
  try {
    if (paused) {
      await deleteFutureJobs(supabase, id, guard.profile.org_id)
    } else if (rebuild) {
      await deleteFutureJobs(supabase, id, guard.profile.org_id)
      await generateRecurringJobs(createServiceClient())
    } else {
      const jobPatch: Record<string, unknown> = {}
      if ('title' in patch) jobPatch.title = patch.title
      if ('line_items' in patch) jobPatch.line_items = patch.line_items
      if ('assigned_users' in patch) jobPatch.assigned_users = patch.assigned_users
      if ('instructions' in patch) jobPatch.instructions = patch.instructions
      if (Object.keys(jobPatch).length > 0) {
        await supabase
          .from('jobs')
          .update(jobPatch)
          .eq('service_agreement_id', id)
          .eq('org_id', guard.profile.org_id)
          .in('status', ['scheduled', 'draft'])
          .gte('scheduled_start', new Date().toISOString())
      }
    }
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: guard.profile.org_id, userId: guard.profile.id,
      context: { id, stage: 'reshuffle', paused, rebuild },
    })
  }

  return NextResponse.json({ id: data.id })
}

// Cancel a recurring service: remove upcoming not-yet-started jobs it generated,
// then delete the agreement. Completed/invoiced history is preserved (jobs.
// service_agreement_id is ON DELETE SET NULL).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const guard = await requireManager(supabase)
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  // Delete future jobs that haven't started (leave completed/invoiced ones).
  await supabase
    .from('jobs')
    .delete()
    .eq('service_agreement_id', id)
    .eq('org_id', guard.profile.org_id)
    .in('status', ['scheduled', 'draft'])
    .gte('scheduled_start', new Date().toISOString())

  const { error } = await supabase
    .from('service_agreements').delete().eq('id', id).eq('org_id', guard.profile.org_id)

  if (error) {
    await captureError(error, { source: SOURCE, level: 'error', orgId: guard.profile.org_id, userId: guard.profile.id, context: { id, stage: 'delete' } })
    return jsonError(friendlyDbError(error), 400)
  }
  return NextResponse.json({ ok: true })
}
