import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resumeQueuedItem } from '@/lib/automation-engine'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/cron/automations'

// Drains due items from automation_queue: resumes each paused workflow from the
// step after its `wait`, running until the next wait or completion. Registered
// as a Vercel cron in vercel.json.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret !== 'placeholder') {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Atomically claim due items: the single UPDATE ... WHERE status='pending'
  // means concurrent cron runs can't grab the same row (the loser re-evaluates
  // the predicate and skips it).
  const { data: claimed, error: claimErr } = await supabase
    .from('automation_queue')
    .update({ status: 'processing', updated_at: now })
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .select('id, org_id, workflow_id, execution_id, contact_id, step_index')

  if (claimErr) {
    await captureError(claimErr, { source: SOURCE, level: 'error', context: { stage: 'claim' } })
    return NextResponse.json({ error: claimErr.message }, { status: 500 })
  }

  let processed = 0
  let failed = 0

  for (const item of claimed ?? []) {
    try {
      await resumeQueuedItem(supabase, item)
      await supabase
        .from('automation_queue')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', item.id)
      processed++
    } catch (err) {
      await supabase
        .from('automation_queue')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', item.id)
      await captureError(err, {
        source: SOURCE, level: 'error', orgId: item.org_id,
        context: { queueId: item.id, executionId: item.execution_id, stepIndex: item.step_index },
      })
      failed++
    }
  }

  return NextResponse.json({ claimed: claimed?.length ?? 0, processed, failed })
}
