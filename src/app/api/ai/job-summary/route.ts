import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await req.json()

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('supabase_auth_id', user.id)
    .single()

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      title, description, job_type, status,
      scheduled_start, scheduled_end, actual_start, actual_end,
      checklist, notes, materials_used,
      contacts!jobs_contact_id_fkey(first_name, last_name),
      properties!jobs_property_id_fkey(address_line1, suburb, state),
      timesheets(total_minutes, users(full_name))
    `)
    .eq('id', jobId)
    .eq('org_id', profile!.org_id)
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const contact = Array.isArray(job.contacts) ? job.contacts[0] : job.contacts
  const property = Array.isArray(job.properties) ? job.properties[0] : job.properties
  const checklist = (job.checklist as { label: string; completed: boolean }[] | null) ?? []
  const materials = (job.materials_used as { name: string; quantity: number; unit: string }[] | null) ?? []
  const timesheets = (job.timesheets as unknown as { total_minutes: number; users: { full_name: string } | null }[] | null) ?? []

  const totalMinutes = timesheets.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const prompt = `You are a professional field service report writer for a cleaning/maintenance company.
Write a concise job completion summary based on the following data.
Use plain, professional language suitable for an internal note or client-facing summary.

Job: ${job.title}
Type: ${job.job_type}
Status: ${job.status}
Client: ${contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'}
Property: ${property ? `${property.address_line1}, ${property.suburb} ${property.state}` : 'Unknown'}
Scheduled: ${job.scheduled_start ?? 'Not set'}
Actual time on site: ${hours}h ${mins}m
Crew: ${timesheets.map(t => t.users?.full_name ?? 'Unknown').join(', ') || 'None logged'}

Checklist (${checklist.filter(i => i.completed).length}/${checklist.length} completed):
${checklist.map(i => `- [${i.completed ? 'x' : ' '}] ${i.label}`).join('\n') || 'No checklist items'}

Materials used:
${materials.map(m => `- ${m.quantity} ${m.unit} ${m.name}`).join('\n') || 'None recorded'}

Existing notes: ${job.notes || 'None'}

Write a 2-4 sentence professional job summary. Then list any notable observations or follow-up actions needed (if any). Keep it factual and concise.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ summary: text })
}
