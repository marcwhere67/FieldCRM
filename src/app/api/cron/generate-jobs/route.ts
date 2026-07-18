import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateRecurringJobs } from '@/lib/recurring'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/cron/generate-jobs'

// Rolls recurring service agreements forward into scheduled jobs (3 weeks
// ahead). Registered as a daily Vercel cron in vercel.json.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret !== 'placeholder') {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceClient()
    const { created } = await generateRecurringJobs(supabase)
    return NextResponse.json({ created })
  } catch (err) {
    await captureError(err, { source: SOURCE, level: 'error' })
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
