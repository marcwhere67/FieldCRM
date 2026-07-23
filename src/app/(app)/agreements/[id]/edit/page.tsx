import { redirect, notFound } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AgreementForm } from '@/components/agreements/agreement-form'

export default async function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getAppProfile(user!.id)
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect(`/agreements/${id}`)

  const [{ data: agreement }, { data: contacts }, { data: properties }, { data: team }] = await Promise.all([
    supabase.from('service_agreements')
      .select('id, contact_id, property_id, title, frequency, anchor_date, first_visit_date, start_time, duration_minutes, end_date, instructions, assigned_users, line_items')
      .eq('id', id).eq('org_id', profile.org_id).single(),
    supabase.from('contacts').select('id, first_name, last_name, company_name').eq('org_id', profile.org_id).order('first_name').limit(500),
    supabase.from('properties').select('id, label, address_line1, suburb, contact_id').eq('org_id', profile.org_id).limit(1000),
    supabase.from('users').select('id, full_name').eq('org_id', profile.org_id).eq('is_active', true).order('full_name'),
  ])

  if (!agreement) notFound()

  return (
    <AgreementForm
      contacts={contacts ?? []}
      properties={properties ?? []}
      team={team ?? []}
      initialContactId={agreement.contact_id}
      existing={agreement}
    />
  )
}
