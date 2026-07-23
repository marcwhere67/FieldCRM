import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitor'
import { generateRecurringJobs } from '@/lib/recurring'
import { melbourneDateOnly } from '@/lib/format'

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const guard = await requireManager(supabase)
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (typeof body.active === 'boolean') patch.active = body.active
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim()
  if (FREQUENCIES.includes(body.frequency)) patch.frequency = body.frequency
  if (/^\d{4}-\d{2}-\d{2}$/.test(body.anchor_date)) patch.anchor_date = body.anchor_date
  if (body.first_visit_date === null || /^\d{4}-\d{2}-\d{2}$/.test(body.first_visit_date)) patch.first_visit_date = body.first_visit_date || null
  if (/^\d{2}:\d{2}/.test(body.start_time)) patch.start_time = String(body.start_time).slice(0, 5)
  if (Number.isFinite(Number(body.duration_minutes))) patch.duration_minutes = Math.max(15, Number(body.duration_minutes))
  if (body.end_date === null || /^\d{4}-\d{2}-\d{2}$/.test(body.end_date)) patch.end_date = body.end_date || null
  if (Array.isArray(body.line_items)) patch.line_items = body.line_items
  if (Array.isArray(body.assigned_users)) patch.assigned_users = body.assigned_users.map(String)
  if (body.property_id === null || typeof body.property_id === 'string') patch.property_id = body.property_id || null
  if (typeof body.instructions === 'string' || body.instructions === null) patch.instructions = body.instructions ? String(body.instructions).slice(0, 2000) : null

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
    return NextResponse.json({ error: error?.message ?? 'Failed to update' }, { status: 400 })
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
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
