import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { drainAutomationQueue } from '@/lib/automation-engine'

// Drains due automation-queue items. Not separately scheduled on Hobby (see
// /api/cron/tick) but kept for manual/isolated triggering.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret !== 'placeholder') {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  const result = await drainAutomationQueue(createServiceClient())
  return NextResponse.json(result)
}
