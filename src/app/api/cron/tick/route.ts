import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { drainAutomationQueue } from '@/lib/automation-engine'
import { generateRecurringJobs } from '@/lib/recurring'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/cron/tick'

// Single consolidated scheduled worker (one cron keeps us within Hobby-plan
// limits). Runs the automation-queue drain AND recurring-job generation.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret !== 'placeholder') {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const out: Record<string, unknown> = {}

  try {
    out.automations = await drainAutomationQueue(supabase)
  } catch (err) {
    await captureError(err, { source: SOURCE, level: 'error', context: { stage: 'automations' } })
    out.automations = { error: true }
  }

  try {
    out.recurring = await generateRecurringJobs(supabase)
  } catch (err) {
    await captureError(err, { source: SOURCE, level: 'error', context: { stage: 'recurring' } })
    out.recurring = { error: true }
  }

  return NextResponse.json(out)
}
