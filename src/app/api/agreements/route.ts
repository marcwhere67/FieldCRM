import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitor'

const FREQUENCIES = ['weekly', 'fortnightly', 'four_weekly', 'monthly']
const SOURCE = 'api/agreements'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only managers or admins can set up recurring services' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  const title = String(body.title || '').trim()
  const contact_id = body.contact_id ? String(body.contact_id) : null
  const frequency = String(body.frequency || '')
  const anchor_date = String(body.anchor_date || '')

  if (!title) return NextResponse.json({ error: 'A title is required' }, { status: 400 })
  if (!contact_id) return NextResponse.json({ error: 'Choose a customer' }, { status: 400 })
  if (!FREQUENCIES.includes(frequency)) return NextResponse.json({ error: 'Choose how often it repeats' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor_date)) return NextResponse.json({ error: 'Choose a valid first date' }, { status: 400 })

  const payload = {
    org_id: profile.org_id,
    contact_id,
    property_id: body.property_id ? String(body.property_id) : null,
    title,
    frequency,
    anchor_date,
    start_time: /^\d{2}:\d{2}/.test(body.start_time) ? String(body.start_time).slice(0, 5) : '09:00',
    duration_minutes: Number.isFinite(Number(body.duration_minutes)) ? Math.max(15, Number(body.duration_minutes)) : 120,
    end_date: /^\d{4}-\d{2}-\d{2}$/.test(body.end_date) ? String(body.end_date) : null,
    line_items: Array.isArray(body.line_items) ? body.line_items : [],
    assigned_users: Array.isArray(body.assigned_users) ? body.assigned_users.map(String) : [],
    instructions: body.instructions ? String(body.instructions).slice(0, 2000) : null,
    active: true,
  }

  const { data, error } = await supabase
    .from('service_agreements').insert(payload).select('id').single()

  if (error || !data) {
    await captureError(error ?? new Error('Agreement insert returned no row'), {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id, context: { contact_id, frequency },
    })
    return NextResponse.json({ error: error?.message ?? 'Failed to create agreement' }, { status: 400 })
  }

  return NextResponse.json({ id: data.id })
}
