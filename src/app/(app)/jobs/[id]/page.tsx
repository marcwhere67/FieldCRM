import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { JobDetail } from '@/components/jobs/job-detail'

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      *,
      contacts!jobs_contact_id_fkey(id, first_name, last_name, email, phone),
      properties!jobs_property_id_fkey(id, label, address_line1, suburb, state, postcode, lat, lng, access_notes),
      quotes!jobs_quote_id_fkey(id, quote_number, total, status),
      invoices!fk_jobs_invoice(id, invoice_number, total, status)
    `)
    .eq('id', id)
    .eq('org_id', profile!.org_id)
    .single()

  if (!job) notFound()

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name, role, phone')
    .eq('org_id', profile!.org_id)
    .eq('is_active', true)

  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('id, user_id, clocked_in_at, clocked_out_at, total_minutes, clock_in_address, clock_out_address')
    .eq('job_id', id)
    .order('clocked_in_at', { ascending: false })

  // Current user's active timesheet for this job (clocked in, not yet out)
  const { data: myActive } = await supabase
    .from('timesheets')
    .select('id, clocked_in_at')
    .eq('job_id', id)
    .eq('user_id', profile!.id)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch job notes
  const { data: jobNotes } = await supabase
    .from('job_notes')
    .select('*')
    .eq('job_id', id)
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  return (
    <JobDetail
      job={job}
      teamMembers={teamMembers ?? []}
      timesheets={timesheets ?? []}
      jobNotes={jobNotes ?? []}
      currentUserId={profile!.id}
      userRole={profile!.role}
      myActiveTimesheet={myActive ?? null}
    />
  )
}
