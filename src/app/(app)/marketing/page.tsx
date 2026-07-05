import { createClient, getAppProfile } from '@/lib/supabase/server'
import { CampaignsList } from '@/components/marketing/campaigns-list'
import { redirect } from 'next/navigation'

export default async function MarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const [{ data: campaigns }, { data: pipelineStages }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('pipeline_stages')
      .select('id, name')
      .order('name'),
  ])

  return (
    <CampaignsList
      initialCampaigns={campaigns ?? []}
      pipelineStages={pipelineStages ?? []}
      canManage={['admin', 'manager'].includes(profile.role)}
    />
  )
}
