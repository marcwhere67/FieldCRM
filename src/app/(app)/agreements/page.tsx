import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AgreementsList } from '@/components/agreements/agreements-list'

export default async function AgreementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getAppProfile(user!.id)
  if (!profile) redirect('/login')

  const { data: agreements } = await supabase
    .from('service_agreements')
    .select(`
      id, title, frequency, anchor_date, start_time, end_date, active, line_items, last_generated_date,
      contacts!service_agreements_contact_id_fkey(id, first_name, last_name)
    `)
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <AgreementsList
      agreements={agreements ?? []}
      isManager={['admin', 'manager'].includes(profile.role)}
    />
  )
}
