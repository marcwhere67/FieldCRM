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

  // Cleaning procedure matching this job's clean_type (table may not exist yet
  // pre-migration — queries just come back null, page still renders)
  let procedure = null
  let procedureSteps = [] as { id: string; area: string; order_index: number; title: string; description: string | null; is_required: boolean; reference_photo_path: string | null }[]
  let procedureProgress = [] as { id: string; step_id: string; completed: boolean; completed_by: string | null; completed_at: string | null; proof_photo_path: string | null }[]
  let propertyNotes = [] as { id: string; step_id: string; note: string }[]
  if (job.clean_type) {
    const { data: proc } = await supabase
      .from('cleaning_procedures')
      .select('*')
      .eq('org_id', profile!.org_id)
      .eq('clean_type', job.clean_type)
      .eq('status', 'active')
      .maybeSingle()
    procedure = proc ?? null
    if (procedure) {
      const [{ data: steps }, { data: progress }, { data: notes }] = await Promise.all([
        supabase.from('procedure_steps').select('*').eq('procedure_id', procedure.id).eq('status', 'active').order('area').order('order_index'),
        supabase.from('job_procedure_progress').select('*').eq('job_id', id),
        job.property_id
          ? supabase.from('property_procedure_notes').select('id, step_id, note').eq('property_id', job.property_id)
          : Promise.resolve({ data: [] }),
      ])
      procedureSteps = steps ?? []
      procedureProgress = progress ?? []
      propertyNotes = notes ?? []
    }
  }

  return (
    <JobDetail
      job={job}
      teamMembers={teamMembers ?? []}
      timesheets={timesheets ?? []}
      jobNotes={jobNotes ?? []}
      currentUserId={profile!.id}
      userRole={profile!.role}
      myActiveTimesheet={myActive ?? null}
      procedure={procedure}
      procedureSteps={procedureSteps}
      procedureProgress={procedureProgress}
      propertyNotes={propertyNotes}
      propertyId={job.property_id ?? null}
    />
  )
}
