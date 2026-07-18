import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AgreementForm } from '@/components/agreements/agreement-form'

export default async function NewAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>
}) {
  const { contact } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getAppProfile(user!.id)
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/agreements')

  const [{ data: contacts }, { data: properties }, { data: team }] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name, company_name')
      .eq('org_id', profile.org_id).order('first_name').limit(500),
    supabase.from('properties').select('id, label, address_line1, suburb, contact_id')
      .eq('org_id', profile.org_id).limit(1000),
    supabase.from('users').select('id, full_name').eq('org_id', profile.org_id).eq('is_active', true).order('full_name'),
  ])

  return (
    <AgreementForm
      contacts={contacts ?? []}
      properties={properties ?? []}
      team={team ?? []}
      initialContactId={contact ?? null}
    />
  )
}
