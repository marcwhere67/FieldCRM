import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AutomationsView } from '@/components/automations/automations-view'

export default async function AutomationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, name, description, is_active, trigger_type, trigger_conditions, steps, stats, created_at')
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, color')
    .eq('org_id', profile!.org_id)
    .order('position')

  // Recent executions
  const { data: executions } = await supabase
    .from('workflow_executions')
    .select(`
      id, workflow_id, status, started_at, completed_at, steps_completed, error,
      contacts!workflow_executions_contact_id_fkey(id, first_name, last_name)
    `)
    .eq('org_id', profile!.org_id)
    .order('started_at', { ascending: false })
    .limit(50)

  return (
    <AutomationsView
      workflows={workflows ?? []}
      executions={executions ?? []}
      stages={stages ?? []}
      orgId={profile!.org_id}
    />
  )
}
