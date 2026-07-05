import { createClient, getAppProfile } from '@/lib/supabase/server'
import { CampaignDetail } from '@/components/marketing/campaign-detail'
import { redirect, notFound } from 'next/navigation'

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const [{ data: campaign }, { data: pipelineStages }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', id).single(),
    supabase.from('pipeline_stages').select('id, name').order('name'),
  ])

  if (!campaign) notFound()

  return (
    <CampaignDetail
      campaign={campaign}
      pipelineStages={pipelineStages ?? []}
      canManage={['admin', 'manager'].includes(profile.role)}
    />
  )
}
