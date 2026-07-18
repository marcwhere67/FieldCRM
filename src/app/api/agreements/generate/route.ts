import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRecurringJobs } from '@/lib/recurring'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/agreements/generate'

// Manager-triggered "generate upcoming visits now". Uses the authenticated
// client so RLS scopes generation to the manager's own org.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { created } = await generateRecurringJobs(supabase)
    return NextResponse.json({ created })
  } catch (err) {
    await captureError(err, { source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id })
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
