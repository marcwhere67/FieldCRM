import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { NewContactForm } from '@/components/contacts/new-contact-form'

export default async function NewContactPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('org_id', profile!.org_id)
    .eq('is_active', true)

  const { data: pipelineStages } = await supabase
    .from('pipeline_stages')
    .select('id, name')
    .eq('org_id', profile!.org_id)
    .eq('pipeline_type', 'leads')
    .order('position')

  return (
    <NewContactForm
      orgId={profile!.org_id}
      teamMembers={teamMembers ?? []}
      pipelineStages={pipelineStages ?? []}
    />
  )
}
