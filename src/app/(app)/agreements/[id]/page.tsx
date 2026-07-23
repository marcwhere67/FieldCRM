import { redirect, notFound } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AgreementDetail } from '@/components/agreements/agreement-detail'

export default async function AgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getAppProfile(user!.id)
  if (!profile) redirect('/login')

  const { data: agreement } = await supabase
    .from('service_agreements')
    .select(`
      id, title, frequency, anchor_date, first_visit_date, start_time, duration_minutes, end_date, active,
      line_items, instructions, assigned_users, last_generated_date, property_id,
      contacts!service_agreements_contact_id_fkey(id, first_name, last_name),
      properties!service_agreements_property_id_fkey(id, label, address_line1, suburb)
    `)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()

  if (!agreement) notFound()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, title, status, scheduled_start')
    .eq('service_agreement_id', id)
    .eq('org_id', profile.org_id)
    .order('scheduled_start', { ascending: false })
    .limit(50)

  return (
    <AgreementDetail
      agreement={agreement}
      jobs={jobs ?? []}
      isManager={['admin', 'manager'].includes(profile.role)}
    />
  )
}
