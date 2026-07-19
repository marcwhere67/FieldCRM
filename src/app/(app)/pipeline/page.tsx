import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color')
    .eq('org_id', profile!.org_id)
    .order('position')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company_name, phone, email, pipeline_stage_id, created_at')
    .eq('org_id', profile!.org_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  return (
    <PipelineBoard
      stages={stages ?? []}
      contacts={contacts ?? []}
      orgId={profile!.org_id}
    />
  )
}
